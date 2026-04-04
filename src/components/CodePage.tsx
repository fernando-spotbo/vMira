"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import {
  ArrowLeft,
  ChevronDown,
  GitBranch,
  Monitor,
  Power,
  Terminal,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { t } from "@/lib/i18n";
import CodeBlock from "./CodeBlock";
import InputBar from "./InputBar";
import type { RemoteSession, RemoteMessage } from "@/lib/types";
import {
  fetchRemoteSessions,
  fetchRemoteSession,
  disconnectRemoteSession,
  streamRemoteMessage,
  type ApiRemoteSession,
  type ApiRemoteMessage,
  type RemoteStreamEvent,
} from "@/lib/api-code";

// ── Helpers ─────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60_000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d ago`;
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function dirName(fullPath: string): string {
  const segments = fullPath.replace(/\\/g, "/").split("/").filter(Boolean);
  return segments[segments.length - 1] || fullPath;
}

function mapSession(s: ApiRemoteSession): RemoteSession {
  return {
    id: s.id,
    environmentId: s.environment_id,
    machineName: s.machine_name,
    directory: s.directory,
    branch: s.branch,
    gitRepoUrl: s.git_repo_url,
    status: s.status,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
    messages: [],
  };
}

function mapMessage(m: ApiRemoteMessage): RemoteMessage {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    thinking: m.thinking ?? undefined,
    createdAt: m.created_at,
  };
}

const STATUS_DOT: Record<string, string> = {
  connected: "bg-[#10a37f]",
  reconnecting: "bg-[#f59e0b]",
  offline: "bg-white/30",
};

const STATUS_LABEL_KEY: Record<string, string> = {
  connected: "code.connected",
  reconnecting: "code.reconnecting",
  offline: "code.offline",
};

// ═══════════════════════════════════════════════════════════════════════
// ── CodePage (router between list and console)
// ═══════════════════════════════════════════════════════════════════════

export default function CodePage({ onBack, initialSessionId }: { onBack: () => void; initialSessionId?: string }) {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(initialSessionId ?? null);

  if (activeSessionId) {
    return (
      <RemoteConsole
        sessionId={activeSessionId}
        onBack={() => setActiveSessionId(null)}
      />
    );
  }

  return (
    <SessionList
      onSelectSession={(id) => setActiveSessionId(id)}
      onBack={onBack}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ── Session List View
// ═══════════════════════════════════════════════════════════════════════

function SessionList({
  onSelectSession,
  onBack,
}: {
  onSelectSession: (id: string) => void;
  onBack: () => void;
}) {
  const [sessions, setSessions] = useState<RemoteSession[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch sessions on mount + poll every 10 seconds
  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const raw = await fetchRemoteSessions();
        if (active) setSessions(raw.map(mapSession));
      } catch {
        // ignore
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 10_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

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
              {t("code.title")}
            </h1>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-5 pb-10">
          {/* Loading skeleton */}
          {loading && sessions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="h-5 w-5 rounded-full border-2 border-white/10 border-t-white/40 animate-spin" />
            </div>
          )}

          {/* Empty state */}
          {!loading && sessions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.03] mb-5">
                <Terminal
                  size={28}
                  strokeWidth={1.4}
                  className="text-white/15"
                />
              </div>
              <p className="text-[16px] text-white/25">
                {t("code.noSessions")}
              </p>
              <p className="text-[14px] text-white/15 mt-1.5 text-center max-w-xs">
                {t("code.noSessionsDesc")}
              </p>
            </div>
          )}

          {/* Grid */}
          {sessions.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => onSelectSession(session.id)}
                  className="group relative text-left rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1] p-5 transition-all duration-200"
                >
                  {/* Directory name */}
                  <h3 className="text-[15px] font-medium text-white leading-snug mb-1 pr-2 truncate">
                    {dirName(session.directory)}
                  </h3>

                  {/* Full path */}
                  <p className="text-[13px] text-white/25 mb-3 truncate">
                    {session.directory}
                  </p>

                  {/* Meta row */}
                  <div className="space-y-1.5">
                    {/* Git branch */}
                    {session.branch && (
                      <div className="flex items-center gap-1.5">
                        <GitBranch
                          size={12}
                          strokeWidth={1.8}
                          className="text-white/20 shrink-0"
                        />
                        <span className="text-[13px] text-white/30 truncate">
                          {session.branch}
                        </span>
                      </div>
                    )}

                    {/* Machine name */}
                    <div className="flex items-center gap-1.5">
                      <Monitor
                        size={12}
                        strokeWidth={1.8}
                        className="text-white/20 shrink-0"
                      />
                      <span className="text-[13px] text-white/30 truncate">
                        {session.machineName}
                      </span>
                    </div>
                  </div>

                  {/* Footer: status + time */}
                  <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[session.status]}`}
                      />
                      <span className="text-[13px] text-white/20">
                        {t(STATUS_LABEL_KEY[session.status])}
                      </span>
                    </div>
                    <span className="text-[13px] text-white/15">
                      {timeAgo(session.updatedAt)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ── ThinkingBlock (inline, self-contained for remote console)
// ═══════════════════════════════════════════════════════════════════════

function ThinkingBlock({
  content,
  isStreaming,
}: {
  content: string;
  isStreaming: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const wasStreamingRef = useRef(false);

  useEffect(() => {
    if (isStreaming) {
      wasStreamingRef.current = true;
      setExpanded(true);
    } else if (wasStreamingRef.current) {
      const timer = setTimeout(() => setExpanded(false), 600);
      return () => clearTimeout(timer);
    }
  }, [isStreaming]);

  useEffect(() => {
    if (expanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [content, expanded]);

  const summary =
    content.length > 120
      ? "..." + content.slice(-120).replace(/\n/g, " ").trim()
      : content.replace(/\n/g, " ").trim();

  return (
    <div className="mb-4 relative">
      {/* Collapsed */}
      {!expanded && content && (
        <button
          onClick={() => setExpanded(true)}
          className="group flex items-center gap-2 w-full text-left"
        >
          <div className="flex items-center gap-1.5 shrink-0">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              className="text-white/20 group-hover:text-white/35 transition-colors"
            >
              <circle
                cx="7"
                cy="7"
                r="5.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="3 2"
              />
              <circle cx="7" cy="7" r="1.5" fill="currentColor" />
            </svg>
            <span className="text-[12px] tracking-wide uppercase text-white/20 group-hover:text-white/35 transition-colors">
              Thought
            </span>
          </div>
          <span className="text-[12px] text-white/15 group-hover:text-white/25 transition-colors truncate">
            {summary}
          </span>
          <ChevronDown
            size={12}
            className="shrink-0 -rotate-90 text-white/15 group-hover:text-white/30 transition-colors"
          />
        </button>
      )}

      {/* Expanded */}
      {expanded && (
        <div
          className="relative overflow-hidden rounded-lg transition-all duration-300"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.015) 0%, rgba(255,255,255,0.005) 100%)",
          }}
        >
          {/* Left edge */}
          <div
            className={`absolute left-0 top-0 bottom-0 w-[2px] rounded-full transition-opacity duration-500 ${
              isStreaming ? "opacity-100" : "opacity-30"
            }`}
            style={{
              background: isStreaming
                ? "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.06) 100%)"
                : "rgba(255,255,255,0.06)",
              backgroundSize: isStreaming ? "100% 200%" : undefined,
              animation: isStreaming
                ? "thinking-breathe 2s ease-in-out infinite"
                : undefined,
            }}
          />

          {/* Header */}
          <div className="flex items-center justify-between pl-4 pr-2 pt-2.5 pb-1">
            <div className="flex items-center gap-2">
              {isStreaming && (
                <div className="flex gap-[3px] items-center">
                  <span className="block w-[3px] h-[3px] rounded-full bg-white/20 animate-[thinking-dot_1.4s_ease-in-out_infinite]" />
                  <span className="block w-[3px] h-[3px] rounded-full bg-white/20 animate-[thinking-dot_1.4s_ease-in-out_0.2s_infinite]" />
                  <span className="block w-[3px] h-[3px] rounded-full bg-white/20 animate-[thinking-dot_1.4s_ease-in-out_0.4s_infinite]" />
                </div>
              )}
              <span className="text-[11px] tracking-[0.08em] uppercase text-white/20">
                {isStreaming ? "Thinking" : "Thought"}
              </span>
            </div>
            <button
              onClick={() => setExpanded(false)}
              className="p-1 text-white/15 hover:text-white/35 transition-colors rounded"
            >
              <ChevronDown size={13} />
            </button>
          </div>

          {/* Content */}
          <div
            ref={scrollRef}
            className="pl-4 pr-3 pb-3 max-h-[180px] overflow-y-auto scrollbar-thin"
            style={{
              maskImage:
                "linear-gradient(to bottom, transparent 0%, black 8%, black 85%, transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent 0%, black 8%, black 85%, transparent 100%)",
            }}
          >
            <p className="text-[12.5px] leading-[1.65] text-white/[0.18] whitespace-pre-wrap break-words font-[system-ui]">
              {content}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ── Markdown components for assistant messages
// ═══════════════════════════════════════════════════════════════════════

const markdownComponents = {
  p({ children }: { children?: React.ReactNode }) {
    return <p>{children}</p>;
  },
  a({
    href,
    children,
  }: {
    href?: string;
    children?: React.ReactNode;
  }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-white/60 hover:text-white/80 underline underline-offset-2 decoration-white/20 hover:decoration-white/40 transition-colors"
      >
        {children}
      </a>
    );
  },
  pre({ children }: { children?: React.ReactNode }) {
    return <>{children}</>;
  },
  code({
    className,
    children,
  }: {
    className?: string;
    children?: React.ReactNode;
  }) {
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
        <table className="mira-table w-full border-collapse">
          {children}
        </table>
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

// ═══════════════════════════════════════════════════════════════════════
// ── Remote Console View
// ═══════════════════════════════════════════════════════════════════════

function RemoteConsole({
  sessionId,
  onBack,
}: {
  sessionId: string;
  onBack: () => void;
}) {
  const [session, setSession] = useState<RemoteSession | null>(null);
  const [messages, setMessages] = useState<RemoteMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingThinking, setStreamingThinking] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const autoFollow = useRef(true);
  const selfScroll = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // ── Load session + messages ──
  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const result = await fetchRemoteSession(sessionId);
        if (!result || !active) return;
        setSession(mapSession(result.session));
        setMessages(result.messages.map(mapMessage));
      } catch {
        // ignore
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [sessionId]);

  // ── Poll session status every 10s ──
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const result = await fetchRemoteSession(sessionId);
        if (result) {
          setSession(mapSession(result.session));
        }
      } catch {
        // ignore
      }
    }, 10_000);
    return () => clearInterval(poll);
  }, [sessionId]);

  // ── Real-time message polling (every 3s) ──
  useEffect(() => {
    if (isStreaming) return; // don't poll while we're streaming our own response
    const poll = setInterval(async () => {
      try {
        const result = await fetchRemoteSession(sessionId);
        if (result) {
          const newMsgs = result.messages.map(mapMessage);
          setMessages(prev => {
            // Only update if there are new messages
            if (newMsgs.length !== prev.length) return newMsgs;
            const lastNew = newMsgs[newMsgs.length - 1];
            const lastOld = prev[prev.length - 1];
            if (lastNew && lastOld && lastNew.id !== lastOld.id) return newMsgs;
            return prev;
          });
        }
      } catch {
        // ignore
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [sessionId, isStreaming]);

  // ── Scroll helpers ──
  const scrollToEnd = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    selfScroll.current = true;
    el.scrollTop = el.scrollHeight;
    requestAnimationFrame(() => {
      selfScroll.current = false;
    });
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (autoFollow.current) scrollToEnd();
  }, [messages.length, streamingContent, streamingThinking, scrollToEnd]);

  // Follow stream with MutationObserver
  useEffect(() => {
    if (!isStreaming || !autoFollow.current) return;
    const el = scrollRef.current;
    if (!el) return;

    const observer = new MutationObserver(() => {
      if (!autoFollow.current) return;
      selfScroll.current = true;
      el.scrollTop = el.scrollHeight;
      requestAnimationFrame(() => {
        selfScroll.current = false;
      });
    });
    observer.observe(el, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => observer.disconnect();
  }, [isStreaming]);

  const onScroll = useCallback(() => {
    if (selfScroll.current) return;
    const el = scrollRef.current;
    if (!el) return;

    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (nearBottom) {
      autoFollow.current = true;
      setShowScrollBtn(false);
    } else {
      autoFollow.current = false;
      if (messages.length > 0) setShowScrollBtn(true);
    }
  }, [messages.length]);

  // ── Disconnect ──
  const handleDisconnect = useCallback(async () => {
    await disconnectRemoteSession(sessionId);
    onBack();
  }, [sessionId, onBack]);

  // ── Cancel ──
  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  // ── Send (called by InputBar via onSend prop) ──
  const handleRemoteSend = useCallback(async (text: string) => {
    const userMsg: RemoteMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    setStreamingThinking("");
    setStreamingContent("");
    autoFollow.current = true;

    const controller = new AbortController();
    abortRef.current = controller;

    let thinkBuf = "";
    let contentBuf = "";

    try {
      for await (const event of streamRemoteMessage(
        sessionId,
        text,
        controller.signal,
      )) {
        switch (event.type) {
          case "thinking":
            thinkBuf += event.content;
            setStreamingThinking(thinkBuf);
            break;
          case "token":
            contentBuf += event.content;
            setStreamingContent(contentBuf);
            break;
          case "tool_use":
            contentBuf += `\n\`\`\`\n> ${event.name}\n\`\`\`\n`;
            setStreamingContent(contentBuf);
            break;
          case "tool_result":
            contentBuf += event.content ? `\n${event.content}\n` : "";
            setStreamingContent(contentBuf);
            break;
          case "done": {
            const asstMsg: RemoteMessage = {
              id: `asst-${Date.now()}`,
              role: "assistant",
              content: contentBuf,
              thinking: thinkBuf || undefined,
              createdAt: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, asstMsg]);
            setStreamingContent("");
            setStreamingThinking("");
            break;
          }
          case "error": {
            const errMsg: RemoteMessage = {
              id: `asst-err-${Date.now()}`,
              role: "assistant",
              content: `Error: ${event.message}`,
              createdAt: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, errMsg]);
            setStreamingContent("");
            setStreamingThinking("");
            break;
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        // User cancelled — commit whatever we have
        if (contentBuf) {
          const partialMsg: RemoteMessage = {
            id: `asst-cancel-${Date.now()}`,
            role: "assistant",
            content: contentBuf,
            thinking: thinkBuf || undefined,
            createdAt: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, partialMsg]);
        }
        setStreamingContent("");
        setStreamingThinking("");
      } else {
        const errMsg: RemoteMessage = {
          id: `asst-err-${Date.now()}`,
          role: "assistant",
          content: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errMsg]);
        setStreamingContent("");
        setStreamingThinking("");
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [isStreaming, sessionId]);

  // ── Cleanup abort on unmount ──
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const hasInput = input.trim().length > 0;

  // ── Derived display values ──
  const displayName = session ? dirName(session.directory) : "...";
  const displayBranch = session?.branch;
  const displayStatus = session?.status ?? "offline";

  return (
    <div className="flex h-full flex-col bg-[#161616]">
      {/* ── Header ── */}
      <div className="shrink-0 px-5 pt-[env(safe-area-inset-top)] border-b border-white/[0.06]">
        <div className="flex items-center justify-between h-14">
          {/* Left: back + title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-[13px] text-white/40 hover:text-white/70 transition-colors shrink-0"
            >
              <ArrowLeft size={14} strokeWidth={1.8} />
              <span className="hidden sm:inline">{t("code.sessions")}</span>
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-[16px] font-semibold text-white truncate">
                {displayName}
              </h1>

              {displayBranch && (
                <div className="flex items-center gap-1 shrink-0 rounded-md bg-white/[0.06] px-2 py-0.5">
                  <GitBranch size={11} strokeWidth={1.8} className="text-white/30" />
                  <span className="text-[12px] text-white/40">
                    {displayBranch}
                  </span>
                </div>
              )}

              <span
                className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[displayStatus]}`}
              />
            </div>
          </div>

          {/* Right: disconnect */}
          <button
            onClick={handleDisconnect}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] text-white/30 hover:text-red-400 hover:bg-white/[0.05] transition-colors shrink-0"
          >
            <Power size={13} strokeWidth={1.8} />
            <span className="hidden sm:inline">{t("code.disconnect")}</span>
          </button>
        </div>
      </div>

      {/* ── Message area ── */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="h-full overflow-y-auto"
        >
          <div className="mx-auto max-w-[52rem] px-4 min-h-full flex flex-col justify-end">
            <div className="pt-12">
              {/* Rendered messages */}
              {messages.map((msg) => (
                <div key={msg.id} data-role={msg.role}>
                  {msg.role === "user" ? (
                    <UserBubble content={msg.content} />
                  ) : (
                    <AssistantBubble
                      content={msg.content}
                      thinking={msg.thinking}
                      isStreaming={false}
                    />
                  )}
                </div>
              ))}

              {/* Streaming message */}
              {isStreaming && (
                <div data-role="assistant">
                  <AssistantBubble
                    content={streamingContent}
                    thinking={streamingThinking}
                    isStreaming
                  />
                </div>
              )}

              <div ref={endRef} className="h-6" aria-hidden="true" />
            </div>
          </div>
        </div>

        {/* Scroll to bottom button */}
        {showScrollBtn && (
          <button
            onClick={() => {
              autoFollow.current = true;
              setShowScrollBtn(false);
              scrollToEnd();
            }}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-[#252525] border border-white/[0.08] text-white/40 hover:text-white/70 hover:bg-[#303030] shadow-lg transition-all"
          >
            <ChevronDown size={16} strokeWidth={2} />
          </button>
        )}
      </div>

      {/* ── Input bar (reuses chat InputBar in remote mode) ── */}
      <InputBar
        remoteMode
        onSend={handleRemoteSend}
        onCancel={handleCancel}
        isRemoteStreaming={isStreaming}
        placeholder={t("code.sendPlaceholder")}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ── User Bubble
// ═══════════════════════════════════════════════════════════════════════

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end py-0.5">
      <div className="max-w-[80%]">
        <div className="rounded-2xl bg-[#303030] px-4 py-2.5">
          <p className="whitespace-pre-wrap text-[15px] leading-7 text-white">
            {content}
          </p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ── Assistant Bubble
// ═══════════════════════════════════════════════════════════════════════

function AssistantBubble({
  content,
  thinking,
  isStreaming,
}: {
  content: string;
  thinking?: string;
  isStreaming: boolean;
}) {
  const isWaiting = isStreaming && !content && !thinking;

  return (
    <div className="py-1">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full transition-all duration-700 ease-out"
            style={{
              backgroundColor: isWaiting
                ? "rgba(255,255,255,0.14)"
                : "rgba(255,255,255,0.08)",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              className="transition-[color] duration-700 ease-out"
              style={{
                color: isWaiting
                  ? "rgba(255,255,255,0.95)"
                  : "rgba(255,255,255,0.8)",
              }}
            >
              <path
                d="M12 1Q18.5 12 12 23Q5.5 12 12 1Z"
                fill="currentColor"
              />
              <path
                d="M1 12Q12 5.5 23 12Q12 18.5 1 12Z"
                fill="currentColor"
              />
            </svg>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {/* Label */}
          <div className="mb-1.5 text-[14px] font-semibold text-white">
            Mira
          </div>

          {/* Thinking */}
          {thinking && (
            <ThinkingBlock
              content={thinking}
              isStreaming={isStreaming && !content}
            />
          )}

          {/* Waiting indicator */}
          {isWaiting && (
            <div className="flex gap-[3px] items-center py-2">
              <span className="block w-[3px] h-[3px] rounded-full bg-white/20 animate-[thinking-dot_1.4s_ease-in-out_infinite]" />
              <span className="block w-[3px] h-[3px] rounded-full bg-white/20 animate-[thinking-dot_1.4s_ease-in-out_0.2s_infinite]" />
              <span className="block w-[3px] h-[3px] rounded-full bg-white/20 animate-[thinking-dot_1.4s_ease-in-out_0.4s_infinite]" />
            </div>
          )}

          {/* Content */}
          {content && (
            <div className="markdown-body text-[15px] leading-7 text-white">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
