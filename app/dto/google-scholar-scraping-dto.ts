export interface GoogleScholarScrapingDto {
    firstName: string;
    lastName: string;
    sessionId: string;
}

export interface ScrapingQuery {
    actionType: string;
    refId: string;
}

export interface ScrapingPayload {
    payload: string;
}