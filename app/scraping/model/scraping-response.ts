export interface QueueItem {
    link: string;
    type: 'FIND_AUTHOR' | 'DOCUMENT' | 'CITATIONS_GS' | 'CITATION' | 'FIND_AUTHOR_DBLP' | 'CITATIONS_DBLP';
}

export interface ScrapingResponse {
    data: string;
    queueItems: QueueItem[];
    refId: string;
}
