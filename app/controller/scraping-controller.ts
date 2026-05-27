import express, {Request, Response} from 'express';
import {ScrapingPayload, ScrapingQuery} from "../dto/scraping-dto";
import {scrapeAuthorData, scrapeCitationData, scrapeDocument2} from "../service/google-scholar-scraping-service";
import {ScrapingResponse} from "../model/scraping-response";
import startDblpScraping, {scrapeDocument2DBLP} from "../service/dblp-scraping-service";

const router = express.Router();

const MAX_RETRIES_SCRAPING = 5;

router.post<{}, ScrapingResponse | { error: string }, ScrapingPayload, ScrapingQuery>('/execute', async (req, res): Promise<void> => {
    const { actionType } = req.query;
    const { payload, refId } = req.body;

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

    const handlers: Record<string, (payload: string, refId: string) => Promise<ScrapingResponse>> = {
        FIND_AUTHOR: scrapeAuthorData,
        DOCUMENT: scrapeDocument2,
        CITATIONS_GS: scrapeCitationData,
        DOCUMENT_DBLP: scrapeDocument2DBLP,
        FIND_AUTHOR_DBLP: startDblpScraping,
    };

    const handler = handlers[actionType as string];

    if (!handler) {
        res.status(400).json({ error: `Unsupported actionType: ${actionType}` });
        return
    }

    let lastError: unknown;

    for (let i = 0; i < MAX_RETRIES_SCRAPING; i++) {
        try {
            const response = await handler(payload, refId);
            res.json(response);
            return;
        } catch (err) {
            lastError = err;
            console.error(`Scraping attempt ${i + 1} failed`, err);
        }
    }

    res.status(500).json({
        error: lastError instanceof Error ? lastError.message : 'Scraping failed',
    });
})

export default router;