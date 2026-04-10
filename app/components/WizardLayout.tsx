"use client";

import { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onNext?: () => void;
  onBack?: () => void;
  nextLabel?: string;
  canAdvance?: boolean;
  showNext?: boolean;
  showBack?: boolean;
}

/**
 * WizardLayout wraps each wizard screen with a sticky section header
 * (title, optional subtitle, Back / Continue action buttons) and the
 * screen's content below.
 */
export default function WizardLayout({
  title,
  subtitle,
  children,
  onNext,
  onBack,
  nextLabel = "Continue",
  canAdvance = true,
  showNext = true,
  showBack = true,
}: Props) {
  return (
    <div>
      {/* Sticky section header */}
      <div className="sticky top-[57px] sm:top-[calc(57px+73px)] z-30 bg-white shadow-sm border-b border-gray-100 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold truncate">{title}</h2>
          {subtitle && (
            <p className="text-gray-500 text-sm mt-0.5 hidden sm:block">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {showBack && onBack && (
            <button
              onClick={onBack}
              className="border border-gray-300 text-sm font-medium py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1"
            >
              ← <span className="hidden sm:inline">Back</span>
            </button>
          )}
          {showNext && onNext && (
            <button
              onClick={onNext}
              disabled={!canAdvance}
              className="bg-[#0696D7] hover:bg-[#0580BC] text-white text-sm font-medium py-2 px-5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              {nextLabel} →
            </button>
          )}
        </div>
      </div>

      {/* Screen content */}
      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">{children}</div>
    </div>
  );
}
