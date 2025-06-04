import express from 'express';
import type { Request, Response } from 'express';
import WosScrapingDto from "../dto/wos-scraping-dto";
import startWosScraping from "../service/wos-scraping-service"

const router = express.Router();

router.post('/wos', async (req: Request<{}, {}, WosScrapingDto>, res: Response)  => {
    const triggerScraping = async (): Promise<void> => {
        startWosScraping(req.body);
    }
    triggerScraping()
        .then(r => console.log('scraping-finished', r))
        .catch(err => console.error(err));

    res.json({ status: 'OK', message: 'Scraping started in background' });
})

export default router;