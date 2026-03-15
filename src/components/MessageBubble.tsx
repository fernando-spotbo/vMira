"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Copy, Check, ThumbsUp, ThumbsDown } from "lucide-react";
import { Message } from "@/lib/types";
import CodeBlock from "./CodeBlock";
import { useStreamingText } from "@/hooks/useStreamingText";

interface MessageBubbleProps {
  message: Message;
  isNew?: boolean;
  isStreaming?: boolean;
}

export default function MessageBubble({
  message,
  isNew = false,
  isStreaming = false,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const { displayedText, isComplete } = useStreamingText(
    message.content,
    isStreaming && !isUser
  );

  const contentToRender = isStreaming && !isUser ? displayedText : message.content;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  return (
    <div
      className={`group py-4 ${isUser ? "flex justify-end" : ""} ${isNew ? "animate-fade-in-up" : ""}`}
    >
      <div className={isUser ? "max-w-[70%]" : "w-full max-w-3xl"}>
        <div
          className={isUser ? "rounded-3xl bg-gpt-gray-700 px-5 py-3" : ""}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap text-[15px] leading-7">
              {message.content}
            </p>
          ) : (
            <div className="markdown-body text-[15px] leading-7">
              <ReactMarkdown
                components={{
                  pre({ children }) {
                    return <>{children}</>;
                  },
                  code({ className, children }) {
                    const match = /language-(\w+)/.exec(className || "");
                    const code = String(children).replace(/\n$/, "");

                    if (match) {
                      return <CodeBlock language={match[1]} code={code} />;
                    }

                    return (
                      <code className="rounded bg-gpt-gray-900 px-1.5 py-0.5 text-sm">
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {contentToRender}
              </ReactMarkdown>
              {/* Streaming cursor */}
              {isStreaming && !isComplete && (
                <span className="inline-block h-4 w-0.5 animate-pulse bg-gpt-gray-300 ml-0.5 align-middle" />
              )}
            </div>
          )}
        </div>

        {/* Action buttons (assistant only, show after streaming completes) */}
        {!isUser && (!isStreaming || isComplete) && (
          <div className="mt-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={handleCopy}
              className="flex h-8 w-8 items-center justify-center rounded-md text-gpt-gray-400 hover:bg-gpt-gray-700 hover:text-gpt-gray-200 transition-colors"
              title="Copy"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-md text-gpt-gray-400 hover:bg-gpt-gray-700 hover:text-gpt-gray-200 transition-colors"
              title="Good response"
            >
              <ThumbsUp size={16} />
            </button>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-md text-gpt-gray-400 hover:bg-gpt-gray-700 hover:text-gpt-gray-200 transition-colors"
              title="Bad response"
            >
              <ThumbsDown size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
