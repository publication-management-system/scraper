import express from 'express';
import type { Request, Response } from 'express';
import DblpScrapingDto from "../dto/dblp-scraping-dto";
import startDblpScraping from "../service/dblp-scraping-service";

const router = express.Router();

router.post('/dblp', async (req: Request<{}, {}, DblpScrapingDto>, res: Response)  => {
    const triggerScraping = async (): Promise<void> => {
        startDblpScraping(req.body);
    }
    triggerScraping()
        .then(r => console.log('scraping-finished', r))
        .catch(err => console.error(err));

    res.json({ status: 'OK', message: 'Scraping started in background' });
})

export default router;