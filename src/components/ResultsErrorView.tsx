import React from 'react';
import { AlertCircle, ArrowLeft, RefreshCw, Sliders } from 'lucide-react';

interface ResultsErrorViewProps {
  errorMessage: string;
  onBackToEdit: () => void;
  onRetry: () => void;
  onOpenModelOptions?: () => void;
}

export default function ResultsErrorView({
  errorMessage,
  onBackToEdit,
  onRetry,
  onOpenModelOptions,
}: ResultsErrorViewProps) {
  const isKeyError =
    errorMessage.toLowerCase().includes('api key') ||
    errorMessage.toLowerCase().includes('quota') ||
    errorMessage.toLowerCase().includes('unauthenticated') ||
    errorMessage.toLowerCase().includes('permission');

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 font-narrative text-[#F5F5F0] py-6 sm:py-10">
      {/* Top Navigation */}
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <button
          type="button"
          onClick={onBackToEdit}
          className="inline-flex items-center text-xs sm:text-sm text-[#9C9C96] hover:text-white transition-colors py-1 font-display cursor-pointer"
        >
          <ArrowLeft size={13} className="mr-1.5 shrink-0 sm:w-3.5 sm:h-3.5" />
          Back to Story Form
        </button>
      </div>

      {/* Error Box */}
      <div className="p-6 sm:p-8 bg-[#121211] border border-red-500/30 rounded-[2px] corner-bracket-container shadow-2xl space-y-5">
        <div className="flex items-start space-x-3.5">
          <div className="p-2 bg-red-950/40 border border-red-500/40 rounded-[2px] shrink-0 text-red-400 mt-0.5">
            <AlertCircle size={20} />
          </div>
          <div className="space-y-1.5 flex-1">
            <h2 className="text-base sm:text-lg font-display font-medium text-white">
              Unable to Complete Story Breakdown
            </h2>
            <p className="text-xs sm:text-sm text-[#C4C4BE] leading-relaxed">
              {errorMessage}
            </p>
          </div>
        </div>

        {/* Suggestion & Next Steps */}
        <div className="p-3.5 bg-[#171715] border border-white/10 rounded-[2px] text-xs text-[#9C9C96] leading-relaxed">
          {isKeyError ? (
            <p>
              Please verify that your Google Gemini API key has been properly entered and has active quotas enabled. Your story text and configurations remain safely preserved.
            </p>
          ) : (
            <p>
              Your narrative input and selected settings were preserved. You can retry immediately or return to the editor to make adjustments.
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center px-4 py-2 bg-white text-black font-semibold text-xs rounded-[2px] hover:bg-[#EAEAE5] transition-colors cursor-pointer"
          >
            <RefreshCw size={13} className="mr-1.5" />
            Retry Breakdown
          </button>

          <button
            type="button"
            onClick={onBackToEdit}
            className="inline-flex items-center px-4 py-2 bg-[#1A1A18] text-white border border-white/20 hover:border-white text-xs rounded-[2px] transition-colors cursor-pointer"
          >
            <ArrowLeft size={13} className="mr-1.5" />
            Edit Story &amp; Settings
          </button>

          {isKeyError && onOpenModelOptions && (
            <button
              type="button"
              onClick={onOpenModelOptions}
              className="inline-flex items-center px-3 py-2 text-[#9C9C96] hover:text-white text-xs transition-colors cursor-pointer ml-auto"
            >
              <Sliders size={13} className="mr-1.5" />
              Change API Key
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
