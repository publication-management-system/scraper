import express from "express";
import dotenv from 'dotenv';
import gs from './app/controller/google-scholar-controller';
import dblp from './app/controller/dblp-controller';
import fs from 'fs';

if (fs.existsSync('.env.local')) {
    dotenv.config({ path: '.env.local' });
} else {
    dotenv.config();
}

const PORT = process.env.PORT || 5000;

const app = express();
app.use(express.json());

app.use('/scraping', gs)

app.use('/scraping', dblp)

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
