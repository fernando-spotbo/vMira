"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Copy, Check, Trash2, Play, Square } from "lucide-react";

interface CodeModalProps {
  language: string;
  code: string;
  highlightedHtml: string;
  onClose: () => void;
}

export default function CodeModal({
  language,
  code,
  highlightedHtml,
  onClose,
}: CodeModalProps) {
  const [copied, setCopied] = useState(false);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string[]>([]);
  const [codeWidth, setCodeWidth] = useState(45); // percentage
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Resizable divider
  const handleMouseDown = useCallback(() => {
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = (x / rect.width) * 100;
      setCodeWidth(Math.min(Math.max(pct, 12), 75));
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleRun = () => {
    setRunning(true);
    setOutput(["Run started...", "Initializing environment", "Installing packages"]);

    setTimeout(() => {
      setOutput((prev) => [...prev, "Running code"]);
    }, 800);

    setTimeout(() => {
      setOutput((prev) => [...prev, "", "Execution completed in 342 ms"]);
      setRunning(false);
    }, 2000);
  };

  return (
    <div className="absolute inset-0 z-[90] flex flex-col bg-[#161616]">
      {/* Top bar */}
      <div className="flex h-11 shrink-0 items-center border-b border-white/[0.06] px-3">
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          <X size={16} />
        </button>
        <button
          onClick={onClose}
          className="flex items-center gap-1 ml-1 text-[16px] text-white/50 hover:text-white transition-colors"
        >
          <span className="text-white/30">|</span>
          <span className="ml-1">&#8592; Hide code</span>
        </button>
      </div>

      {/* Split panels */}
      <div ref={containerRef} className="flex flex-1 min-h-0">
        {/* Left: Code panel — flush left, no card */}
        <div
          className="flex flex-col shrink-0 overflow-hidden"
          style={{ width: `${codeWidth}%` }}
        >
          <div className="flex-1 overflow-y-auto overflow-x-hidden py-4">
            <div className="overflow-x-auto px-4">
              <pre className="text-[13px] leading-7 font-mono whitespace-pre">
                <code
                  className={`hljs language-${language}`}
                  dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                />
              </pre>
            </div>
          </div>
        </div>

        {/* Draggable divider */}
        <div
          onMouseDown={handleMouseDown}
          className="w-[5px] shrink-0 cursor-col-resize hover:bg-white/[0.08] active:bg-white/[0.12] transition-colors"
        />

        {/* Right: Console card */}
        <div className="flex-1 min-w-0 p-2.5 pl-0">
          <div className="flex h-full flex-col rounded-xl border border-white/[0.06] bg-[#1a1a1a] overflow-hidden">
            {/* Console header */}
            <div className="flex shrink-0 items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
              <span className="text-[16px] font-medium text-white">Console</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleCopy}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 hover:text-white/70 transition-colors"
                  title={copied ? "Copied" : "Copy code"}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
                <button
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 hover:text-white/70 transition-colors"
                  title="Clear"
                  onClick={() => setOutput([])}
                >
                  <Trash2 size={14} />
                </button>

                {running ? (
                  <button
                    onClick={() => setRunning(false)}
                    className="flex items-center gap-1.5 rounded-full border border-white/[0.1] px-3 py-1 text-[14px] text-white hover:bg-white/[0.05] transition-colors ml-1"
                  >
                    <Square size={9} fill="currentColor" />
                    <span>Stop</span>
                  </button>
                ) : (
                  <button
                    onClick={handleRun}
                    className="flex items-center gap-1.5 rounded-full border border-white/[0.1] px-3 py-1 text-[14px] text-white hover:bg-white/[0.05] transition-colors ml-1"
                  >
                    <Play size={9} fill="currentColor" />
                    <span>Run</span>
                  </button>
                )}
              </div>
            </div>

            {/* Console output */}
            <div className="flex-1 overflow-auto px-5 py-4 font-mono text-[13px] leading-7">
              {output.length === 0 ? (
                <p className="text-white/30 italic">Click Run to execute code</p>
              ) : (
                output.map((line, i) => (
                  <p key={i} className={line === "" ? "h-5" : "text-white/70"}>
                    {line}
                  </p>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
