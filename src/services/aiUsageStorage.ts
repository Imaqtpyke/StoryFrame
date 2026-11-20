import { AiProvider } from '../types';

export interface AiUsageBucket {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  thoughtTokens: number;
  totalTokens: number;
}

export interface ModelUsageEntry extends AiUsageBucket {
  provider: AiProvider;
  model: string;
  lastUsedAt?: number;
}

export interface AiUsageSnapshot {
  todayDate: string;
  session: AiUsageBucket;
  today: AiUsageBucket;
  allTime: AiUsageBucket;
  byModel: Record<string, ModelUsageEntry>;
  lastProvider?: AiProvider;
  lastModel?: string;
  updatedAt?: number;
}

const LOCAL_USAGE_KEY = 'storyframe_ai_usage_v1';
const SESSION_USAGE_KEY = 'storyframe_ai_usage_session_v1';
const USAGE_EVENT_NAME = 'storyframe:ai-usage-updated';

function emptyBucket(): AiUsageBucket {
  return {
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    thoughtTokens: 0,
    totalTokens: 0,
  };
}

function getTodayIsoDate(): string {
  try {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  } catch {
    return '1970-01-01';
  }
}

let memorySnapshot: AiUsageSnapshot = {
  todayDate: getTodayIsoDate(),
  session: emptyBucket(),
  today: emptyBucket(),
  allTime: emptyBucket(),
  byModel: {},
};

const listeners = new Set<(snapshot: AiUsageSnapshot) => void>();

function sanitizeBucket(raw: any): AiUsageBucket {
  if (!raw || typeof raw !== 'object') return emptyBucket();
  return {
    requests: Number.isFinite(Number(raw.requests)) ? Math.max(0, Math.round(Number(raw.requests))) : 0,
    inputTokens: Number.isFinite(Number(raw.inputTokens)) ? Math.max(0, Math.round(Number(raw.inputTokens))) : 0,
    outputTokens: Number.isFinite(Number(raw.outputTokens)) ? Math.max(0, Math.round(Number(raw.outputTokens))) : 0,
    thoughtTokens: Number.isFinite(Number(raw.thoughtTokens)) ? Math.max(0, Math.round(Number(raw.thoughtTokens))) : 0,
    totalTokens: Number.isFinite(Number(raw.totalTokens)) ? Math.max(0, Math.round(Number(raw.totalTokens))) : 0,
  };
}

function sanitizeByModel(raw: any): Record<string, ModelUsageEntry> {
  if (!raw || typeof raw !== 'object') return {};
  const result: Record<string, ModelUsageEntry> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (!val || typeof val !== 'object') continue;
    const item = val as Record<string, any>;
    const provider: AiProvider = item.provider === 'groq' ? 'groq' : 'gemini';
    const modelName = typeof item.model === 'string' && item.model.trim() ? item.model.trim() : key;
    const bucket = sanitizeBucket(item);
    result[key] = {
      ...bucket,
      provider,
      model: modelName,
      lastUsedAt: typeof item.lastUsedAt === 'number' ? item.lastUsedAt : undefined,
    };
  }
  return result;
}

function cloneByModel(byModel: Record<string, ModelUsageEntry>): Record<string, ModelUsageEntry> {
  const cloned: Record<string, ModelUsageEntry> = {};
  for (const [key, entry] of Object.entries(byModel || {})) {
    cloned[key] = { ...entry };
  }
  return cloned;
}

function loadSnapshotFromStorage(): AiUsageSnapshot {
  const todayDate = getTodayIsoDate();
  if (typeof window === 'undefined') {
    if (memorySnapshot.todayDate !== todayDate) {
      memorySnapshot = {
        ...memorySnapshot,
        todayDate,
        today: emptyBucket(),
      };
    }
    return {
      ...memorySnapshot,
      session: { ...memorySnapshot.session },
      today: { ...memorySnapshot.today },
      allTime: { ...memorySnapshot.allTime },
      byModel: cloneByModel(memorySnapshot.byModel),
    };
  }

  let storedLocal: any = null;
  let storedSession: any = null;
  try {
    const rawLocal = window.localStorage.getItem(LOCAL_USAGE_KEY);
    if (rawLocal) storedLocal = JSON.parse(rawLocal);
  } catch {
    storedLocal = null;
  }
  try {
    const rawSession = window.sessionStorage.getItem(SESSION_USAGE_KEY);
    if (rawSession) storedSession = JSON.parse(rawSession);
  } catch {
    storedSession = null;
  }

  const allTime = sanitizeBucket(storedLocal?.allTime);
  const storedDate = typeof storedLocal?.todayDate === 'string' ? storedLocal.todayDate : '';
  const today = storedDate === todayDate ? sanitizeBucket(storedLocal?.today) : emptyBucket();
  const session = sanitizeBucket(storedSession);
  const byModel = sanitizeByModel(storedLocal?.byModel);

  return {
    todayDate,
    session,
    today,
    allTime,
    byModel,
    lastProvider: storedLocal?.lastProvider === 'groq' ? 'groq' : storedLocal?.lastProvider === 'gemini' ? 'gemini' : undefined,
    lastModel: typeof storedLocal?.lastModel === 'string' ? storedLocal.lastModel : undefined,
    updatedAt: typeof storedLocal?.updatedAt === 'number' ? storedLocal.updatedAt : undefined,
  };
}

function persistSnapshot(snapshot: AiUsageSnapshot): void {
  memorySnapshot = snapshot;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        LOCAL_USAGE_KEY,
        JSON.stringify({
          todayDate: snapshot.todayDate,
          today: snapshot.today,
          allTime: snapshot.allTime,
          byModel: snapshot.byModel,
          lastProvider: snapshot.lastProvider,
          lastModel: snapshot.lastModel,
          updatedAt: snapshot.updatedAt,
        })
      );
    } catch {
      // Ignore storage quota errors
    }
    try {
      window.sessionStorage.setItem(SESSION_USAGE_KEY, JSON.stringify(snapshot.session));
    } catch {
      // Ignore storage quota errors
    }
    try {
      window.dispatchEvent(new CustomEvent(USAGE_EVENT_NAME, { detail: snapshot }));
    } catch {
      // Ignore custom event errors
    }
  }

  for (const listener of listeners) {
    try {
      listener(snapshot);
    } catch {
      // Non-fatal listener guard
    }
  }
}

function addDelta(
  bucket: AiUsageBucket,
  delta: { inputTokens: number; outputTokens: number; thoughtTokens: number; totalTokens: number }
): AiUsageBucket {
  return {
    requests: bucket.requests + 1,
    inputTokens: bucket.inputTokens + delta.inputTokens,
    outputTokens: bucket.outputTokens + delta.outputTokens,
    thoughtTokens: bucket.thoughtTokens + delta.thoughtTokens,
    totalTokens: bucket.totalTokens + delta.totalTokens,
  };
}

export function getAiUsageSnapshot(): AiUsageSnapshot {
  return loadSnapshotFromStorage();
}

export function recordAiUsage(entry: {
  provider: AiProvider;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  thoughtTokens?: number;
  totalTokens?: number;
}): AiUsageSnapshot {
  const current = loadSnapshotFromStorage();
  const inputTokens = Math.max(0, Math.round(Number(entry.inputTokens) || 0));
  const outputTokens = Math.max(0, Math.round(Number(entry.outputTokens) || 0));
  const thoughtTokens = Math.max(0, Math.round(Number(entry.thoughtTokens) || 0));
  const computedTotal = inputTokens + outputTokens + thoughtTokens;
  const totalTokens = Math.max(computedTotal, Math.round(Number(entry.totalTokens) || 0));

  const delta = { inputTokens, outputTokens, thoughtTokens, totalTokens };
  const now = Date.now();
  const cleanModel = entry.model?.trim() || 'unknown';
  const modelKey = `${entry.provider}:${cleanModel}`;
  const prevModelEntry = current.byModel?.[modelKey] || {
    ...emptyBucket(),
    provider: entry.provider,
    model: cleanModel,
  };
  const updatedByModel: Record<string, ModelUsageEntry> = {
    ...cloneByModel(current.byModel),
    [modelKey]: {
      ...addDelta(prevModelEntry, delta),
      provider: entry.provider,
      model: cleanModel,
      lastUsedAt: now,
    },
  };

  const next: AiUsageSnapshot = {
    todayDate: getTodayIsoDate(),
    session: addDelta(current.session, delta),
    today: addDelta(current.today, delta),
    allTime: addDelta(current.allTime, delta),
    byModel: updatedByModel,
    lastProvider: entry.provider,
    lastModel: cleanModel,
    updatedAt: now,
  };

  persistSnapshot(next);
  return next;
}

export function extractAndRecordGeminiUsage(resJson: any, model: string): AiUsageSnapshot | null {
  if (!resJson || typeof resJson !== 'object') return null;
  const meta = resJson.usageMetadata;
  if (!meta || typeof meta !== 'object') {
    return recordAiUsage({ provider: 'gemini', model });
  }
  const inputTokens = Number(meta.promptTokenCount) || 0;
  const outputTokens = Number(meta.candidatesTokenCount) || 0;
  const thoughtTokens = Number(meta.thoughtsTokenCount) || 0;
  const totalTokens = Number(meta.totalTokenCount) || inputTokens + outputTokens + thoughtTokens;
  return recordAiUsage({
    provider: 'gemini',
    model,
    inputTokens,
    outputTokens,
    thoughtTokens,
    totalTokens,
  });
}

export function extractAndRecordGroqUsage(resJson: any, model: string): AiUsageSnapshot | null {
  if (!resJson || typeof resJson !== 'object') return null;
  const usage = resJson.usage || resJson.x_groq?.usage;
  if (!usage || typeof usage !== 'object') {
    return recordAiUsage({ provider: 'groq', model });
  }
  const inputTokens = Number(usage.prompt_tokens) || 0;
  const outputTokens = Number(usage.completion_tokens) || 0;
  const totalTokens = Number(usage.total_tokens) || inputTokens + outputTokens;
  return recordAiUsage({
    provider: 'groq',
    model,
    inputTokens,
    outputTokens,
    thoughtTokens: 0,
    totalTokens,
  });
}

export function resetAiUsage(): AiUsageSnapshot {
  const empty: AiUsageSnapshot = {
    todayDate: getTodayIsoDate(),
    session: emptyBucket(),
    today: emptyBucket(),
    allTime: emptyBucket(),
    byModel: {},
    updatedAt: Date.now(),
  };
  persistSnapshot(empty);
  return empty;
}

export function subscribeAiUsage(listener: (snapshot: AiUsageSnapshot) => void): () => void {
  listeners.add(listener);
  const handleWindowEvent = (ev: Event) => {
    const custom = ev as CustomEvent<AiUsageSnapshot>;
    if (custom?.detail) {
      listener(custom.detail);
    } else {
      listener(loadSnapshotFromStorage());
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener(USAGE_EVENT_NAME, handleWindowEvent);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== 'undefined') {
      window.removeEventListener(USAGE_EVENT_NAME, handleWindowEvent);
    }
  };
}

export function formatCompactTokenCount(count: number): string {
  const safe = Math.max(0, Math.round(Number(count) || 0));
  if (safe >= 1_000_000) {
    return `${(safe / 1_000_000).toFixed(2)}M`;
  }
  if (safe >= 10_000) {
    return `${(safe / 1_000).toFixed(1)}k`;
  }
  if (safe >= 1_000) {
    return `${(safe / 1_000).toFixed(2)}k`;
  }
  return String(safe);
}
