import { useEffect, useState } from 'react';
import { Activity, ArrowLeft, CheckCircle2, KeyRound, RotateCcw } from 'lucide-react';
import { ActivePage } from '../types';
import {
  AiUsageBucket,
  AiUsageSnapshot,
  ModelUsageEntry,
  formatCompactTokenCount,
  getAiUsageSnapshot,
  resetAiUsage,
  subscribeAiUsage,
} from '../services/aiUsageStorage';

interface AiUsageViewProps {
  onBack: () => void;
  onNavigate?: (page: ActivePage) => void;
}

function formatLastUpdated(timestamp?: number): string {
  if (!timestamp) return 'Not recorded yet';
  try {
    return new Date(timestamp).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Recorded locally';
  }
}

function UsageScopeCard({
  title,
  subtitle,
  bucket,
}: {
  title: string;
  subtitle: string;
  bucket: AiUsageBucket;
}) {
  const combinedOutputTokens = bucket.outputTokens + bucket.thoughtTokens;

  return (
    <section className="bg-[#121211] border border-white/10 rounded-[3px] p-5 flex flex-col justify-between space-y-5">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium text-[#E8E8E2] font-display">{title}</h2>
          <span className="text-xs font-mono tabular-nums text-[#8C8C86]">
            {bucket.requests} {bucket.requests === 1 ? 'req' : 'reqs'}
          </span>
        </div>
        <p className="text-xs text-[#8C8C86]">{subtitle}</p>
        <div className="pt-1 flex items-baseline gap-2.5">
          <span className="text-3xl font-medium tracking-tight text-white font-display tabular-nums">
            {formatCompactTokenCount(bucket.totalTokens)}
          </span>
          <span className="text-xs font-mono text-[#8C8C86] tabular-nums">
            ({bucket.totalTokens.toLocaleString()} tokens)
          </span>
        </div>
      </div>

      <dl className="pt-4 border-t border-white/10 space-y-2 text-xs font-mono tabular-nums">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-[#8C8C86]">Input Tokens</dt>
          <dd className="text-[#E6E6E0]">{bucket.inputTokens.toLocaleString()}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-[#8C8C86]">Output Tokens</dt>
          <dd className="text-[#E6E6E0]">{combinedOutputTokens.toLocaleString()}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-[#8C8C86]">Thinking Tokens</dt>
          <dd className="text-[#B5B5AE]">{bucket.thoughtTokens.toLocaleString()}</dd>
        </div>
      </dl>
    </section>
  );
}

export default function AiUsageView({ onBack, onNavigate }: AiUsageViewProps) {
  const [usage, setUsage] = useState<AiUsageSnapshot>(() => getAiUsageSnapshot());
  const [resetNotice, setResetNotice] = useState<string | null>(null);

  useEffect(() => {
    setUsage(getAiUsageSnapshot());
    return subscribeAiUsage((next) => setUsage(next));
  }, []);

  const hasUsage =
    usage.allTime.requests > 0 ||
    usage.session.requests > 0 ||
    usage.allTime.totalTokens > 0;

  const modelEntries: ModelUsageEntry[] = (Object.values(usage.byModel) as ModelUsageEntry[]).sort(
    (a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0) || b.totalTokens - a.totalTokens
  );

  const allTimeInput = usage.allTime.inputTokens;
  const allTimeOutput = usage.allTime.outputTokens;
  const allTimeThought = usage.allTime.thoughtTokens;
  const tokenBreakdownSum = allTimeInput + allTimeOutput + allTimeThought;

  const inputPct = tokenBreakdownSum > 0 ? Math.round((allTimeInput / tokenBreakdownSum) * 100) : 0;
  const outputPct = tokenBreakdownSum > 0 ? Math.round((allTimeOutput / tokenBreakdownSum) * 100) : 0;
  const thoughtPct =
    tokenBreakdownSum > 0 ? Math.max(0, 100 - inputPct - outputPct) : 0;

  const activeEngineLabel = usage.lastModel
    ? `${usage.lastProvider === 'groq' ? 'Groq' : 'Gemini'}: ${usage.lastModel}`
    : 'No active model recorded yet';

  const handleReset = () => {
    const cleared = resetAiUsage();
    setUsage(cleared);
    setResetNotice('All local AI usage counters were cleared.');
    window.setTimeout(() => setResetNotice(null), 4000);
  };

  return (
    <div id="ai-usage-page" className="w-full max-w-6xl mx-auto space-y-6 sm:space-y-8">
      {/* Top Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <button
          type="button"
          id="ai-usage-back-button"
          onClick={onBack}
          className="inline-flex items-center space-x-2 text-sm text-[#A8A8A2] hover:text-white transition-colors font-display min-h-[38px] px-1 -ml-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-white rounded-[3px] whitespace-nowrap shrink-0 cursor-pointer"
        >
          <ArrowLeft size={16} />
          <span>Back to Story Generator</span>
        </button>

        <div className="flex items-center gap-4">
          <span className="text-xs font-mono text-[#7C7C76] hidden sm:inline whitespace-nowrap">
            StoryFrame v3.7 · Client BYOK Tracker
          </span>
          {onNavigate && (
            <button
              type="button"
              id="ai-usage-manage-keys-btn"
              onClick={() => {
                onNavigate('byok-security');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-display text-[#E6E6E0] hover:text-white bg-[#141412] hover:bg-[#1C1C19] border border-white/15 hover:border-white/30 rounded-[3px] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <KeyRound size={13} className="text-[#A8A8A2]" />
              <span>Manage API Keys</span>
            </button>
          )}
        </div>
      </div>

      {/* Page Title & Reset Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-mono text-[#9C9C96]">
            <Activity size={14} className="text-amber-400 shrink-0" />
            <span>Direct Browser Telemetry</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-white font-display">
            AI Token &amp; Request Usage
          </h1>
          <p className="text-sm text-[#9C9C96] max-w-2xl">
            Live token and request counts read directly from your Google Gemini and Groq Cloud API responses.
          </p>
        </div>

        <button
          type="button"
          id="reset-ai-usage-btn"
          onClick={handleReset}
          disabled={!hasUsage}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-display font-medium rounded-[3px] border border-red-400/25 bg-red-500/[0.08] text-red-200 hover:bg-red-500/[0.15] hover:border-red-400/45 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RotateCcw size={13} />
          <span>Reset Usage</span>
        </button>
      </div>

      {resetNotice && (
        <div
          id="ai-usage-reset-notice"
          role="status"
          className="flex items-center gap-2.5 px-4 py-3 bg-emerald-500/[0.08] border border-emerald-400/25 rounded-[3px] text-xs sm:text-sm text-emerald-200"
        >
          <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
          <span>{resetNotice}</span>
        </div>
      )}

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <UsageScopeCard
          title="Current Session"
          subtitle="Active browser tab until closed"
          bucket={usage.session}
        />
        <UsageScopeCard
          title={`Today (${usage.todayDate})`}
          subtitle="Resets automatically each calendar day"
          bucket={usage.today}
        />
        <UsageScopeCard
          title="All Time"
          subtitle="Cumulative total stored in this browser"
          bucket={usage.allTime}
        />
      </div>

      {/* Token Distribution & Active Engine Summary */}
      <section className="bg-[#121211] border border-white/10 rounded-[3px] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-medium text-[#E8E8E2] font-display">
              All-Time Token Distribution
            </h2>
            <p className="text-xs text-[#8C8C86] mt-0.5">
              Last engine used: <span className="font-mono text-[#D5D5CF]">{activeEngineLabel}</span>
            </p>
          </div>
          <span className="text-xs font-mono text-[#8C8C86] tabular-nums">
            Last updated: {formatLastUpdated(usage.updatedAt)}
          </span>
        </div>

        <div className="w-full h-2 bg-[#1A1A18] rounded-[2px] overflow-hidden flex">
          {tokenBreakdownSum > 0 ? (
            <>
              {allTimeInput > 0 && (
                <div
                  style={{ width: `${(allTimeInput / tokenBreakdownSum) * 100}%` }}
                  className="bg-emerald-400/75 h-full"
                  title={`Input: ${allTimeInput.toLocaleString()} tokens`}
                />
              )}
              {allTimeOutput > 0 && (
                <div
                  style={{ width: `${(allTimeOutput / tokenBreakdownSum) * 100}%` }}
                  className="bg-amber-400/80 h-full"
                  title={`Output: ${allTimeOutput.toLocaleString()} tokens`}
                />
              )}
              {allTimeThought > 0 && (
                <div
                  style={{ width: `${(allTimeThought / tokenBreakdownSum) * 100}%` }}
                  className="bg-[#D5D5CF]/65 h-full"
                  title={`Thinking: ${allTimeThought.toLocaleString()} tokens`}
                />
              )}
            </>
          ) : (
            <div className="w-full h-full bg-white/[0.04]" />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-mono tabular-nums text-[#B5B5AE]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-[1px] bg-emerald-400/75 inline-block shrink-0" />
            <span>
              Input: {allTimeInput.toLocaleString()} ({inputPct}%)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-[1px] bg-amber-400/80 inline-block shrink-0" />
            <span>
              Output: {allTimeOutput.toLocaleString()} ({outputPct}%)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-[1px] bg-[#D5D5CF]/65 inline-block shrink-0" />
            <span>
              Thinking: {allTimeThought.toLocaleString()} ({thoughtPct}%)
            </span>
          </div>
        </div>
      </section>

      {/* Usage by Model Table */}
      <section className="bg-[#121211] border border-white/10 rounded-[3px] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-[#E8E8E2] font-display">
              Usage by Model
            </h2>
            <p className="text-xs text-[#8C8C86] mt-0.5">
              Breakdown across Gemini and Groq models called from this browser.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-[#8C8C86]">
            {modelEntries.length} {modelEntries.length === 1 ? 'model' : 'models'}
          </span>
        </div>

        {modelEntries.length === 0 ? (
          <div className="px-5 py-10 text-center space-y-4">
            <p className="text-sm text-[#9C9C96] max-w-md mx-auto">
              No AI requests recorded yet. Generate a storyboard breakdown or chat with the AI Assistant to start tracking token counts.
            </p>
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center justify-center px-4 py-2 text-xs font-display font-medium bg-white text-black hover:bg-[#E5E5DF] rounded-[3px] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Open Story Generator
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-[#151513] text-[#9C9C96] font-display">
                  <th className="py-3 px-5 font-medium">Model</th>
                  <th className="py-3 px-4 font-medium">Provider</th>
                  <th className="py-3 px-4 font-medium text-right">Requests</th>
                  <th className="py-3 px-4 font-medium text-right">Input</th>
                  <th className="py-3 px-4 font-medium text-right">Output</th>
                  <th className="py-3 px-4 font-medium text-right">Thinking</th>
                  <th className="py-3 px-5 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] font-mono tabular-nums">
                {modelEntries.map((entry) => (
                  <tr
                    key={`${entry.provider}:${entry.model}`}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-3 px-5 text-white font-medium">{entry.model}</td>
                    <td className="py-3 px-4 text-[#B5B5AE] font-display">
                      {entry.provider === 'groq' ? 'Groq Cloud' : 'Google Gemini'}
                    </td>
                    <td className="py-3 px-4 text-right text-[#D5D5CF]">
                      {entry.requests.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right text-[#D5D5CF]">
                      {entry.inputTokens.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right text-[#D5D5CF]">
                      {entry.outputTokens.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right text-[#9C9C96]">
                      {entry.thoughtTokens.toLocaleString()}
                    </td>
                    <td className="py-3 px-5 text-right text-white font-medium">
                      {entry.totalTokens.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Local Storage Privacy Notice */}
      <section className="bg-[#111110] border border-white/10 rounded-[3px] px-5 py-4 text-xs text-[#9C9C96] leading-relaxed">
        Usage figures are calculated directly from official API response metadata (<code className="font-mono text-[#D5D5CF]">usageMetadata</code> for Google Gemini and <code className="font-mono text-[#D5D5CF]">usage</code> for Groq Cloud). Counts remain strictly inside your browser (<code className="font-mono text-[#D5D5CF]">sessionStorage</code> for Current Session and <code className="font-mono text-[#D5D5CF]">localStorage</code> for Today, All Time, and Model Breakdown) and are never sent to external servers.
      </section>
    </div>
  );
}
