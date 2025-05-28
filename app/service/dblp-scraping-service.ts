import {Page} from "puppeteer";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import puppeteer from "puppeteer-extra";
import {randomSleep} from "./browser-utils";
import DblpScrapingDto from "../dto/dblp-scraping-dto";
import {XMLParser} from "fast-xml-parser";
import {DocumentPayload} from "../model/document-payload";
import {AuthorProfilePayload} from "../model/author-profile-payload";
import {saveAuthorProfile, saveCitation, saveDocument} from "./scraping-service";
import {CitationPayload} from "../model/citation-payload";

puppeteer.use(StealthPlugin());

const startDblpScraping = async (scrapingDto: DblpScrapingDto) => {
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


        const authorLink = await fetchAuthorLink(page, scrapingDto.firstName, scrapingDto.lastName);
        if (!authorLink) {
            throw new Error("Could not find author id for dblp");
        }

        await page.goto(authorLink, { waitUntil: "networkidle2" });
        await randomSleep(2000, 5000);

        const docUrls = await getDocUrls(page);

        const authorProfile : AuthorProfilePayload = {
            firstName: scrapingDto.firstName,
            lastName: scrapingDto.lastName,
        }



        const authorProfileId = await saveAuthorProfile(authorProfile, scrapingDto.sessionId, 'dblp');
        // await browser.close();

        for (let i = 1; i < docUrls.length; i++) {
            try {
                await randomSleep(500, 800);
                const documentPayload = await scrapeDocument(docUrls[i]);
                const citationsUrl = await scrapeCitations(page, docUrls[i]);
                const docId = await saveDocument(documentPayload, authorProfileId, scrapingDto.sessionId, 'dblp');
                for (let citationUrIdx in citationsUrl) {
                    await randomSleep(500, 800);
                    getCitationData(citationsUrl[citationUrIdx]).then((data) => {
                        saveCitation(data, docId, scrapingDto.sessionId, 'dblp');
                    }).catch((err) => console.log(err));
                }

            } catch (err) {
                console.error(`Could not find document payload: ${docUrls[i]} ${err}`);
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

const fetchAuthorLink = async (page: Page, firstName: string, lastName: string) => {
    await page.goto(`https://dblp.org/search?q=${firstName}+${lastName}`);
    await page.waitForSelector('#completesearch-authors', {timeout: 10000});
    await randomSleep(500, 1000);

    return await page.evaluate(() => {
        const authorLink = document.querySelector('a[href^="https://dblp.org/pid/"]');
        return authorLink?.getAttribute('href') || null;
    });
}

const getDocUrls = async (page: Page) => {

    return page.evaluate(() => {
        return Array.from(document.querySelectorAll('ul.publ-list > li.entry')).map(listElement => {
            return listElement.querySelectorAll('ul > li.drop-down')[1]
                .querySelector('div.body')
                ?.querySelector('ul > li:last-child'
                )?.querySelector('a')
                ?.getAttribute('href');
        })
    })

}

const scrapeDocument = async (docUrl: any): Promise<DocumentPayload> => {
    const xmlResponse = await fetch(docUrl);
    const xmlText = await xmlResponse.text();
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
    });
    const json = parser.parse(xmlText);
    const record = json.dblp.article ?? json.dblp.inproceedings ?? json.dblp.incollection ?? {};

    return {
        title: record.title ?? null,
        publicationDate: record.year ?? null,
        coAuthorsNames: Array.isArray(record.author)
            ? record.author
            : record.author ? [record.author] : [],
        issued: record.year ?? null,
        volume: record.volume ?? null,
        issue: record.number ?? null,
        pages: record.pages ?? null,
        publisher: record.publisher ?? null,
        description: record.note ?? null,
        link: record.ee ?? null,
        citationsUrl: null,
    };
};

const scrapeCitations = async (page : Page, docUrl: any): Promise<string[]> => {

    const docCitations = docUrl.substring(0, docUrl.length - 3) + "html";
    await page.goto(docCitations);
    await randomSleep(500, 1000);

    const loadRefs = await page.$('#references-load input');
    if (loadRefs) {
        const isChecked = await loadRefs.getProperty('checked');
        const chkd = await isChecked.jsonValue();
        if (!chkd) {
            await loadRefs.click()
        }
    }
    await page.waitForSelector('#publ-references-section', {timeout: 10000});

    return await page.evaluate(() => {
        return Array.from(document.querySelectorAll('ul.publ-list > li.entry')).map(listElement => {
            return listElement.querySelectorAll('ul > li.drop-down')[1]
                .querySelector('div.body')
                ?.querySelector('ul > li:last-child')
                ?.querySelector('a')
                ?.getAttribute('href');
        }).filter(url => url !== null && url !== undefined) ?? [];
    });
}

const getCitationData = async (citationUrl: string): Promise<CitationPayload> => {
    const xmlResponse = await fetch(citationUrl);
    const xmlText = await xmlResponse.text();
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
    });
    const json = parser.parse(xmlText);
    const record = json.dblp.article ?? json.dblp.inproceedings ?? json.dblp.incollection ?? {};

    return {
        title: record.title ?? null,
        citationLink: record.ee ?? null,
        pdfLink: null
    };
}

export default startDblpScraping