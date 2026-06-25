import express from 'express';

export abstract class AppRoutes {
    app: express.Application;

    constructor(app: express.Application) {
        this.app = app;
    }

    abstract configureRoutes(): express.Application;
}