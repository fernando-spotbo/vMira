"use client";

import { useState, useMemo } from "react";
import { Check, Copy, Code2 } from "lucide-react";
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
      return code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
  }, [code, language]);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const displayLang = language
    ? language.charAt(0).toUpperCase() + language.slice(1)
    : "Code";

  return (
    <div className="my-3 -mx-1 rounded-xl bg-[#1e1e1e] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-11">
        <div className="flex items-center gap-2 text-[14px] text-white font-medium">
          <Code2 size={15} strokeWidth={1.8} className="text-white/50" />
          <span>{displayLang}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:text-white/60 transition-colors"
          title={copied ? "Copied" : "Copy"}
        >
          {copied ? <Check size={16} strokeWidth={1.8} /> : <Copy size={16} strokeWidth={1.8} />}
        </button>
      </div>

      {/* Code */}
      <div className="overflow-x-auto px-4 pb-4">
        <pre className="text-[14px] leading-[1.75]">
          <code
            className={`hljs language-${language}`}
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        </pre>
      </div>
    </div>
  );
}
