import express from "express";
import dotenv from 'dotenv';
import fs from 'fs';
import {createBrowser} from "./app/config/browser";
import {AppRoutes} from "./app/common/app.routes";
import {ScrapingRoutes} from "./app/scraping/routes/scraping.routes";
import {GoogleScholarScrapingService} from "./app/scraping/service/google-scholar-scraping.service";
import {ScrapingController} from "./app/scraping/controller/scraping.controller";
import {DblpScrapingService} from "./app/scraping/service/dblp-scraping-service";

if (fs.existsSync('.env.local')) {
    dotenv.config({ path: '.env.local' });
} else {
    dotenv.config();
}

const app: express.Application = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

const routes: Array<AppRoutes> = [];
const scrapingController = new ScrapingController(
    new GoogleScholarScrapingService(),
    new DblpScrapingService(),
);

routes.push(new ScrapingRoutes(app, scrapingController));
routes.forEach(r => r.configureRoutes());

(async function (): Promise<void> {
    await createBrowser();
    app.listen(PORT, () => console.log(`Scraping server started on port ${PORT}`));
})();