-- Add instructions field to projects
ALTER TABLE projects ADD COLUMN instructions TEXT;

-- Project files table
CREATE TABLE project_files (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    filename        VARCHAR(512) NOT NULL,
    original_filename VARCHAR(512) NOT NULL,
    mime_type       VARCHAR(128) NOT NULL,
    size_bytes      BIGINT NOT NULL DEFAULT 0,
    storage_path    TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_files_project ON project_files(project_id);
