"use client";

import { useState, useRef, useEffect } from "react";
import { X, Clock, Plus, ArrowUp, MessageCircle, PenLine } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "support";
  content: string;
  type?: "text" | "email-prompt";
}

export default function SupportChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [email, setEmail] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTyping] = useState(false);
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content: trimmed, type: "text" }]);
    setInput("");
    setTyping(true);

    setTimeout(() => {
      setTyping(false);
      if (!emailConfirmed) {
        setMessages((prev) => [
          ...prev,
          { id: `s-${Date.now()}`, role: "support", content: "Enter your email to continue", type: "email-prompt" },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { id: `s-${Date.now()}`, role: "support", content: "Thanks for reaching out! Our support team will review your question and get back to you shortly. You can also check our help articles for immediate answers.", type: "text" },
        ]);
      }
    }, 1500);
  };

  const handleEmailConfirm = () => {
    if (!email.trim()) return;
    setEmailConfirmed(true);
    setMessages((prev) => [
      ...prev,
      { id: `s-${Date.now()}`, role: "support", content: `Great, we'll follow up at ${email}. How can we help you?`, type: "text" },
    ]);
  };

  return (
    <>
      {/* Toggle button — black circle, bottom-right */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-[100] flex h-14 w-14 items-center justify-center rounded-full bg-black text-white shadow-[0_2px_12px_rgba(0,0,0,0.25)] hover:scale-105 active:scale-95 transition-transform"
        >
          <MessageCircle size={22} />
        </button>
      )}

      {/* Chat widget */}
      {open && (
        <div className="fixed bottom-6 right-6 z-[100] w-[370px] h-[540px] flex flex-col rounded-2xl bg-white shadow-[0_4px_24px_rgba(0,0,0,0.12)] border border-black/[0.08] overflow-hidden">
          {/* Top bar — pen, clock, X */}
          <div className="flex items-center justify-end gap-1 px-4 py-3">
            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-black/30 hover:text-black/60 hover:bg-black/[0.04] transition-colors">
              <PenLine size={17} />
            </button>
            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-black/30 hover:text-black/60 hover:bg-black/[0.04] transition-colors">
              <Clock size={17} />
            </button>
            <button
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-black/30 hover:text-black/60 hover:bg-black/[0.04] transition-colors"
            >
              <X size={17} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5">
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <h2 className="text-[22px] font-bold text-black text-center leading-snug">
                  Get help from<br />Mira Support
                </h2>
              </div>
            ) : (
              <div className="py-3 space-y-5">
                {messages.map((msg) => (
                  <div key={msg.id}>
                    {msg.role === "user" ? (
                      <div className="flex justify-end">
                        <div className="rounded-[20px] rounded-br-sm bg-[#f0f0f0] px-4 py-2.5 max-w-[80%]">
                          <p className="text-[15px] text-black leading-relaxed">{msg.content}</p>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-[15px] text-black/80 leading-relaxed">{msg.content}</p>
                        {msg.type === "email-prompt" && !emailConfirmed && (
                          <div className="mt-4 rounded-xl border border-black/[0.1] p-4">
                            <label className="block text-[13px] font-medium text-black/50 mb-2">Email</label>
                            <input
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="email@example.com"
                              className="w-full rounded-lg border border-black/[0.12] px-3.5 py-2.5 text-[15px] text-black placeholder-black/30 focus:outline-none focus:border-black/[0.25] transition-colors"
                              onKeyDown={(e) => e.key === "Enter" && handleEmailConfirm()}
                            />
                            <button
                              onClick={handleEmailConfirm}
                              className="mt-3 rounded-lg bg-black px-5 py-2 text-[14px] font-medium text-white hover:bg-black/80 transition-colors"
                            >
                              Confirm
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {typing && (
                  <div className="flex gap-1.5 py-1">
                    <div className="h-2.5 w-2.5 rounded-full bg-black/20 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="h-2.5 w-2.5 rounded-full bg-black/20 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="h-2.5 w-2.5 rounded-full bg-black/20 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-4 pb-2 pt-3">
            <div className="flex items-center gap-2 rounded-full border border-black/[0.12] px-4 py-2.5">
              <button className="flex h-5 w-5 items-center justify-center text-black/30">
                <Plus size={18} strokeWidth={2} />
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Ask a support question..."
                className="flex-1 bg-transparent text-[15px] text-black placeholder-black/35 focus:outline-none"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                  input.trim()
                    ? "bg-black text-white"
                    : "bg-black/[0.08] text-black/25"
                }`}
              >
                <ArrowUp size={16} strokeWidth={2.5} />
              </button>
            </div>
            <p className="mt-2 text-center text-[12px] text-[#999] mb-1">AI support can make mistakes</p>
          </div>
        </div>
      )}
    </>
  );
}
