import GoogleScholarScrapingDto from "../dto/google-scholar-scraping-dto";
import {Page} from "puppeteer";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import puppeteer from "puppeteer-extra";
import {randomSleep} from "./browser-utils";
import {AuthorProfilePayload} from "../model/author-profile-payload";
import {saveAuthorProfile, saveCitation, saveDocument} from "./scraping-service";
import {DocumentPayload} from "../model/document-payload";
import {CitationPayload} from "../model/citation-payload";

puppeteer.use(StealthPlugin());

const GOOGLE_SCHOLAR = 'google_scholar';

const startGoogleScholarScraping = async (scrapingDto: GoogleScholarScrapingDto) => {
    let browser;

    try {
        browser = await puppeteer.launch({
            headless: false,
            args: [`--proxy-server=${process.env.PROXY_URL}`],
            defaultViewport: {width: 1280, height: 800},
        });
        console.log(`Using proxy: ${process.env.PROXY_URL}`);


        const page = await browser.newPage();
        page.setDefaultTimeout(60000)
        await page.setViewport({width: 1280, height: 800});

        await page.authenticate({
            username: process.env.PROXY_USERNAME!,
            password: process.env.PROXY_PASSWORD!,
        })

        const authorId = await fetchAuthorId(page, scrapingDto.firstName, scrapingDto.lastName);
        if (!authorId) {
            throw new Error("Could not find author id for google-scholar");
        }

        const profileData = await fetchProfileData(page, authorId);
        const authorProfilePayload: AuthorProfilePayload = {...profileData};
        const profileId = await saveAuthorProfile(authorProfilePayload, scrapingDto.sessionId, GOOGLE_SCHOLAR);
        const docUrls = await getDocUrls(page);

        for (var i = 1; i < docUrls.length; i++) {
            const documentPayload = await scrapeDocument(page, docUrls[i]);
            const docId = await saveDocument(documentPayload, profileId, scrapingDto.sessionId, GOOGLE_SCHOLAR);
            const links = await scrapeLinks(page, documentPayload.citationsUrl);
            for (const link of links) {
                await saveCitation(link, docId, scrapingDto.sessionId, GOOGLE_SCHOLAR);
            }
        }

    } catch (error) {
        console.error(error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }

};

const fetchAuthorId = async (page: Page, firstName: string, lastName: string) => {
    await page.goto(`https://scholar.google.com/scholar?hl=en&as_sdt=0%2C5&q=${firstName}+${lastName}`, {waitUntil: 'networkidle2'});
    await randomSleep(500, 1000);

    return await page.evaluate(() => {
        const authorLink = document.querySelector('a[href^="/citations?user="]');
        if (authorLink) {
            const url = new URL('https://scholar.google.com' + authorLink.getAttribute('href'));
            return url.searchParams.get('user');
        } else {
            return null;
        }
    })
}

const fetchProfileData = async (page: Page, authorId: string) => {
    await page.goto(`https://scholar.google.com/citations?hl=en&user=${authorId}&view_op=list_works&sortby=pubdate`, {waitUntil: 'networkidle2'});
    await randomSleep(500, 1000);

    return await page.evaluate(() => {
        let authorName = document.querySelector('#gsc_prf_in')?.textContent;
        return {
            authorName: authorName,
            firstName: authorName?.split(' ')[0],
            lastName: authorName?.split(' ')?.length ?? 0 > 2 ? authorName?.split(' ')[2] : authorName?.split(' ')[1],
            middleName: authorName?.split(' ')?.length ?? 0 > 2 ? authorName?.split(' ')[1] : null,
            imageUrl: document.querySelector('#gsc_prf_pu')?.querySelector('img')?.getAttribute('src'),
            institution: (document.querySelectorAll('.gsc_prf_il')[0])?.textContent,
            institutionRole: 'Professor',
            email: '',
            topicElements: Array.from(document.querySelector('#gsc_prf_int')?.querySelectorAll('a') ?? []).map(el => el.textContent),
        }
    })
}

const getDocUrls = async (page: Page) => {
    let showMoreVisible = true;

    while (showMoreVisible) {
        try {
            await page.waitForSelector('#gsc_bpf_more', {timeout: 3000});

            const isDisabled = await page.evaluate(() => {
                return document.querySelector("#gsc_bpf_more")?.attributes.getNamedItem('disabled') != null
            });

            if (isDisabled) {
                showMoreVisible = false;
            } else {
                console.log('Clicking "Show more"...');
                await page.click('#gsc_bpf_more');
                await randomSleep(1000, 2000);
            }
        } catch (err) {
            console.log('No more "Show more" button found.');
            showMoreVisible = false;
        }
    }

    return await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.gsc_a_t'))
            .map(e => e.querySelector('a')?.getAttribute('href'))
            .filter(p => p != null)
            .map(link => `https://scholar.google.com/${link}`);
    })
}


const scrapeDocument = async (page: any, docUrl: string): Promise<DocumentPayload> => {
    await page.goto(docUrl, {waitUntil: 'networkidle2'});
    await randomSleep(500, 1000);

    const pageData = await page.evaluate(() => {
        const contents: Record<string, string> = {};
        document.querySelectorAll('.gs_scl').forEach(el => {
            const key = el.querySelector('.gsc_oci_field')?.textContent?.trim().toLowerCase();
            const val = el.querySelector('.gsc_oci_value')?.textContent?.trim() ?? '';
            if (key) {
                contents[key] = val;
            }
        });

        return {
            title: document.querySelector('#gsc_oci_title')?.textContent,
            contents,
            link: Array.from(document.querySelectorAll('.gs_scl'))
                .filter(el => el.querySelector('.gsc_oci_field')?.textContent?.trim()?.toLowerCase() === 'scholar articles')
                .map(el => el.querySelector('a')?.getAttribute('href') ?? '')[0],
            citationsUrl: Array.from(document.querySelectorAll('.gs_scl'))
                .filter(el => el.querySelector('.gsc_oci_field')?.textContent?.trim()?.toLowerCase() === 'total citations')
                .map(el => el.querySelector('a')?.getAttribute('href') ?? '')[0],
        }
    })

    console.log('doc page data:', pageData);

    return {
        title: pageData?.title ?? '',
        coAuthorsNames: ((pageData.contents['authors'] ?? '').split(',') as string[]).map(s => s.trim()),
        publicationDate: new Date(pageData.contents['publication date'] ?? '').toISOString(),
        issued: pageData.contents['book'] ?? pageData.contents['journal'] ?? pageData.contents['conference'] ?? pageData.contents['source'] ?? '',
        volume: pageData.contents['volume'] ?? '',
        issue: pageData.contents['issue'] ?? '',
        pages: pageData.contents['pages'] ?? '',
        publisher: pageData.contents['publisher'] ?? '',
        description: pageData.contents['description'] ?? '',
        links: pageData.contents['link'] ? [`https://scholar.google.com/${pageData.contents['link'] ?? ''}`] : [],
        citationsUrl: pageData.citationsUrl ?? '',
    };
};

const scrapeLinks = async (page: Page, citationsUrl: string | null): Promise<CitationPayload[]> => {
    if (!citationsUrl) {
        return [];
    }

    let hasNextPage = true;
    let results: CitationPayload[] = [];

    await page.goto(citationsUrl, {waitUntil: 'networkidle2'});
    await randomSleep(500, 1000);

    while (hasNextPage) {
        const citations = await page.evaluate((): CitationPayload[] => {
            return Array.from(document.querySelectorAll('.gs_r')).map(entry => {
                return {
                    title: entry.querySelector('.gs_rt a')?.textContent ?? 'No title',
                    citationLink: entry.querySelector('.gs_rt a')?.getAttribute('href') ?? 'No link',
                    pdfLink: entry.querySelector('.gs_or_ggsm a')?.getAttribute('href') ?? 'No PDF'
                };
            })
        })

        results.push(...citations);

        const nextButton = await page.$('td[align=left] a.gs_nma');
        if (nextButton) {
            await nextButton.click();
            await page.waitForNavigation({waitUntil: 'networkidle2'});
        } else {
            hasNextPage = false;
        }
    }

    return results;
}

export default startGoogleScholarScraping