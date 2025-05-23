import {AuthorProfilePayload} from "../model/author-profile-payload";
import {DataSource, EntityType, ScrapedEntity} from "../model/scraped-entity";
import {v4 as uuidv4} from 'uuid';
import {saveScrapedEntity} from "../repository/scraping-entity-repository";
import {DocumentPayload} from "../model/document-payload";
import {CitationPayload} from "../model/citation-payload";

export const saveAuthorProfile = async (profilePayload: AuthorProfilePayload,
                                        sessionId: string, dataSource: DataSource) => {
    return await saveEntity(JSON.stringify(profilePayload), dataSource, null, 'author', sessionId);
}

export const saveDocument = async (documentPayload: DocumentPayload, profileId: string,
                            sessionId: string, dataSource: DataSource) => {
    return await saveEntity(JSON.stringify(documentPayload), dataSource, profileId, 'document', sessionId);
}

export const saveCitation = async (citationsPayload: CitationPayload, docId: string,
                            sessionId: string, dataSource: DataSource) => {
    return await saveEntity(JSON.stringify(citationsPayload), dataSource, docId, 'citation', sessionId);
}

const saveEntity = async (jsonPayload: string,
                          dataSource: DataSource, parentId: string | null, type: EntityType, sessionId: string) => {
    let id = uuidv4();

    let scrapedEntity: ScrapedEntity = {
        id: id,
        dataSource: dataSource,
        parentId: parentId,
        payload: jsonPayload,
        sessionId: sessionId,
        type: type,
        scrapedAt: new Date()
    }

    await saveScrapedEntity(scrapedEntity);

    console.log(`saved scraped entity ${scrapedEntity}`);

    return id;
}