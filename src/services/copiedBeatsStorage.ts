import { StoryGenerationResult } from '../types';

export const COPIED_BEATS_STORAGE_KEY = 'storyframe_copied_beats_v1';
const MAX_STORED_STORIES = 25;

interface CopiedBeatsStore {
  stories: Record<string, Record<string, string>>;
  order: string[];
}

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
  } catch {
    // Storage unavailable (private mode / sandboxed)
  }
  return null;
}

const memoryFallbackStore: CopiedBeatsStore = {
  stories: {},
  order: [],
};

function readStore(): CopiedBeatsStore {
  const storage = getStorage();
  if (!storage) {
    return memoryFallbackStore;
  }
  try {
    const raw = storage.getItem(COPIED_BEATS_STORAGE_KEY);
    if (!raw) return { stories: {}, order: [] };
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.stories &&
      typeof parsed.stories === 'object' &&
      Array.isArray(parsed.order)
    ) {
      return parsed as CopiedBeatsStore;
    }
  } catch {
    // Ignore corrupted storage
  }
  return { stories: {}, order: [] };
}

function writeStore(store: CopiedBeatsStore): void {
  while (store.order.length > MAX_STORED_STORIES) {
    const oldest = store.order.shift();
    if (oldest) {
      delete store.stories[oldest];
    }
  }

  const storage = getStorage();
  if (!storage) {
    memoryFallbackStore.stories = store.stories;
    memoryFallbackStore.order = store.order;
    return;
  }

  try {
    storage.setItem(COPIED_BEATS_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // If quota exceeded, evict oldest half and retry once
    try {
      const keep = Math.max(1, Math.floor(store.order.length / 2));
      const trimmedOrder = store.order.slice(-keep);
      const trimmedStories: Record<string, Record<string, string>> = {};
      for (const key of trimmedOrder) {
        if (store.stories[key]) {
          trimmedStories[key] = store.stories[key];
        }
      }
      storage.setItem(
        COPIED_BEATS_STORAGE_KEY,
        JSON.stringify({ stories: trimmedStories, order: trimmedOrder })
      );
    } catch {
      // Ignore persistent storage errors
    }
  }
}

/**
 * Deterministic 32-bit FNV-1a hash + length suffix so any change to a beat prompt
 * produces a new hash and automatically clears stale "Copied" badges.
 */
export function hashPromptText(text: string): string {
  const normalized = (text || '').trim();
  let hash = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${(hash >>> 0).toString(36)}_${normalized.length.toString(36)}`;
}

/**
 * Builds a stable fingerprint from title + narration (excluding mutable imagePrompt text),
 * so rewriting a single beat keeps all other beats' copied checkmarks intact.
 */
export function buildStoryFingerprint(
  result: Pick<StoryGenerationResult, 'title' | 'scenes' | 'generationMode'>
): string {
  const titlePart = (result.title || 'untitled').trim().toLowerCase();
  const modePart = result.generationMode || 'image';
  const narrationPart = (result.scenes || [])
    .map((s) => `${s.index}:${(s.narratorLine || '').trim()}`)
    .join('|')
    .slice(0, 600);
  return `sf_${hashPromptText(`${modePart}::${titlePart}::${narrationPart}`)}`;
}

export function buildBeatCopyKey(sceneIndex: number, beatIndex: number): string {
  return `s${sceneIndex}-b${beatIndex}`;
}

export function loadCopiedBeatsMap(storyFingerprint: string): Record<string, string> {
  if (!storyFingerprint) return {};
  const store = readStore();
  return { ...(store.stories[storyFingerprint] || {}) };
}

export function markBeatCopied(
  storyFingerprint: string,
  sceneIndex: number,
  beatIndex: number,
  compiledPrompt: string
): Record<string, string> {
  if (!storyFingerprint || !compiledPrompt.trim()) {
    return loadCopiedBeatsMap(storyFingerprint);
  }
  const store = readStore();
  const existing = { ...(store.stories[storyFingerprint] || {}) };
  existing[buildBeatCopyKey(sceneIndex, beatIndex)] = hashPromptText(compiledPrompt);
  store.stories[storyFingerprint] = existing;
  store.order = [...store.order.filter((k) => k !== storyFingerprint), storyFingerprint];
  writeStore(store);
  return existing;
}

export function isBeatCopiedMatch(
  copiedMap: Record<string, string>,
  sceneIndex: number,
  beatIndex: number,
  compiledPrompt: string
): boolean {
  if (!copiedMap || !compiledPrompt.trim()) return false;
  const savedHash = copiedMap[buildBeatCopyKey(sceneIndex, beatIndex)];
  if (!savedHash) return false;
  return savedHash === hashPromptText(compiledPrompt);
}

export function countCopiedBeats(
  copiedMap: Record<string, string>,
  compiledEntries: { sceneIndex: number; beatIndex: number; promptText: string }[]
): number {
  let count = 0;
  for (const entry of compiledEntries) {
    if (isBeatCopiedMatch(copiedMap, entry.sceneIndex, entry.beatIndex, entry.promptText)) {
      count++;
    }
  }
  return count;
}

export function clearCopiedBeatsForStory(storyFingerprint: string): void {
  if (!storyFingerprint) return;
  const store = readStore();
  if (store.stories[storyFingerprint]) {
    delete store.stories[storyFingerprint];
    store.order = store.order.filter((k) => k !== storyFingerprint);
    writeStore(store);
  }
}
