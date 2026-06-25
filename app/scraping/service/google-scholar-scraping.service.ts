import {Page} from "puppeteer";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import puppeteer from "puppeteer-extra";
import {ScrapingResponse} from "../model/scraping-response";
import {getBrowser} from "../../config/browser";
import {AuthorProfilePayload} from "../model/author-profile-payload";
import {DocumentPayload} from "../model/document-payload";
import {randomSleep} from "../utils/browser-utils";
import {normalizeDate} from "../utils/scraping-utils";
import {CitationPayload} from "../model/citation-payload";

export class GoogleScholarScrapingService {
    async scrapeAuthorProfile(payload: string, refId: string): Promise<ScrapingResponse> {
        console.info(`[GoogleScholarScrapingService] Scraping author data, payload=${payload} refId=${refId}`);
        puppeteer.use(StealthPlugin());

        let page: Page | undefined;

        try {
            const {firstName, lastName} = JSON.parse(payload) as {
                firstName: string;
                lastName: string;
            };

            const browser = await getBrowser();
            page = await browser.newPage();
            page.setDefaultTimeout(60000)
            await page.setViewport({width: 1280, height: 800});

            await page.authenticate({
                username: process.env.PROXY_USERNAME!,
                password: process.env.PROXY_PASSWORD!,
            })

            const authorId = await this.fetchAuthorId(page, firstName, lastName);
            if (!authorId) {
                throw new Error("Could not find author id for google-scholar");
            }

            const profileData = await this.fetchProfileData(page, authorId);
            const authorProfilePayload: AuthorProfilePayload = {...profileData, providerId: authorId};

            const docUrls = await this.getDocUrls(page);

            return {
                data: JSON.stringify(authorProfilePayload),
                queueItems: docUrls.map((docUrl) => ({
                    link: docUrl,
                    type: 'DOCUMENT'
                })),
                refId
            }
        } catch (e) {
            console.error(e);
            throw new Error("Could not find author id for google-scholar");
        } finally {
            if (page) {
                await page.close();
            }
        }
    }

    async scrapeAuthorDocument(payload: string, refId: string): Promise<ScrapingResponse> {
        console.info(`[GoogleScholarScrapingService] Scraping author documents, payload=${payload} refId=${refId}`);
        let page: Page | undefined;

        try {
            const {url} = JSON.parse(payload) as {
                url: string
            };

            const browser = await getBrowser();
            page = await browser.newPage();
            page.setDefaultTimeout(60000)
            await page.setViewport({width: 1280, height: 800});

            await page.authenticate({
                username: process.env.PROXY_USERNAME!,
                password: process.env.PROXY_PASSWORD!,
            })

            const documentPayload = await this.scrapeDocument(page, url);
            const urlCitations = documentPayload.citationsUrl ? new URL(documentPayload.citationsUrl) : null;
            const clusterId = urlCitations ? urlCitations.searchParams.get("cites") : null;

            const documentResponsePayload: DocumentPayload = {...documentPayload, providerId: clusterId};

            return {
                data: JSON.stringify(documentResponsePayload),
                queueItems: documentPayload.citationsUrl ? [{
                    link: documentPayload.citationsUrl,
                    type: 'CITATIONS_GS'
                }] : [],
                refId
            }
        } catch (e) {
            console.error(e);
            const {url} = JSON.parse(payload) as {
                url: string
            };
            console.error("FAILED URL DOCUMENT", {url});
            throw new Error("Could not find author id for google-scholar");
        } finally {
            if (page) {
                await page.close();
            }
        }
    }

    async scrapeCitationData(payload: string, refId: string): Promise<ScrapingResponse> {
        console.info(`[GoogleScholarScrapingService] Scraping documetn citations, payload=${payload} refId=${refId}`);
        let page: Page | undefined;

        try {
            const {url} = JSON.parse(payload) as {
                url: string;
            };
            const browser = await getBrowser();
            page = await browser.newPage();
            page.setDefaultTimeout(60000)
            await page.setViewport({width: 1280, height: 800});

            await page.authenticate({
                username: process.env.PROXY_USERNAME!,
                password: process.env.PROXY_PASSWORD!,
            })

            const scrapedCitations = await this.scrapeLinks(page, url);
            const citations = scrapedCitations
                .filter(c => c.title)
                .map((c) => ({...c, refId: refId}));

            if (citations.length === 0) {
                throw new Error("Could not find citations for google-scholar");
            }

            return {
                data: JSON.stringify(citations),
                queueItems: [],
                refId
            }
        } catch (e) {
            console.error(e);
            throw new Error("Error scraping citation data");
        } finally {
            if (page) {
                await page.close();
            }
        }
    }

    private async fetchAuthorId(page: Page, firstName: string, lastName: string) {
        let authorUrl = `https://scholar.google.com/scholar?hl=en&as_sdt=0%2C5&q=${firstName}+${lastName}`;
        await page.goto(authorUrl, {waitUntil: 'networkidle2'});

        console.info(`[GoogleScholarScrapingService] Scraping author identifier, firstName=${firstName} lastName=${lastName} url=${authorUrl}`);
        await randomSleep(500, 1000);

        return await page.evaluate(() => {
            const authorLink = document.querySelector('a[href^="/citations?user="]');
            if (authorLink) {
                const url = new URL('https://scholar.google.com' + authorLink.getAttribute('href'));

                console.info(`[GoogleScholarScrapingService] Found author link returning user param, authorLink=${url.searchParams.get('user')}`);
                return url.searchParams.get('user');
            } else {
                return null;
            }
        })
    }

    private fetchProfileData = async (page: Page, authorId: string) => {
        let profileDataUrl = `https://scholar.google.com/citations?hl=en&user=${authorId}&view_op=list_works&sortby=pubdate`;

        await page.goto(profileDataUrl, {waitUntil: 'networkidle2'});
        console.info(`[GoogleScholarScrapingService] Scraping profile data, url=${profileDataUrl}`);
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
                h_index: document.querySelector("#gsc_rsb_st")?.querySelectorAll("tr")[2].querySelectorAll("td")[1].textContent,
                i10_index: document.querySelector("#gsc_rsb_st")?.querySelectorAll("tr")[3].querySelectorAll("td")[1].textContent
            }
        })
    }

    private async getDocUrls(page: Page) {
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
                    await randomSleep(1000, 5000);
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
                .filter(p => !p?.includes("list_works"))
                .map(link => link?.startsWith("/")
                    ? `https://scholar.google.com${link}`
                    : `https://scholar.google.com/${link}`
                );
        })
    }


    private async scrapeDocument(page: any, docUrl: string): Promise<DocumentPayload> {
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

        console.info('[GoogleScholarScrapingServvice] doc page data:', pageData);

        if (!pageData.title) {
            throw new Error('No such doc page data.');
        }

        return {
            title: pageData?.title ?? '',
            coAuthorsNames: ((pageData.contents['authors'] ?? '').split(',') as string[]).map(s => s.trim()),
            publicationDate: normalizeDate(pageData.contents['publication date']) ?? null,
            issued: pageData.contents['book'] ?? pageData.contents['journal'] ?? pageData.contents['conference'] ?? pageData.contents['source'] ?? '',
            volume: pageData.contents['volume'] ?? '',
            issue: pageData.contents['issue'] ?? '',
            pages: pageData.contents['pages'] ?? '',
            publisher: pageData.contents['publisher'] ?? '',
            description: pageData.contents['description'] ?? '',
            links: pageData.contents['link'] ? [`https://scholar.google.com/${pageData.contents['link'] ?? ''}`] : [],
            citationsUrl: pageData.citationsUrl ? new URL(pageData.citationsUrl, 'https://scholar.google.com').href : '',
            providerId: null,
        };
    }

    async scrapeLinks(page: Page, citationsUrl: string | null): Promise<CitationPayload[]> {
        if (!citationsUrl) {
            return [];
        }

        let hasNextPage = true;
        let results: CitationPayload[] = [];

        await page.goto(citationsUrl, {waitUntil: 'networkidle2'});
        await randomSleep(500, 1000);

        while (hasNextPage) {
            const citations = await page.evaluate((): CitationPayload[] => {
                return Array.from(document.querySelectorAll('.gs_r'))
                    .slice(1)
                    .map(entry => {
                        const titleEl = entry.querySelector('.gs_rt');
                        const linkEl = entry.querySelector('.gs_rt a') as HTMLAnchorElement | null;
                        const pdfEl = entry.querySelector('.gs_or_ggsm a') as HTMLAnchorElement | null;

                        const title =
                            entry.querySelector('.gs_rt a')?.textContent?.trim() ||
                            entry.querySelector('.gs_rt')?.textContent?.trim() ||
                            null;

                        return {
                            title: title || null,
                            citationLink: linkEl?.href || null,
                            pdfLink: pdfEl?.href || null,
                            refId: null
                        };
                    })
                    .filter(item => item.title && item.title.length > 0);
            });

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
}