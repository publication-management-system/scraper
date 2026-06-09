import express from "express";
import dotenv from 'dotenv';
import scraping from './app/controller/scraping-controller';
import fs from 'fs';
import {createBrowser} from "./app/config/browser";

if (fs.existsSync('.env.local')) {
    dotenv.config({ path: '.env.local' });
} else {
    dotenv.config();
}

const PORT = process.env.PORT || 5000;

const app = express();

app.use(express.json());

app.use('/scraping', scraping);

(async function (): Promise<void> {
    await createBrowser();
    app.listen(PORT, () => console.log(`Scraping server started on port ${PORT}`));
})();