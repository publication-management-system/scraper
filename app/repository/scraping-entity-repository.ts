import {db} from "../config/database";
import {parse as uuidParse} from "uuid";
import {ScrapedEntity} from "../model/scraped-entity";

export const saveScrapedEntity = async (scrapedEntity: ScrapedEntity) => {
    const insertQuery = `INSERT INTO scraped_entity (id, data_source, parent_id, payload, session_id, type, scraped_at)
                         VALUES (:id, :dataSource, :parentId, :payload, :session_id, :type, :scraped_at)`;

    const insertParams = {
        id: Buffer.from(uuidParse(scrapedEntity.id)),
        dataSource: scrapedEntity.dataSource,
        parentId: scrapedEntity?.parentId != undefined ? Buffer.from(uuidParse(scrapedEntity.parentId)) : null,
        payload: scrapedEntity.payload,
        session_id: Buffer.from(uuidParse(scrapedEntity.sessionId)),
        type: scrapedEntity.type,
        scraped_at: scrapedEntity.scrapedAt
    };

    const connection = await db.getConnection();

    try {
        await connection.execute(insertQuery, insertParams);
    } finally {
        connection.release();
    }
}