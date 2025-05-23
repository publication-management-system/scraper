import { v4 as uuidv4 } from 'uuid';

export type DataSource = 'google_scholar' | 'dblp' | 'web_of_science' | 'scopus';

export type EntityType = 'author' | 'document' | 'citation' | 'topic';

export interface ScrapedEntity {
    id: string;
    sessionId: string;
    parentId: string | null;
    type: EntityType;
    dataSource: DataSource;
    payload: string;
    scrapedAt: Date | null;
}