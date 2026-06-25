import {Page} from "puppeteer";
import {ScrapingResponse} from "../model/scraping-response";
import {getBrowser} from "../../config/browser";
import {AuthorProfilePayload} from "../model/author-profile-payload";
import {DocumentPayload} from "../model/document-payload";
import {normalizeDate} from "../utils/scraping-utils";
import {CitationPayload} from "../model/citation-payload";
import axios from "axios";
import {XMLParser} from "fast-xml-parser";
import {CitationRecordResponse} from "../model/dblp-models";

const DBLP_URL = `https://dblp.dagstuhl.de`;
const CITATIONS_API_URL = `https://api.opencitations.net/index/v1/citations`;

export class DblpScrapingService {
    async scrapeAuthorProfile(payload: string, refId: string): Promise<ScrapingResponse> {
        console.info(`[DblpScrapingService] Scraping author profile, payload=${payload} refId=${refId}`);
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

            let authorLink = await this.fetchAuthorLink(page, firstName, lastName) + ".xml";

            if (authorLink === "null.xml") {
                throw new Error("Could not find author id for dblp");
            }

            authorLink = authorLink.replace("https://dblp.org", DBLP_URL);

            const profileData = await this.getProfileData(authorLink);
            const authorProfilePayload: AuthorProfilePayload = {...profileData};

            return {
                data: JSON.stringify(authorProfilePayload),
                queueItems: profileData.docUrls.map((docUrl: string) => ({
                    link: docUrl,
                    type: 'DOCUMENT_DBLP'
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

    async scrapeDocument(payload: string, refId: string): Promise<ScrapingResponse> {
        console.info(`[DblpScrapingService] Scraping author document, payload=${payload} refId=${refId}`);
        let {url} = JSON.parse(payload) as {
            url: string
        };

        url.replace("https://dblp.org", DBLP_URL)

        const documentPayload = await this.scrapeDocumentData(url);
        const documentResponsePayload: DocumentPayload = {...documentPayload};

        return {
            data: JSON.stringify(documentResponsePayload),
            queueItems: documentPayload.citationsUrl ? [{
                link: documentPayload.citationsUrl,
                type: 'CITATIONS_DBLP'
            }] : [],
            refId
        }
    }

    async scrapeCitations(payload: string, refId: string): Promise<ScrapingResponse> {

        let {url} = JSON.parse(payload) as {
            url: string
        };

        url.replace("https://dblp.org", DBLP_URL)

        console.info(`[DblpScrapingService] Scraping author citations, payload=${payload} refId=${refId} finalUrl=${url}`);

        const citationsResponse = await axios.get<CitationRecordResponse[]>(url, {
            timeout: 30000,
            proxy: {
                host: process.env.PROXY_URL!.replace(":823", ''),
                port: 823,
                auth: {username: process.env.PROXY_USERNAME!, password: process.env.PROXY_PASSWORD!}
            }
        });

        const citations = citationsResponse.data.map(c => c.citing);
        let response: CitationPayload[] = [];

        for (const citation of citations) {
            try {
                const dblpDocument = `${DBLP_URL}/doi/${citation}.xml`;
                const xmlResponse = await axios.get(dblpDocument, {
                    timeout: 30000,
                    proxy: {
                        host: process.env.PROXY_URL!.replace(":823", ''),
                        port: 823,
                        auth: {username: process.env.PROXY_USERNAME!, password: process.env.PROXY_PASSWORD!}
                    }
                });
                const parser = new XMLParser({
                    ignoreAttributes: false,
                    attributeNamePrefix: '',
                });
                const json = parser.parse(await xmlResponse.data);
                const record = json.dblp.article ?? json.dblp.inproceedings ?? json.dblp.incollection ?? {};

                const rawLinks = record.ee ?? [];
                const links = Array.isArray(rawLinks)
                    ? rawLinks.map(link => typeof link === 'string' ? link : link?.['#text']).filter(Boolean)
                    : rawLinks
                        ? [typeof rawLinks === 'string' ? rawLinks : rawLinks['#text']].filter(Boolean)
                        : [];

                const citationPayload: CitationPayload = {
                    citationLink: links[0],
                    pdfLink: null,
                    refId: refId,
                    title: record.title
                };

                response = [...response, citationPayload];
            } catch (e) {
                console.error(e);
            }
        }

        return {
            data: JSON.stringify(response),
            queueItems: [],
            refId
        }
    }

    private async fetchAuthorLink(page: Page, firstName: string, lastName: string) {
        const query = encodeURIComponent(`${firstName}* ${lastName}*`);
        let url = `${DBLP_URL}/search/author/api?q=${query}&format=json`;
        console.info(`[DblpScrapingService] Scraping author profile link, link=${url}`);

        const response = await axios.get(url, {
            timeout: 30000,
            proxy: {
                host: process.env.PROXY_URL!.replace(":823", ''),
                port: 823,
                auth: {username: process.env.PROXY_USERNAME!, password: process.env.PROXY_PASSWORD!}
            }
        });

        const data = await response.data;
        const hit = data?.result?.hits?.hit;

        const firstHit = Array.isArray(hit) ? hit[0] : hit;

        return firstHit?.info?.url ?? null;
    }

    private async getProfileData  (authorLink: string){
        const xmlResponse = await axios.get(authorLink, {
            timeout: 30000,
            proxy: {
                host: process.env.PROXY_URL!.replace(":823", ''),
                port: 823,
                auth: {username: process.env.PROXY_USERNAME!, password: process.env.PROXY_PASSWORD!}
            }
        });
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '',
        });
        const json = parser.parse(await xmlResponse.data);
        const author = Array.isArray(json.dblpperson.person.author)
            ? json.dblpperson.person.author[0]
            : json.dblpperson.person.author;

        const authorName = author?.['#text'] ?? author;
        const nameParts = authorName.split(' ');

        const records = Array.isArray(json.dblpperson.r) ? json.dblpperson.r : [json.dblpperson.r];

        return {
            authorName: authorName,
            firstName: nameParts[0] ?? null,
            middleName: nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : null,
            lastName: nameParts.length > 1 ? nameParts[nameParts.length - 1] : null,
            imageUrl: null,
            institution: null,
            institutionRole: null,
            email: '',
            topicElements: [],
            providerId: json.dblpperson.pid ?? json.dblpperson.person.author.pid ?? null,
            docUrls: records
                .map((r: unknown) => {
                    if (!r || typeof r !== 'object') return null;

                    const doc = Object.values(
                        r as Record<string, { key?: string }>
                    )[0];

                    return doc?.key ? `${DBLP_URL}/rec/${doc.key}.xml` : null;
                })
                .filter((url: string | null) => url !== null)
        }
    }

    private async scrapeDocumentData(documentUrl: string) {
        const xmlResponse = await axios.get(documentUrl, {
            timeout: 30000,
            proxy: {
                host: process.env.PROXY_URL!.replace(":823", ''),
                port: 823,
                auth: {username: process.env.PROXY_USERNAME!, password: process.env.PROXY_PASSWORD!}
            }
        });
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '',
        });
        const json = parser.parse(await xmlResponse.data);
        const record = json.dblp.article ?? json.dblp.inproceedings ?? json.dblp.incollection ?? {};
        const rawLinks = record.ee ?? [];
        const links = Array.isArray(rawLinks)
            ? rawLinks.map(link => typeof link === 'string' ? link : link?.['#text']).filter(Boolean)
            : rawLinks
                ? [typeof rawLinks === 'string' ? rawLinks : rawLinks['#text']].filter(Boolean)
                : [];

        const doiId = links
            .find(link => link.startsWith('https://doi.org/'))
            ?.replace('https://doi.org/', '');

        const rawAuthors = record.author
            ? Array.isArray(record.author) ? record.author : [record.author]
            : [];

        const coauthorNames = rawAuthors
            .map((author: any) => typeof author === 'string' ? author : author?.['#text'])

        return {
            title: record.title ?? null,
            publicationDate: normalizeDate(record.year) ?? null,
            coAuthorsNames: coauthorNames,
            issued: record.year ?? null,
            volume: record.volume ?? null,
            issue: record.number ?? null,
            pages: record.pages ?? null,
            publisher: record.publisher ?? null,
            description: record.note ?? null,
            links: Array.isArray(rawLinks)
                ? rawLinks.map(link => typeof link === 'string' ? link : link?.['#text']).filter(Boolean)
                : rawLinks
                    ? [typeof rawLinks === 'string' ? rawLinks : rawLinks['#text']].filter(Boolean)
                    : [],
            citationsUrl: doiId ? `${CITATIONS_API_URL}/${doiId}?format=json` : null,
            providerId: record.key,
        };
    }
}
