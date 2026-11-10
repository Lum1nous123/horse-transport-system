ALTER TABLE horse_documents
    ADD COLUMN correction_window_no integer NOT NULL DEFAULT 0;

UPDATE horse_documents
SET correction_window_no = 1
WHERE correction_deadline_at IS NOT NULL;

ALTER TABLE horse_documents
    ADD CONSTRAINT chk_horse_documents_correction_window_no
    CHECK (correction_window_no BETWEEN 0 AND 2);
