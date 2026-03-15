"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface CodeBlockProps {
  language: string;
  code: string;
}

export default function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-gpt-gray-600">
      {/* Header */}
      <div className="flex items-center justify-between bg-gpt-gray-700 px-4 py-2 text-xs text-gpt-gray-300">
        <span>{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-gpt-gray-300 hover:text-gpt-gray-100 transition-colors"
        >
          {copied ? (
            <>
              <Check size={14} />
              Copied!
            </>
          ) : (
            <>
              <Copy size={14} />
              Copy code
            </>
          )}
        </button>
      </div>
      {/* Code (rendered by rehype-highlight via the parent pre>code) */}
      <div className="overflow-x-auto bg-gpt-gray-900 p-4 text-sm leading-relaxed">
        <pre>
          <code className={language ? `hljs language-${language}` : ""}>
            {code}
          </code>
        </pre>
      </div>
    </div>
  );
}
