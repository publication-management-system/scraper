import {AppRoutes} from "../../common/app.routes";
import express from "express";
import e from "express";
import {ScrapingController} from "../controller/scraping.controller";


export class ScrapingRoutes extends AppRoutes {
    scrapingController: ScrapingController;

    constructor(app: express.Application, scrapingController: ScrapingController) {
        super(app);
        this.scrapingController = scrapingController;
    }

    configureRoutes(): e.Application {
        this.app.route("/scraping/execute")
            .post(this.scrapingController.executeScraping.bind(this.scrapingController))

        console.info("[ScrapingRoutes] configured routes");

        return this.app;
    }
}