"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  Users,
  Crown,
  Shield,
  User,
  Plus,
  Trash2,
  Building2,
} from "lucide-react";
import { t } from "@/lib/i18n";
import { useAuth } from "@/context/AuthContext";
import { apiCall } from "@/lib/api-client";

// ── Types ──────────────────────────────────────────────────────────────

interface Org {
  id: string;
  name: string;
  slug: string;
  is_personal: boolean;
  member_count: number;
  role: "owner" | "admin" | "member";
}

interface OrgMember {
  user_id: string;
  name: string;
  email: string | null;
  role: "owner" | "admin" | "member";
  joined_at: string;
}

interface OrgSettingsPageProps {
  onBack: () => void;
}

// ── Role badge colors ──────────────────────────────────────────────────

const roleBadge: Record<string, { bg: string; text: string; icon: typeof Crown }> = {
  owner: { bg: "bg-[#10a37f]/15", text: "text-[#10a37f]", icon: Crown },
  admin: { bg: "bg-[#f59e0b]/15", text: "text-[#f59e0b]", icon: Shield },
  member: { bg: "bg-white/[0.06]", text: "text-white/50", icon: User },
};

function RoleBadge({ role }: { role: string }) {
  const cfg = roleBadge[role] || roleBadge.member;
  const Icon = cfg.icon;
  const label = t(`org.role.${role}`) || role;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium ${cfg.bg} ${cfg.text}`}>
      <Icon size={12} strokeWidth={2} />
      {label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ── OrgSettingsPage (router between list and detail)
// ═══════════════════════════════════════════════════════════════════════

export default function OrgSettingsPage({ onBack }: OrgSettingsPageProps) {
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);

  if (activeOrgId) {
    return (
      <OrgDetail
        orgId={activeOrgId}
        onBack={() => setActiveOrgId(null)}
      />
    );
  }

  return (
    <OrgList
      onSelectOrg={(id) => setActiveOrgId(id)}
      onBack={onBack}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ── Org List View
// ═══════════════════════════════════════════════════════════════════════

function OrgList({
  onSelectOrg,
  onBack,
}: {
  onSelectOrg: (id: string) => void;
  onBack: () => void;
}) {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [creating, setCreating] = useState(false);

  const loadOrgs = useCallback(async () => {
    setLoading(true);
    const res = await apiCall<Org[]>("/organizations");
    if (res.ok && Array.isArray(res.data)) {
      setOrgs(res.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  const handleCreate = async () => {
    const name = newName.trim();
    const slug = newSlug.trim();
    if (!name || !slug) return;
    setCreating(true);
    const res = await apiCall<Org>("/organizations", {
      method: "POST",
      body: JSON.stringify({ name, slug }),
    });
    if (res.ok) {
      setNewName("");
      setNewSlug("");
      setShowCreate(false);
      await loadOrgs();
    }
    setCreating(false);
  };

  return (
    <div className="flex h-full flex-col bg-[#161616]">
      {/* ── Header ── */}
      <div className="shrink-0 px-5 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-[13px] text-white/40 hover:text-white/70 transition-colors md:hidden"
            >
              <ArrowLeft size={16} strokeWidth={1.8} />
            </button>
            <h1 className="text-[18px] font-semibold text-white">
              {t("org.settings")}
            </h1>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-white/[0.06] px-4 py-2 text-[14px] font-medium text-white/80 hover:bg-white/[0.10] hover:text-white transition-colors"
          >
            <Plus size={15} strokeWidth={2} />
            <span>{t("org.createNew")}</span>
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-5 pb-10">
          {/* Loading state */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="h-6 w-6 rounded-full border-2 border-white/10 border-t-white/50 animate-spin" />
            </div>
          ) : orgs.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-24">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.03] mb-5">
                <Building2 size={28} strokeWidth={1.4} className="text-white/15" />
              </div>
              <p className="text-[16px] text-white/25">No organizations yet</p>
              <p className="text-[14px] text-white/15 mt-1.5 text-center max-w-xs">
                Create an organization to collaborate with your team
              </p>
            </div>
          ) : (
            /* Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {orgs.map((org) => (
                <button
                  key={org.id}
                  onClick={() => onSelectOrg(org.id)}
                  className="group relative text-left rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1] p-5 transition-all duration-200"
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <h3 className="text-[15px] font-medium text-white leading-snug pr-2 line-clamp-2">
                      {org.name}
                    </h3>
                    {org.is_personal && (
                      <span className="shrink-0 inline-flex items-center rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/40">
                        {t("org.personal")}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-white/25 mb-4">/{org.slug}</p>

                  <div className="flex items-center gap-3">
                    <RoleBadge role={org.role} />
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center gap-1.5">
                    <Users size={12} strokeWidth={1.8} className="text-white/20" />
                    <span className="text-[13px] text-white/20">
                      {org.member_count} {org.member_count === 1 ? "member" : "members"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Create org form (inline modal) */}
          {showCreate && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="w-full max-w-md mx-4 rounded-2xl border border-white/[0.08] bg-[#1a1a1a] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.6)]">
                <h2 className="text-[16px] font-semibold text-white mb-5">
                  {t("org.createNew")}
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[13px] text-white/40 mb-1.5">
                      {t("org.name")}
                    </label>
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="My Team"
                      className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-[14px] text-white placeholder-white/20 focus:outline-none focus:border-white/[0.15] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] text-white/40 mb-1.5">
                      {t("org.slug")}
                    </label>
                    <input
                      value={newSlug}
                      onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                      placeholder="my-team"
                      className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-[14px] text-white placeholder-white/20 focus:outline-none focus:border-white/[0.15] transition-colors"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => { setShowCreate(false); setNewName(""); setNewSlug(""); }}
                    className="rounded-lg bg-white/[0.06] px-4 py-2 text-[14px] text-white/70 hover:bg-white/[0.10] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={creating || !newName.trim() || !newSlug.trim()}
                    className="rounded-lg bg-white/[0.10] px-4 py-2 text-[14px] font-medium text-white hover:bg-white/[0.15] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {creating ? "Creating..." : t("org.createNew")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ── Org Detail View
// ═══════════════════════════════════════════════════════════════════════

function OrgDetail({
  orgId,
  onBack,
}: {
  orgId: string;
  onBack: () => void;
}) {
  const { user } = useAuth();

  const [org, setOrg] = useState<Org | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);

  const [inviteUserId, setInviteUserId] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const canManage = org?.role === "owner" || org?.role === "admin";

  const loadData = useCallback(async () => {
    setLoading(true);
    const [orgsRes, membersRes] = await Promise.all([
      apiCall<Org[]>("/organizations"),
      apiCall<OrgMember[]>(`/organizations/${orgId}/members`),
    ]);

    if (orgsRes.ok && Array.isArray(orgsRes.data)) {
      const found = orgsRes.data.find((o) => o.id === orgId);
      if (found) setOrg(found);
    }
    if (membersRes.ok && Array.isArray(membersRes.data)) {
      setMembers(membersRes.data);
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleInvite = async () => {
    const uid = inviteUserId.trim();
    if (!uid) return;
    setInviting(true);
    const res = await apiCall(`/organizations/${orgId}/members`, {
      method: "POST",
      body: JSON.stringify({ user_id: uid, role: inviteRole }),
    });
    if (res.ok) {
      setInviteUserId("");
      setInviteRole("member");
      await loadData();
    }
    setInviting(false);
  };

  const handleRemove = async (userId: string) => {
    setRemoving(userId);
    const res = await apiCall(`/organizations/${orgId}/members/${userId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
    }
    setRemoving(null);
  };

  return (
    <div className="flex h-full flex-col bg-[#161616]">
      {/* ── Header ── */}
      <div className="shrink-0 px-5 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center h-14">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[13px] text-white/40 hover:text-white/70 transition-colors"
          >
            <ArrowLeft size={14} strokeWidth={1.8} />
            {t("org.settings")}
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-5 pb-10">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="h-6 w-6 rounded-full border-2 border-white/10 border-t-white/50 animate-spin" />
            </div>
          ) : (
            <>
              {/* Org title */}
              <div className="flex items-start gap-3 mb-8">
                <div className="flex-1 min-w-0">
                  <h1 className="text-[22px] font-semibold text-white leading-tight">
                    {org?.name}
                  </h1>
                  <p className="text-[14px] text-white/25 mt-1">/{org?.slug}</p>
                </div>
                {org?.is_personal && (
                  <span className="shrink-0 inline-flex items-center rounded-md bg-white/[0.06] px-2.5 py-1 text-[12px] text-white/40 mt-1">
                    {t("org.personal")}
                  </span>
                )}
                {org && <RoleBadge role={org.role} />}
              </div>

              {/* Members section */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <div className="flex items-center justify-between px-5 py-4">
                  <h3 className="text-[15px] font-medium text-white flex items-center gap-2">
                    <Users size={16} strokeWidth={1.8} className="text-white/40" />
                    {t("org.members")}
                    <span className="text-[13px] text-white/20 font-normal">({members.length})</span>
                  </h3>
                </div>

                {members.length === 0 ? (
                  <div className="px-5 pb-5">
                    <p className="text-[13px] text-white/20 text-center py-6">
                      {t("org.noMembers")}
                    </p>
                  </div>
                ) : (
                  <div className="px-5 pb-3">
                    <div className="space-y-1">
                      {members.map((member) => (
                        <div
                          key={member.user_id}
                          className="group/member flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-white/[0.03] transition-colors"
                        >
                          {/* Avatar placeholder */}
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/40">
                            <User size={16} strokeWidth={1.8} />
                          </div>

                          {/* Name + email */}
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] text-white leading-snug truncate">
                              {member.name}
                              {member.user_id === user?.id && (
                                <span className="text-white/20 ml-1.5">(you)</span>
                              )}
                            </p>
                            {member.email && (
                              <p className="text-[13px] text-white/30 truncate mt-0.5">
                                {member.email}
                              </p>
                            )}
                          </div>

                          {/* Role badge */}
                          <RoleBadge role={member.role} />

                          {/* Remove button */}
                          {canManage && member.role !== "owner" && member.user_id !== user?.id && (
                            <button
                              onClick={() => handleRemove(member.user_id)}
                              disabled={removing === member.user_id}
                              className="shrink-0 opacity-0 group-hover/member:opacity-100 flex h-8 w-8 items-center justify-center rounded-lg text-white/20 hover:text-red-400 hover:bg-white/[0.06] transition-all disabled:opacity-40"
                              title={t("org.remove")}
                            >
                              {removing === member.user_id ? (
                                <div className="h-3.5 w-3.5 rounded-full border-2 border-white/10 border-t-white/50 animate-spin" />
                              ) : (
                                <Trash2 size={14} strokeWidth={1.8} />
                              )}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Invite form */}
                {canManage && (
                  <div className="border-t border-white/[0.06] px-5 py-4">
                    <h4 className="text-[13px] font-medium text-white/50 mb-3">
                      {t("org.invite")}
                    </h4>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        value={inviteUserId}
                        onChange={(e) => setInviteUserId(e.target.value)}
                        placeholder="User ID or email"
                        className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-[14px] text-white placeholder-white/20 focus:outline-none focus:border-white/[0.15] transition-colors"
                      />
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as "admin" | "member")}
                        className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-[14px] text-white focus:outline-none focus:border-white/[0.15] transition-colors appearance-none cursor-pointer sm:w-32"
                      >
                        <option value="member">{t("org.role.member")}</option>
                        <option value="admin">{t("org.role.admin")}</option>
                      </select>
                      <button
                        onClick={handleInvite}
                        disabled={inviting || !inviteUserId.trim()}
                        className="flex items-center justify-center gap-2 rounded-lg bg-white/[0.06] px-4 py-2 text-[14px] font-medium text-white/80 hover:bg-white/[0.10] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed sm:w-auto"
                      >
                        {inviting ? (
                          <div className="h-4 w-4 rounded-full border-2 border-white/10 border-t-white/50 animate-spin" />
                        ) : (
                          <>
                            <Plus size={15} strokeWidth={2} />
                            <span>{t("org.invite")}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
