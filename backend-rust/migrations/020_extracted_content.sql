-- Store extracted content from uploaded files (process-and-discard approach).
-- Original files are no longer written to disk; only the extracted text is kept.
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS extracted_content TEXT DEFAULT '';
