-- Organizations table
CREATE TABLE organizations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(128) NOT NULL,
    slug            VARCHAR(128) NOT NULL UNIQUE,
    owner_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_personal     BOOLEAN NOT NULL DEFAULT false,
    plan            VARCHAR(32) NOT NULL DEFAULT 'free',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_organizations_owner ON organizations(owner_id);

-- Organization members (join table with roles)
CREATE TABLE organization_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            VARCHAR(32) NOT NULL DEFAULT 'member',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);

-- Add active_organization_id to users
ALTER TABLE users ADD COLUMN active_organization_id UUID REFERENCES organizations(id);

-- Backfill: create a personal org for every existing user
DO $$
DECLARE
    u RECORD;
    org_id UUID;
BEGIN
    FOR u IN SELECT id, name FROM users LOOP
        org_id := gen_random_uuid();

        INSERT INTO organizations (id, name, slug, owner_id, is_personal, plan)
        VALUES (org_id, u.name, 'personal-' || u.id::text, u.id, true, 'free');

        INSERT INTO organization_members (organization_id, user_id, role)
        VALUES (org_id, u.id, 'owner');

        UPDATE users SET active_organization_id = org_id WHERE id = u.id;
    END LOOP;
END $$;
