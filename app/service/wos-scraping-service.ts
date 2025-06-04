import {Page} from "puppeteer";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import puppeteer from "puppeteer-extra";
import {randomSleep} from "./browser-utils";
import {XMLParser} from "fast-xml-parser";
import {DocumentPayload} from "../model/document-payload";
import {AuthorProfilePayload} from "../model/author-profile-payload";
import {saveAuthorProfile, saveCitation, saveDocument} from "./scraping-service";
import {CitationPayload} from "../model/citation-payload";
import WosScrapingDto from "../dto/wos-scraping-dto";

puppeteer.use(StealthPlugin());

const startWosScraping = async (scrapingDto: WosScrapingDto) => {
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

        const authorProfile : AuthorProfilePayload = {
            firstName: scrapingDto.firstName,
            lastName: scrapingDto.lastName,
        }

        const authorProfileId = await saveAuthorProfile(authorProfile, scrapingDto.sessionId, 'web_of_science');

        const authorLink = await loginWos(page, scrapingDto);

        const pageOfPub = await getPageOfPublicatoins(page, authorLink);

        console.log(pageOfPub);

    }

    catch (error) {
        console.error(error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }

}

const loginWos = async (page: Page, scrapingDto : WosScrapingDto) => {
    await page.goto(`https://access.clarivate.com/login?app=wos&alternative=true&shibShireURL=https:%2F%2Fwww.webofknowledge.com%2F%3Fauth%3DShibboleth&shibReturnURL=https:%2F%2Fwww.webofknowledge.com%2F&roaming=true`);
    await page.type('#mat-input-0', "ginjucristi@gmail.com");
    await page.type('#mat-input-1', "Macac1234!!!");
    await page.click('#signIn-btn');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 })
    await randomSleep(2000, 4000);
    let el = await page.$('div.cdk-overlay-container');
    await el?.evaluate((el) => el.style.display = 'none');
    await page.waitForSelector("#snSearchType", {timeout: 10000});


    return await getAuthorLink(page, scrapingDto);
}

const getAuthorLink = async (page: Page, scrapingDto : WosScrapingDto)=> {
    await page.type("#mat-input-0", scrapingDto.lastName);
    await randomSleep(2000, 5000);
    await page.type("#mat-input-1", scrapingDto.firstName);
    await page.click("div.button-row > button:last-of-type");
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
        page.waitForSelector('div.wat-author-record-page', { timeout: 30000 })
    ]);
    // await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 })
    // await page.waitForSelector("div.wat-author-record-page", {timeout: 10000});
    return page.url()
}

const getPageOfPublicatoins = async (page: Page, authorLink: string) => {
    await page.goto(authorLink);
    return page.evaluate(() => {
        return Array.from(document.querySelectorAll("app-record")).map(listElement => {
            return listElement.querySelector("a")?.getAttribute("href");
        })
    })
}

export default startWosScraping;