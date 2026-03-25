"use client";

import { useState, useEffect, useCallback } from "react";
import { X, ThumbsUp, ThumbsDown } from "lucide-react";
import { submitFeedback } from "@/lib/api-client";
import { t } from "@/lib/i18n";

interface FeedbackModalProps {
  messageId: string;
  rating: "good" | "bad";
  onClose: () => void;
  onSubmitted: (rating: "good" | "bad") => void;
}

const BAD_CATEGORY_IDS = [
  "hallucination", "factual_error", "ignored_instructions", "outdated",
  "harmful", "repetitive", "too_long", "wrong_language", "other",
];

const GOOD_CATEGORY_IDS = [
  "accurate", "helpful", "well_written", "creative", "good_search", "other",
];

type Severity = "minor" | "major" | "critical";
const SEVERITY_IDS: Severity[] = ["minor", "major", "critical"];

export default function FeedbackModal({ messageId, rating, onClose, onSubmitted }: FeedbackModalProps) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [severity, setSeverity] = useState<Severity | null>(null);
  const [comment, setComment] = useState("");
  const [correction, setCorrection] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const categoryIds = rating === "bad" ? BAD_CATEGORY_IDS : GOOD_CATEGORY_IDS;
  const isGood = rating === "good";

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

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await submitFeedback(messageId, {
        rating,
        severity: !isGood ? severity ?? undefined : undefined,
        categories: selectedCategories,
        comment: comment.trim() || undefined,
        correction: correction.trim() || undefined,
      });
      setSubmitted(true);
      onSubmitted(rating);
      setTimeout(onClose, 600);
    } catch {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-[500px] mx-4 rounded-2xl bg-[#1e1e1e] border border-white/[0.06] shadow-[0_16px_64px_rgba(0,0,0,0.6)] overflow-hidden mira-fade-in max-h-[80vh] flex flex-col">
        {submitted ? (
          <div className="px-6 py-12 text-center mira-fade-in">
            <div className="flex justify-center mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06]">
                {isGood
                  ? <ThumbsUp size={18} className="text-white/50" />
                  : <ThumbsDown size={18} className="text-white/50" />
                }
              </div>
            </div>
            <p className="text-[16px] text-white/70">{t("feedback.thanks")}</p>
            <p className="text-[16px] text-white/30 mt-1">{t("feedback.thanksDetail")}</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06]">
                  {isGood
                    ? <ThumbsUp size={16} className="text-white/50" />
                    : <ThumbsDown size={16} className="text-white/50" />
                  }
                </div>
                <p className="text-[16px] text-white">
                  {isGood ? t("feedback.goodTitle") : t("feedback.badTitle")}
                </p>
              </div>
              <button
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="border-b border-white/[0.04]" />

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

              {/* Categories */}
              <div>
                <p className="text-[16px] text-white/40 mb-3">
                  {isGood ? t("feedback.goodSection") : t("feedback.badSection")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {categoryIds.map((id) => {
                    const active = selectedCategories.includes(id);
                    return (
                      <button
                        key={id}
                        onClick={() => toggleCategory(id)}
                        className={`rounded-xl border px-4 py-2 text-[16px] transition-all duration-150 ${
                          active
                            ? "border-white/[0.18] bg-white/[0.08] text-white"
                            : "border-white/[0.06] text-white/40 hover:border-white/[0.12] hover:text-white/60"
                        }`}
                      >
                        {t(`feedback.cat.${id}`)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Severity — bad only */}
              {!isGood && (
                <div>
                  <p className="text-[16px] text-white/40 mb-3">{t("feedback.severityLabel")}</p>
                  <div className="flex gap-2">
                    {SEVERITY_IDS.map((s) => {
                      const active = severity === s;
                      return (
                        <button
                          key={s}
                          onClick={() => setSeverity(active ? null : s)}
                          className={`flex-1 rounded-xl border py-2.5 text-[16px] text-center transition-all duration-150 ${
                            active
                              ? "border-white/[0.18] bg-white/[0.08] text-white"
                              : "border-white/[0.06] text-white/40 hover:border-white/[0.12] hover:text-white/60"
                          }`}
                        >
                          {t(`feedback.severity.${s}`)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Correction — bad only */}
              {!isGood && (
                <div>
                  <p className="text-[16px] text-white/40 mb-3">{t("feedback.correctionLabel")}</p>
                  <textarea
                    value={correction}
                    onChange={(e) => setCorrection(e.target.value)}
                    placeholder={t("feedback.correctionPlaceholder")}
                    rows={3}
                    maxLength={10000}
                    className="w-full resize-none rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-[16px] leading-7 text-white/70 placeholder-white/20 focus:outline-none focus:border-white/[0.12] transition-colors"
                  />
                </div>
              )}

              {/* Comment */}
              <div>
                <p className="text-[16px] text-white/40 mb-3">
                  {isGood ? t("feedback.commentLabel.good") : t("feedback.commentLabel.bad")}
                </p>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={isGood ? t("feedback.commentPlaceholder.good") : t("feedback.commentPlaceholder.bad")}
                  rows={2}
                  maxLength={2000}
                  className="w-full resize-none rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-[16px] leading-7 text-white/70 placeholder-white/20 focus:outline-none focus:border-white/[0.12] transition-colors"
                />
              </div>
            </div>

            <div className="border-t border-white/[0.04]" />

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 shrink-0">
              <span className="text-[16px] text-white/20">{t("feedback.anonymous")}</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="rounded-xl px-5 py-2.5 text-[16px] text-white/40 hover:text-white/60 transition-colors"
                >
                  {t("feedback.cancel")}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="rounded-xl bg-white px-6 py-2.5 text-[16px] font-medium text-[#161616] hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-40"
                >
                  {submitting ? "..." : t("feedback.submit")}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
