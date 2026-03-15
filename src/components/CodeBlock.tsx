"use client";

import { useState, useMemo } from "react";
import { Check, Copy, Download, WrapText } from "lucide-react";
import hljs from "highlight.js";

interface CodeBlockProps {
  language: string;
  code: string;
}

export default function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [wordWrap, setWordWrap] = useState(false);

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

  const lineCount = code.split("\n").length;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  const handleDownload = () => {
    const ext = language === "python" ? "py" : language === "javascript" ? "js" : language === "typescript" ? "ts" : language === "css" ? "css" : language === "jsx" ? "jsx" : language;
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `code.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-fade-in-up my-4 overflow-hidden rounded-xl border border-gpt-gray-600/50 bg-gpt-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gpt-gray-600/30">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-gpt-gray-700 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-gpt-gray-400">
            {language}
          </span>
          <span className="text-[11px] text-gpt-gray-500">
            {lineCount} {lineCount === 1 ? "line" : "lines"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWordWrap(!wordWrap)}
            className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
              wordWrap ? "bg-gpt-gray-700 text-gpt-gray-200" : "text-gpt-gray-500 hover:text-gpt-gray-300 hover:bg-gpt-gray-700/50"
            }`}
            title="Toggle word wrap"
          >
            <WrapText size={14} />
          </button>
          <button
            onClick={handleDownload}
            className="flex h-7 w-7 items-center justify-center rounded-md text-gpt-gray-500 hover:text-gpt-gray-300 hover:bg-gpt-gray-700/50 transition-colors"
            title="Download"
          >
            <Download size={14} />
          </button>
          <button
            onClick={handleCopy}
            className={`flex h-7 items-center gap-1 rounded-md px-2 text-xs transition-all ${
              copied
                ? "bg-gpt-green/20 text-gpt-green"
                : "text-gpt-gray-500 hover:text-gpt-gray-300 hover:bg-gpt-gray-700/50"
            }`}
            title="Copy code"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>
      {/* Code area with line numbers */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <tbody>
            {code.split("\n").map((line, i) => (
              <tr key={i} className="hover:bg-gpt-gray-800/50">
                <td className="select-none border-r border-gpt-gray-600/20 px-3 py-0 text-right align-top text-[12px] leading-6 text-gpt-gray-600">
                  {i + 1}
                </td>
                <td className={`px-4 py-0 text-[13px] leading-6 ${wordWrap ? "whitespace-pre-wrap break-all" : "whitespace-pre"}`}>
                  <code
                    className="hljs"
                    dangerouslySetInnerHTML={{
                      __html: (() => {
                        try {
                          if (language && hljs.getLanguage(language)) {
                            return hljs.highlight(line, { language, ignoreIllegals: true }).value;
                          }
                          return line || "&nbsp;";
                        } catch {
                          return line || "&nbsp;";
                        }
                      })(),
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
