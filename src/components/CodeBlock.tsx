"use client";

import { useState, useMemo } from "react";
import { Check, Copy, Play, Code2 } from "lucide-react";
import { t } from "@/lib/i18n";
import hljs from "highlight.js";
import CodeModal from "./CodeModal";

interface CodeBlockProps {
  language: string;
  code: string;
}

export default function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

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

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  return (
    <>
      <div className="my-3 overflow-hidden rounded-xl bg-[#0f0f0f] border border-white/[0.04]">
        {/* Header — same bg, no visible division */}
        <div className="flex items-center justify-between px-4 pt-3 pb-0">
          <div className="flex items-center gap-2 text-[14px] text-white/50">
            <Code2 size={14} strokeWidth={1.8} />
            <span>{language}</span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Copy — icon only */}
            <button
              onClick={handleCopy}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:text-white/70 transition-colors"
              title={copied ? "Copied" : "Copy code"}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>

            {/* Run — pill button with border */}
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-white/[0.1] px-3.5 py-1.5 text-[14px] text-white hover:bg-white/[0.06] hover:border-white/[0.16] transition-all"
            >
              <Play size={12} fill="currentColor" />
              <span>{t("code.run")}</span>
            </button>
          </div>
        </div>

        {/* Code — continuous with header */}
        <div className="overflow-x-auto px-4 pt-3 pb-4">
          <pre className="text-[13px] leading-6">
            <code
              className={`hljs language-${language}`}
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            />
          </pre>
        </div>
      </div>

      {modalOpen && (
        <CodeModal
          language={language}
          code={code}
          highlightedHtml={highlightedHtml}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
