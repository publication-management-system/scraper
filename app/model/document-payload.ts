export interface DocumentPayload {
    title: string | null;
    publicationDate: string | null;
    coAuthorsNames: string[];
    issued: string | null;
    volume: string | null;
    issue: string | null;
    pages: string | null;
    publisher: string | null;
    description: string | null;
    links: string[];
    citationsUrl: string | null;
}