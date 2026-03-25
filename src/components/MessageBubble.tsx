"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Check, ThumbsUp, ThumbsDown, RotateCcw, Pencil, ChevronLeft, ChevronRight, ChevronDown, AlertCircle, CreditCard, Clock, Globe } from "lucide-react";
import { Message, MessageStep, Attachment, MessageError, ReminderInfo } from "@/lib/types";
import CodeBlock from "./CodeBlock";
import ReasoningBlock from "./ReasoningBlock";
import ReminderCard from "./ReminderCard";
import ScheduledContentCard from "./ScheduledContentCard";
import ActionCard from "./ActionCard";
import { useStreamingText } from "@/hooks/useStreamingText";
import { t } from "@/lib/i18n";
import { useChat } from "@/context/ChatContext";
import MessageReactions from "./MessageReactions";
import PricingModal from "./PricingModal";
import AuthModal from "./AuthModal";
import FeedbackModal from "./FeedbackModal";

/** Parse [suggestions]...[/suggestions] block from message content */
function parseSuggestions(text: string): { content: string; suggestions: string[] } {
  const match = text.match(/\[suggestions\]\s*([\s\S]*?)\s*\[\/suggestions\]/);
  if (!match) return { content: text, suggestions: [] };
  const raw = match[1].trim();
  const suggestions = raw
    .split("\n")
    .map(l => l.replace(/^[-•*]\s*/, "").trim())
    .filter(l => l.length > 0)
    .slice(0, 3);
  const content = text.replace(/\[suggestions\][\s\S]*?\[\/suggestions\]/, "").trim();
  return { content, suggestions };
}
import ExternalLinkModal from "./ExternalLinkModal";

interface MessageBubbleProps {
  message: Message;
  isNew?: boolean;
  isStreaming?: boolean;
}

const UPGRADE_PLANS = [
  { id: "pro", name: "Pro", price: "199 ₽/мес", messages: "500 сообщ./день" },
  { id: "max", name: "Max", price: "990 ₽/мес", messages: "Безлимит" },
];

function ErrorBanner({ error, onUpgrade, onLogin }: { error: MessageError; onUpgrade?: () => void; onLogin?: () => void }) {
  const config = {
    rate_limit: {
      icon: <Clock size={15} />,
      accent: "text-white/60",
      bg: "bg-white/[0.03]",
      border: "border-white/[0.06]",
    },
    payment: {
      icon: <CreditCard size={15} />,
      accent: "text-white/60",
      bg: "bg-white/[0.03]",
      border: "border-white/[0.06]",
    },
    cancelled: {
      icon: <AlertCircle size={15} />,
      accent: "text-white/35",
      bg: "bg-white/[0.02]",
      border: "border-white/[0.05]",
    },
    generic: {
      icon: <AlertCircle size={15} />,
      accent: "text-white/50",
      bg: "bg-white/[0.03]",
      border: "border-white/[0.06]",
    },
  }[error.type];

  return (
    <div className="mt-1.5 space-y-2.5 error-banner-enter">
      {/* Error message */}
      <div className={`flex items-start gap-2.5 rounded-xl ${config.bg} border ${config.border} px-3.5 py-2.5`}>
        <div className={`mt-[1px] shrink-0 ${config.accent}`}>
          {config.icon}
        </div>
        <div className="min-w-0">
          <p className={`text-[13.5px] leading-relaxed ${config.accent}`}>
            {error.message}
          </p>
          {error.type === "payment" && (
            <a
              href="/platform/billing/topup"
              className="inline-flex items-center gap-1 text-[16px] text-white/50 hover:text-white/70 mt-1.5 transition-colors duration-200"
            >
              {t("error.topupCta")}
              <span className="text-[14px]">→</span>
            </a>
          )}
        </div>
      </div>

      {/* Guest limit — offer login */}
      {error.type === "rate_limit" && error.message === t("error.guestLimit") && onLogin && (
        <div className="error-banner-enter" style={{ animationDelay: "120ms" }}>
          <button
            onClick={onLogin}
            className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-[16px] text-white/60 hover:text-white/80 hover:bg-white/[0.07] transition-all"
          >
            {t("error.loginCta")} <span className="text-[14px]">→</span>
          </button>
        </div>
      )}

      {/* Upgrade cards for rate limit (authenticated users only) */}
      {error.type === "rate_limit" && error.message !== t("error.guestLimit") && (
        <div className="space-y-2 error-banner-enter" style={{ animationDelay: "120ms" }}>
          <p className="text-[16px] text-white/30">{t("error.upgradeCta")}</p>
          <div className="flex gap-2">
            {UPGRADE_PLANS.map((plan, i) => (
              <button
                key={plan.id}
                onClick={onUpgrade}
                className="upgrade-card flex-1 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 text-left error-banner-enter"
                style={{
                  animationDelay: `${180 + i * 80}ms`,
                }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-white/30" />
                  <span className="text-[16px] font-medium text-white/80">{plan.name}</span>
                </div>
                <p className="text-[16px] text-white/40">{plan.messages}</p>
                <p className="text-[16px] text-white/20 mt-0.5">{plan.price}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AssistantAvatar({ thinking = false }: { thinking?: boolean }) {
  // Track previous thinking state to play "settle" animation on exit
  const [wasThinking, setWasThinking] = useState(false);
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    if (thinking && !wasThinking) {
      setWasThinking(true);
      setSettling(false);
    } else if (!thinking && wasThinking) {
      // Transition out: play settle animation
      setSettling(true);
      setWasThinking(false);
      const timer = setTimeout(() => setSettling(false), 600);
      return () => clearTimeout(timer);
    }
  }, [thinking, wasThinking]);

  const isAnimating = thinking || settling;

  return (
    <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
      {/* Outer glow ring */}
      <div
        className="absolute inset-[-4px] rounded-full transition-opacity duration-700"
        style={{
          opacity: thinking ? 1 : 0,
          background: "radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)",
          animation: thinking ? "mira-ring-breathe 2.5s ease-in-out infinite" : "none",
        }}
      />
      {/* Avatar circle */}
      <div
        className="flex h-8 w-8 items-center justify-center rounded-full transition-all duration-700 ease-out"
        style={{ backgroundColor: thinking ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.08)" }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          className="transition-[color] duration-700 ease-out"
          style={{
            color: thinking ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.8)",
            animation: thinking
              ? "mira-star-drift 4s cubic-bezier(0.45, 0, 0.55, 1) infinite, mira-star-breathe 2s ease-in-out infinite"
              : settling
              ? "mira-star-settle 0.6s ease-out forwards"
              : "none",
            transformOrigin: "center",
          }}
        >
          <path d="M12 1Q18.5 12 12 23Q5.5 12 12 1Z" fill="currentColor"/>
          <path d="M1 12Q12 5.5 23 12Q12 18.5 1 12Z" fill="currentColor"/>
        </svg>
      </div>
    </div>
  );
}

// ── External link helpers ────────────────────────────────────

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function isExternal(href: string): boolean {
  if (!href || href === "#") return false;
  try {
    const url = new URL(href, window.location.origin);
    return url.origin !== window.location.origin;
  } catch {
    return false;
  }
}

// ── Source citations ─────────────────────────────────────────

/** Extract a flat list of sources from message steps. */
function extractSources(steps?: MessageStep[]): { title: string; domain: string; url?: string }[] {
  if (!steps) return [];
  const sources: { title: string; domain: string; url?: string }[] = [];
  for (const step of steps) {
    if (step.type === "reasoning" && step.searches) {
      for (const sq of step.searches) {
        for (const r of sq.results) {
          sources.push(r);
        }
      }
    }
  }
  return sources;
}

/**
 * Pre-process markdown to convert [1], [2] citation refs into custom HTML
 * that ReactMarkdown won't eat as link references.
 * Converts [1] → <cite-1> which we handle in the code renderer.
 */
function preprocessCitations(text: string): string {
  return text.replace(/\[(\d+)\]/g, "⟨cite:$1⟩");
}

/** Render citation markers in text as clickable superscript pills. */
function renderWithCitations(
  text: string,
  sources: { url?: string }[],
  onExternalLink?: (url: string) => void,
): React.ReactNode[] {
  if (sources.length === 0 || !text.includes("⟨cite:")) return [text];
  const parts = text.split(/(⟨cite:\d+⟩)/g);
  return parts.map((part, i) => {
    const match = part.match(/^⟨cite:(\d+)⟩$/);
    if (match) {
      const num = parseInt(match[1], 10);
      const source = sources[num - 1];
      if (source?.url) {
        return (
          <button
            key={i}
            onClick={(e) => { e.preventDefault(); onExternalLink?.(source.url!); }}
            className="inline-flex items-center justify-center h-[20px] min-w-[20px] px-1.5 rounded-md bg-white/[0.07] text-[12px] font-medium text-white/45 hover:bg-white/[0.14] hover:text-white/70 transition-colors align-super ml-0.5 cursor-pointer border-none"
            title={source.url}
          >
            {num}
          </button>
        );
      }
      return <span key={i} className="text-white/30 text-[12px] align-super ml-0.5">[{num}]</span>;
    }
    return part ? <span key={i}>{part}</span> : null;
  });
}

/** Single expandable sources badge. */
function SourcesBadge({
  sources,
  onExternalLink,
}: {
  sources: { title: string; domain: string; url?: string }[];
  onExternalLink?: (url: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (sources.length === 0) return null;

  return (
    <div className="mt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-[16px] text-white/40 hover:bg-white/[0.05] hover:border-white/[0.10] hover:text-white/55 transition-all"
      >
        <Globe size={15} className="text-white/30" />
        <span>{sources.length} {sources.length === 1 ? t("search.source") : t("search.sources")}</span>
        <ChevronDown
          size={14}
          className={`text-white/25 transition-transform duration-300 ${expanded ? "rotate-0" : "-rotate-90"}`}
        />
      </button>

      <div
        className="overflow-hidden"
        style={{
          maxHeight: expanded ? `${sources.length * 48 + 16}px` : "0px",
          opacity: expanded ? 1 : 0,
          transition: expanded
            ? "max-height 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease 0.05s"
            : "max-height 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.15s ease",
        }}
      >
        <div className="mt-2 rounded-xl border border-white/[0.05] overflow-hidden bg-white/[0.01]">
          {sources.map((s, i) => (
            <button
              key={i}
              onClick={() => s.url && onExternalLink?.(s.url)}
              className={`flex items-center gap-3 w-full text-left px-4 py-2.5 text-[16px] hover:bg-white/[0.03] transition-colors ${
                i < sources.length - 1 ? "border-b border-white/[0.04]" : ""
              }`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-[12px] font-semibold text-white/30">
                {i + 1}
              </span>
              <span className="text-white/50 truncate flex-1">{s.title}</span>
              <span className="text-[16px] text-white/20 shrink-0">{s.domain}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function AttachmentGrid({ attachments }: { attachments: Attachment[] }) {
  if (!attachments || attachments.length === 0) return null;

  const images = attachments.filter((a) => IMAGE_TYPES.includes(a.mime_type));
  const files = attachments.filter((a) => !IMAGE_TYPES.includes(a.mime_type));

  return (
    <div className="mt-2 space-y-2">
      {/* Image grid */}
      {images.length > 0 && (
        <div className={`flex gap-2 flex-wrap ${images.length === 1 ? "" : "max-w-md"}`}>
          {images.map((img) => {
            const src = img.previewUrl || `/api/proxy/attachments/${img.id}`;
            return (
              <a
                key={img.id}
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-xl border border-white/[0.06] hover:border-white/[0.15] transition-colors"
              >
                <img
                  src={src}
                  alt={img.original_filename}
                  className={`object-cover ${images.length === 1 ? "max-h-[360px] max-w-full" : "h-32 w-32"}`}
                  loading="lazy"
                />
              </a>
            );
          })}
        </div>
      )}

      {/* File links */}
      {files.map((file) => (
        <a
          key={file.id}
          href={`/api/proxy/attachments/${file.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-xl bg-white/[0.04] border border-white/[0.06] px-4 py-3 hover:bg-white/[0.07] transition-colors max-w-xs"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-white/60">
              <path d="M4 1h5l4 4v9a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2" fill="none"/>
              <path d="M9 1v4h4" stroke="currentColor" strokeWidth="1.2" fill="none"/>
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] text-white/80">{file.original_filename}</p>
            <p className="text-[11px] text-white/30">
              {file.size_bytes < 1024
                ? `${file.size_bytes} B`
                : file.size_bytes < 1048576
                ? `${(file.size_bytes / 1024).toFixed(0)} KB`
                : `${(file.size_bytes / 1048576).toFixed(1)} MB`}
            </p>
          </div>
        </a>
      ))}
    </div>
  );
}

export default function MessageBubble({
  message,
  isNew = false,
  isStreaming = false,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);
  const [showPricing, setShowPricing] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<"good" | "bad" | null>(null);
  const [showFeedback, setShowFeedback] = useState<"good" | "bad" | null>(null);
  const [externalLink, setExternalLink] = useState<string | null>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const isUser = message.role === "user";
  const { activeConversationId, addMessage, replaceMessage, replaceMessageAndTruncate, resendMessage, sendMessage } = useChat();

  const versions = message.versions ?? [message.content];
  const versionIndex = message.versionIndex ?? versions.length - 1;
  const displayContent = versions[versionIndex] ?? message.content;
  const hasMultipleVersions = versions.length > 1;

  const { displayedText, isComplete } = useStreamingText(
    message.content,
    isStreaming && !isUser
  );

  const rawContent = isStreaming && !isUser ? displayedText : (isUser ? displayContent : message.content);
  const { content: cleanContent, suggestions } = !isUser && !isStreaming ? parseSuggestions(rawContent) : { content: rawContent, suggestions: [] as string[] };
  const contentToRender = !isUser ? preprocessCitations(cleanContent) : cleanContent;

  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      editRef.current.style.height = "auto";
      editRef.current.style.height = editRef.current.scrollHeight + "px";
    }
  }, [editing]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleEditSubmit = () => {
    const trimmed = editValue.trim();
    if (!trimmed || !activeConversationId) return;

    // Add new version
    const newVersions = [...versions, trimmed];
    const newIndex = newVersions.length - 1;

    replaceMessageAndTruncate(activeConversationId, message.id, {
      ...message,
      content: trimmed,
      versions: newVersions,
      versionIndex: newIndex,
    });

    setEditing(false);

    // Send the edited message through the real API (skips user msg creation)
    resendMessage(trimmed).catch((e) => console.error("Edit resend error:", e));
  };

  const handleVersionNav = (direction: -1 | 1) => {
    if (!activeConversationId) return;
    const newIndex = Math.max(0, Math.min(versions.length - 1, versionIndex + direction));
    if (newIndex === versionIndex) return;

    replaceMessage(activeConversationId, message.id, {
      ...message,
      content: versions[newIndex],
      versionIndex: newIndex,
    });
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setEditValue(displayContent);
      setEditing(false);
    }
  };

  if (isUser) {
    // Editing mode
    if (editing) {
      return (
        <div className="py-0.5">
          <div className="w-full">
            <div className="rounded-2xl bg-white/[0.07] border border-white/[0.08] px-5 py-3">
              <textarea
                ref={editRef}
                value={editValue}
                onChange={(e) => {
                  setEditValue(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = e.target.scrollHeight + "px";
                }}
                onKeyDown={handleEditKeyDown}
                className="w-full resize-none bg-transparent text-[16px] leading-7 text-white focus:outline-none"
                rows={1}
              />
              <div className="flex items-center justify-end gap-2 mt-3">
                <button
                  onClick={() => { setEditValue(displayContent); setEditing(false); }}
                  className="rounded-lg px-4 py-1.5 text-[16px] text-white/60 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditSubmit}
                  className="rounded-lg bg-white px-4 py-1.5 text-[16px] font-medium text-[#161616] hover:bg-white/90 active:scale-[0.98] transition-all"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Normal user message
    return (
      <div className={`group flex justify-end py-0.5 ${isNew ? "animate-fade-in-up" : ""}`}>
        <div className="max-w-[80%]">
          <div className="rounded-2xl bg-white/[0.10] px-5 py-3">
            <p className="whitespace-pre-wrap text-[16px] leading-7 text-white">
              {displayContent}
            </p>
            {message.attachments && message.attachments.length > 0 && (
              <AttachmentGrid attachments={message.attachments} />
            )}
          </div>
          {/* Actions row — copy, edit, version nav */}
          <div className="flex items-center justify-end gap-0.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <button
              onClick={handleCopy}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
              title="Copy"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
            <button
              onClick={() => { setEditValue(displayContent); setEditing(true); }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
              title="Edit"
            >
              <Pencil size={14} />
            </button>

            {/* Version navigation */}
            {hasMultipleVersions && (
              <div className="flex items-center gap-0.5 ml-1">
                <button
                  onClick={() => handleVersionNav(-1)}
                  disabled={versionIndex === 0}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors disabled:opacity-30 disabled:cursor-default"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-[14px] text-white/60 tabular-nums min-w-[28px] text-center">
                  {versionIndex + 1}/{versions.length}
                </span>
                <button
                  onClick={() => handleVersionNav(1)}
                  disabled={versionIndex === versions.length - 1}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors disabled:opacity-30 disabled:cursor-default"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Extract sources for citation rendering
  const sources = extractSources(message.steps);

  const markdownComponents = {
    // Render paragraphs with inline [1], [2] citations
    p({ children }: { children?: React.ReactNode }) {
      if (sources.length === 0) return <p>{children}</p>;
      const processed = Array.isArray(children) ? children : [children];
      return (
        <p>
          {processed.map((child, ci) => {
            if (typeof child === "string") {
              return <span key={ci}>{renderWithCitations(child, sources, setExternalLink)}</span>;
            }
            return child;
          })}
        </p>
      );
    },
    a({ href, children, ...props }: { href?: string; children?: React.ReactNode; [key: string]: any }) {
      const cleanHref = (href || "").replace(/[\s\x00-\x1f]/g, "");
      const isSafe = cleanHref && !/^(javascript|data|vbscript):/i.test(cleanHref);
      const safeHref = isSafe ? cleanHref : "#";
      if (isExternal(safeHref)) {
        return (
          <button
            onClick={(e) => { e.preventDefault(); setExternalLink(safeHref); }}
            className="text-white/60 hover:text-white/80 underline underline-offset-2 decoration-white/20 hover:decoration-white/40 transition-colors cursor-pointer bg-transparent border-none p-0 text-left inline"
            {...props}
          >
            {children}
          </button>
        );
      }
      return (
        <a href={safeHref} className="text-white/60 hover:text-white/80 underline underline-offset-2 decoration-white/20" {...props}>
          {children}
        </a>
      );
    },
    pre({ children }: { children?: React.ReactNode }) {
      return <>{children}</>;
    },
    code({ className, children }: { className?: string; children?: React.ReactNode }) {
      const match = /language-(\w+)/.exec(className || "");
      const code = String(children).replace(/\n$/, "");
      if (match) return <CodeBlock language={match[1]} code={code} />;
      return (
        <code className="rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[14px] font-mono text-white border border-white/[0.06]">
          {children}
        </code>
      );
    },
    table({ children }: { children?: React.ReactNode }) {
      return (
        <div className="my-4 overflow-x-auto rounded-xl border border-white/[0.06] overflow-hidden">
          <table className="mira-table w-full border-collapse">{children}</table>
        </div>
      );
    },
    th({ children }: { children?: React.ReactNode }) {
      return (
        <th className="bg-white/[0.04] px-4 py-2.5 text-left text-[12px] font-medium text-white/60 uppercase tracking-wider border-b border-white/[0.06]">
          {children}
        </th>
      );
    },
    td({ children }: { children?: React.ReactNode }) {
      return (
        <td className="px-4 py-3 text-[14px] text-white border-b border-white/[0.04]">
          {children}
        </td>
      );
    },
  };

  const hasSteps = message.steps && message.steps.length > 0;
  const hasError = !!message.error;

  // Is this message in a "thinking" state? (empty content, fresh ID, no error)
  const isWaiting = !isUser && message.id.startsWith("asst-") && message.content.trim().length === 0 && !hasError;

  // Assistant message
  return (
    <div className={`group py-1 ${isNew ? "animate-fade-in-up" : ""}`}>
      <div className="flex items-start gap-4">
        <AssistantAvatar thinking={isWaiting} />
        <div className="flex-1 min-w-0">
          <div className="mb-1.5 text-[14px] font-semibold text-white relative overflow-hidden">
            <span
              className="inline-block transition-all duration-400"
              style={{
                opacity: isWaiting ? 0 : 1,
                transform: isWaiting ? "translateY(-8px)" : "translateY(0)",
              }}
            >
              Mira
            </span>
            <span
              className="absolute left-0 top-0 mira-thinking-label"
              style={{
                opacity: isWaiting ? 1 : 0,
                transform: isWaiting ? "translateY(0)" : "translateY(8px)",
                transition: "opacity 400ms ease, transform 400ms ease",
              }}
            >
              Думаю
              <span className="mira-thinking-dots" />
            </span>
          </div>

          {hasError ? (
            <>
              <ErrorBanner
                error={message.error!}
                onUpgrade={() => setShowPricing(true)}
                onLogin={() => setShowAuthModal(true)}
              />
              {showPricing && createPortal(<PricingModal onClose={() => setShowPricing(false)} />, document.body)}
              {showAuthModal && createPortal(<AuthModal mode="register" onClose={() => setShowAuthModal(false)} />, document.body)}
            </>
          ) : hasSteps ? (
            <div className="markdown-body text-[16px] leading-7 text-white">
              {message.steps!.map((step, i) => {
                if (step.type === "reasoning") {
                  return <ReasoningBlock key={i} summary={step.summary} thinking={step.thinking} searches={step.searches} searchPhase={step.searchPhase} onExternalLink={setExternalLink} />;
                }
                // text step
                const isLastStep = i === message.steps!.length - 1;
                const rawText = isLastStep && isStreaming && !isUser ? displayedText : step.content;
                const { content: cleanStepText } = parseSuggestions(rawText);
                const textContent = preprocessCitations(cleanStepText);
                return (
                  <div key={i}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{textContent}</ReactMarkdown>
                    {isLastStep && isStreaming && !isComplete && (
                      <span className="inline-block h-[18px] w-[2px] animate-pulse bg-white/50 ml-0.5 align-middle rounded-full" />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="markdown-body text-[16px] leading-7 text-white">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {contentToRender}
              </ReactMarkdown>
              {isStreaming && !isComplete && (
                <span className="inline-block h-[18px] w-[2px] animate-pulse bg-white/50 ml-0.5 align-middle rounded-full" />
              )}
            </div>
          )}

          {message.attachments && message.attachments.length > 0 && (
            <AttachmentGrid attachments={message.attachments} />
          )}

          {/* Reminder card (shown when AI creates a reminder) */}
          {message.reminder && (
            <ReminderCard
              id={message.reminder.id}
              title={message.reminder.title}
              body={message.reminder.body}
              remindAt={message.reminder.remind_at}
              rrule={message.reminder.rrule}
              channels={message.reminder.channels}
            />
          )}

          {/* Scheduled content card */}
          {message.scheduledContent && (
            <ScheduledContentCard
              id={message.scheduledContent.id}
              title={message.scheduledContent.title}
              prompt={message.scheduledContent.prompt}
              scheduleAt={message.scheduledContent.schedule_at}
              rrule={message.scheduledContent.rrule}
            />
          )}

          {/* Action card */}
          {message.action && (
            <ActionCard
              id={message.action.id}
              actionType={message.action.action_type}
              payload={message.action.payload}
            />
          )}

          {/* Source citations */}
          {!hasError && (!isStreaming || isComplete) && sources.length > 0 && (
            <SourcesBadge sources={sources} onExternalLink={setExternalLink} />
          )}

          {!hasError && (!isStreaming || isComplete) && message.content.trim().length > 0 && (
            <div className="mt-3 flex items-center gap-0.5">
              <div className="flex items-center gap-0.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <button
                  onClick={handleCopy}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:bg-white/[0.06] hover:text-white/70 transition-colors"
                  title="Copy"
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                </button>
                <button
                  onClick={() => {
                    if (feedbackRating === "good") {
                      setFeedbackRating(null);
                    } else {
                      setFeedbackRating("good");
                      setShowFeedback("good");
                    }
                  }}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                    feedbackRating === "good"
                      ? "text-white bg-white/[0.10]"
                      : "text-white/40 hover:bg-white/[0.06] hover:text-white/70"
                  }`}
                  title="Good response"
                >
                  <ThumbsUp size={15} />
                </button>
                <button
                  onClick={() => {
                    if (feedbackRating === "bad") {
                      setFeedbackRating(null);
                    } else {
                      setFeedbackRating("bad");
                      setShowFeedback("bad");
                    }
                  }}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                    feedbackRating === "bad"
                      ? "text-white bg-white/[0.10]"
                      : "text-white/40 hover:bg-white/[0.06] hover:text-white/70"
                  }`}
                  title="Bad response"
                >
                  <ThumbsDown size={15} />
                </button>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:bg-white/[0.06] hover:text-white/70 transition-colors"
                  title="Retry"
                >
                  <RotateCcw size={15} />
                </button>
              </div>
              <div className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <MessageReactions messageId={message.id} />
              </div>
            </div>
          )}

          {/* Follow-up suggestion chips */}
          {suggestions.length > 0 && !isStreaming && (
            <div className="flex flex-wrap gap-2 mt-3">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  className="rounded-xl border border-white/[0.08] px-3.5 py-2 text-[14px] text-white/60 hover:text-white hover:bg-white/[0.04] hover:border-white/[0.12] transition-colors text-left"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Feedback modal */}
          {showFeedback && (
            <FeedbackModal
              messageId={message.id}
              rating={showFeedback}
              onClose={() => setShowFeedback(null)}
              onSubmitted={(r) => setFeedbackRating(r)}
            />
          )}

          {/* External link confirmation */}
          {externalLink && (
            <ExternalLinkModal
              url={externalLink}
              domain={getDomain(externalLink)}
              onConfirm={() => {
                window.open(externalLink, "_blank", "noopener,noreferrer");
                setExternalLink(null);
              }}
              onClose={() => setExternalLink(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
