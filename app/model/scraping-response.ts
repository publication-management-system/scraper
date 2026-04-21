export interface QueueItem {
    link: string;
    type: 'FIND_AUTHOR' | 'DOCUMENT' | 'CITATIONS_GS' | 'CITATION';
}

export interface ScrapingResponse {
    data: string;
    queueItems: QueueItem[];
    refId: string;
}
