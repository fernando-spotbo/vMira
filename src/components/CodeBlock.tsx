"use client";

import { useState, useMemo } from "react";
import { Check, Copy } from "lucide-react";
import hljs from "highlight.js";

interface CodeBlockProps {
  language: string;
  code: string;
}

export default function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const highlightedHtml = useMemo(() => {
    try {
      if (language && hljs.getLanguage(language)) {
        return hljs.highlight(code, { language }).value;
      }
      return hljs.highlightAuto(code).value;
    } catch {
      return code;
    }
  }, [code, language]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-md">
      {/* Header — matches ChatGPT: language left, copy button right */}
      <div className="flex items-center justify-between bg-gpt-gray-700 px-4 py-2 text-xs text-gpt-gray-300">
        <span>{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-gpt-gray-300 hover:text-gpt-gray-100 transition-colors"
        >
          {copied ? (
            <>
              <Check size={14} />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy size={14} />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>
      {/* Code area — near-black bg, 16px padding, no line numbers */}
      <div className="overflow-x-auto bg-black p-4">
        <pre className="text-[14px] leading-relaxed">
          <code
            className={`hljs language-${language}`}
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        </pre>
      </div>
    </div>
  );
}
