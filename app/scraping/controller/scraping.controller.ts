import express from "express";
import {ScrapingResponse} from "../model/scraping-response";
import {GoogleScholarScrapingService} from "../service/google-scholar-scraping.service";
import {DblpScrapingService} from "../service/dblp-scraping-service";
import {ScrapingPayload, ScrapingQuery} from "../dto/scraping-dto";

const MAX_RETRIES_SCRAPING = 3;

export class ScrapingController {
    constructor(private readonly gsScrapingService: GoogleScholarScrapingService,
                private readonly dblpScrapingService: DblpScrapingService) {}

    async executeScraping(req: express.Request, res: express.Response) {
        const { actionType } = (req.query as unknown) as ScrapingQuery;
        const { payload, refId } = (req.body as unknown) as ScrapingPayload;

        if (!actionType) {
            res.status(400).json({ error: 'Missing actionType' });
            return;
        }

        if (!payload) {
            res.status(400).json({ error: 'Missing payload' });
            return;
        }

        if (!refId) {
            res.status(400).json({ error: 'Missing refId' });
            return;
        }

        for (let i = 0; i < MAX_RETRIES_SCRAPING; i++) {
            try {
                const response = await this.runScrapingByActionType(actionType, payload, refId);

                console.info(`Scraping response: ${JSON.stringify(response)}`);

                res.json(response);
                return;
            } catch (err) {
                console.error(`[ScrapingController] Scraping attempt ${i + 1} actionType=${actionType}, payload=${payload}, refId=${refId} failed`, err);
            }
        }

        res.status(500).json({
            error: 'Scraping failed',
        });
    }

    async runScrapingByActionType(actionType: string, payload: string, refId: string): Promise<ScrapingResponse> {
        console.info(`[ScrapingController] Running Scraping by action type actionType=${actionType}, payload=${payload}, refId=${refId}`);
        switch (actionType) {
            case 'FIND_AUTHOR':
                return await this.gsScrapingService.scrapeAuthorProfile(payload, refId);
            case 'DOCUMENT':
                return await this.gsScrapingService.scrapeAuthorDocument(payload, refId);
            case 'CITATIONS_GS':
                return await this.gsScrapingService.scrapeCitationData(payload, refId);
            case 'FIND_AUTHOR_DBLP':
                return await this.dblpScrapingService.scrapeAuthorProfile(payload, refId);
            case 'DOCUMENT_DBLP':
                return await this.dblpScrapingService.scrapeDocument(payload, refId);
            case 'CITATIONS_DBLP':
                return await this.dblpScrapingService.scrapeCitations(payload, refId);

            default:
                throw new Error('Unsupported actionType');
        }
    }
}