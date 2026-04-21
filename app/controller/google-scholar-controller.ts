import express from 'express';
import type { Request, Response } from 'express';
import {ScrapingQuery, ScrapingPayload, GoogleScholarScrapingDto} from "../dto/google-scholar-scraping-dto";
import startGoogleScholarScraping, {
    scrapeAuthorData, scrapeCitationData,
    scrapeDocument2
} from "../service/google-scholar-scraping-service";

const router = express.Router();

router.post('/google-scholar', async (req: Request<{}, {}, GoogleScholarScrapingDto>, res: Response)  => {
    const triggerScraping = async (): Promise<void> => {
        startGoogleScholarScraping(req.body);
    }
    triggerScraping()
        .then(r => console.log('scraping-finished', r))
        .catch(err => console.error(err));

    res.json({ status: 'OK', message: 'Scraping started in background' });
})

router.post('/execute', async (req: Request<{}, ScrapingQuery, ScrapingPayload>, res: Response)  => {
    const { actionType, refId } = req.query;
    const { payload } = req.body;

    for (let i = 0; i < 3; ++i) {
        if (actionType === 'FIND_AUTHOR') {
            try {
                const profileData = await scrapeAuthorData(payload, refId as string);
                res.json(profileData);
                break;
            } catch (err) {
                console.error(err);
            }
        }

        if (actionType === 'DOCUMENT') {
            try {
                const profileData = await scrapeDocument2(payload, refId as string);
                res.json(profileData);
                break;
            } catch (err) {
                console.error(err);
            }
        }

        if (actionType === 'CITATIONS_GS') {
            try{
                const profileData = await scrapeCitationData(payload, refId as string);
                res.json(profileData);
                break;
            } catch (err) {
                console.error(err);
            }
        }
    }
})

export default router;