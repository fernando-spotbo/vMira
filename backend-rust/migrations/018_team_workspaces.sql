-- Add organization_id to conversations
ALTER TABLE conversations ADD COLUMN organization_id UUID REFERENCES organizations(id);
CREATE INDEX idx_conversations_org ON conversations(organization_id);

-- Add organization_id to projects
ALTER TABLE projects ADD COLUMN organization_id UUID REFERENCES organizations(id);
CREATE INDEX idx_projects_org ON projects(organization_id);

-- Backfill: assign existing conversations to each user's personal org
UPDATE conversations
SET organization_id = users.active_organization_id
FROM users
WHERE conversations.user_id = users.id
  AND conversations.organization_id IS NULL;

-- Backfill: assign existing projects to each user's personal org
UPDATE projects
SET organization_id = users.active_organization_id
FROM users
WHERE projects.user_id = users.id
  AND projects.organization_id IS NULL;
