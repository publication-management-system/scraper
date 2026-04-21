import puppeteer from "puppeteer-extra";
import {Browser} from "puppeteer";

let browser: Browser | undefined = undefined;

export async function createBrowser() {
    browser = await puppeteer.launch({
        headless: false,
        args: [`--proxy-server=${process.env.PROXY_URL}`],
        defaultViewport: {width: 1280, height: 800},
    });
}

export function getBrowser(): Browser {
    if (!browser) {
        throw new Error("Browser doesn't exist");
    }

    return browser;
}