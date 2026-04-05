# Team Workspaces Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Scope conversations, projects, and code sessions to organizations so team members share a workspace when using a team org, while personal orgs remain private.

**Architecture:** Migration adds `organization_id` to conversations and projects tables with backfill. Rust backend queries filter by org instead of user. Web app adds org switcher to sidebar and org settings page. On org switch, data reloads.

**Tech Stack:** Rust (Axum, SQLx, PostgreSQL), TypeScript (Next.js, React, Tailwind)

---

## Task 1: Migration — add organization_id to conversations and projects

**Files:**
- Create: `backend-rust/migrations/018_team_workspaces.sql`

## Task 2: Update Rust models (Conversation, Project) with organization_id

**Files:**
- Modify: `backend-rust/src/models/conversation.rs`
- Modify: `backend-rust/src/models/project.rs`

## Task 3: Update chat routes — scope by organization_id

**Files:**
- Modify: `backend-rust/src/routes/chat.rs`

Change all `WHERE user_id = $1` to `WHERE organization_id = $1` for list/get queries.
Keep `user_id` on INSERT (tracks who created it).
On create, set `organization_id = user.active_organization_id`.
On get/update/delete, verify via `organization_id` + org membership.

## Task 4: Update project routes — scope by organization_id

**Files:**
- Modify: `backend-rust/src/routes/projects.rs`

Same pattern as chat routes.

## Task 5: Web app — org switcher in sidebar + org settings page

**Files:**
- Modify: `src/components/Sidebar.tsx` — org switcher dropdown
- Create: `src/components/OrgSettingsPage.tsx` — members list, invite, role management
- Modify: `src/context/ChatContext.tsx` — reload data on org switch
- Modify: `src/context/AuthContext.tsx` — switchOrg function
- Modify: `src/lib/i18n.tsx` — new translation keys
- Modify: `src/app/chat/[[...id]]/page.tsx` — wire OrgSettingsPage

## Task 6: Commit and push everything
