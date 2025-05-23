import express from 'express';
import type { Request, Response } from 'express';
import GoogleScholarScrapingDto from "../dto/google-scholar-scraping-dto";
import startGoogleScholarScraping from "../service/google-scholar-scraping-service";

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

export default router;