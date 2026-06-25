export interface CitationRecordResponse {
    oci: string;
    citing: string;
    cited: string;
    creation: string;
    timespan: string;
    journal_sc: "yes" | "no";
    author_sc: "yes" | "no";
}