"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Check, ThumbsUp, ThumbsDown, RotateCcw, Pencil, ChevronLeft, ChevronRight } from "lucide-react";
import { Message, MessageStep } from "@/lib/types";
import CodeBlock from "./CodeBlock";
import ReasoningBlock from "./ReasoningBlock";
import { useStreamingText } from "@/hooks/useStreamingText";
import { t } from "@/lib/i18n";
import { useChat } from "@/context/ChatContext";
import { getRandomMockResponse, getRandomSteppedResponse } from "@/lib/mock-responses";
import MessageReactions from "./MessageReactions";

interface MessageBubbleProps {
  message: Message;
  isNew?: boolean;
  isStreaming?: boolean;
}

function AssistantAvatar() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.08]">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-white">
        <path d="M12 1Q18.5 12 12 23Q5.5 12 12 1Z" fill="currentColor"/>
        <path d="M1 12Q12 5.5 23 12Q12 18.5 1 12Z" fill="currentColor"/>
      </svg>
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
  const editRef = useRef<HTMLTextAreaElement>(null);
  const isUser = message.role === "user";
  const { activeConversationId, addMessage, replaceMessage, replaceMessageAndTruncate, setIsThinking } = useChat();

  const versions = message.versions ?? [message.content];
  const versionIndex = message.versionIndex ?? versions.length - 1;
  const displayContent = versions[versionIndex] ?? message.content;
  const hasMultipleVersions = versions.length > 1;

  const { displayedText, isComplete } = useStreamingText(
    message.content,
    isStreaming && !isUser
  );

  const contentToRender = isStreaming && !isUser ? displayedText : (isUser ? displayContent : message.content);

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

    // Trigger new AI response
    setIsThinking(true);
    const stepped = getRandomSteppedResponse();
    const thinkingDuration = 1500 + Math.random() * 2000;

    if (stepped) {
      setTimeout(() => {
        setIsThinking(false);
        addMessage(activeConversationId, {
          id: `asst-${Date.now()}`,
          role: "assistant",
          content: stepped.content,
          steps: stepped.steps,
        });
      }, thinkingDuration);
    } else {
      const response = getRandomMockResponse();
      setTimeout(() => {
        setIsThinking(false);
        addMessage(activeConversationId, {
          id: `asst-${Date.now()}`,
          role: "assistant",
          content: response,
        });
      }, thinkingDuration);
    }
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
        <div className="py-3">
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
      <div className={`group flex justify-end py-3 ${isNew ? "animate-fade-in-up" : ""}`}>
        <div className="max-w-[80%]">
          <div className="rounded-2xl bg-white/[0.10] px-5 py-3">
            <p className="whitespace-pre-wrap text-[16px] leading-7 text-white">
              {displayContent}
            </p>
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

  const markdownComponents = {
    a({ href, children, ...props }: { href?: string; children?: React.ReactNode; [key: string]: any }) {
      const isSafe = href && !/^(javascript|data|vbscript):/i.test(href);
      return (
        <a
          href={isSafe ? href : "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline"
          {...props}
        >
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

  // Assistant message
  return (
    <div className={`group py-5 ${isNew ? "animate-fade-in-up" : ""}`}>
      <div className="flex items-start gap-4">
        <AssistantAvatar />
        <div className="flex-1 min-w-0">
          <div className="mb-1.5 text-[14px] font-semibold text-white">
            Mira
          </div>

          {hasSteps ? (
            <div className="markdown-body text-[16px] leading-7 text-white">
              {message.steps!.map((step, i) => {
                if (step.type === "reasoning") {
                  return <ReasoningBlock key={i} summary={step.summary} thinking={step.thinking} searches={step.searches} />;
                }
                // text step
                const isLastStep = i === message.steps!.length - 1;
                const textContent = isLastStep && isStreaming && !isUser ? displayedText : step.content;
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

          {(!isStreaming || isComplete) && (
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
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:bg-white/[0.06] hover:text-white/70 transition-colors"
                  title="Good response"
                >
                  <ThumbsUp size={15} />
                </button>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:bg-white/[0.06] hover:text-white/70 transition-colors"
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
        </div>
      </div>
    </div>
  );
}
