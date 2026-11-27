/**
 * Local Checkpoint Persistence for Long-Form Grounded Pipeline
 * Saves Stage 1 (Story Bible), Stage 2 (Beat Plan), and incremental Stage 3/4 scenes
 * to localStorage (with in-memory fallback for non-browser tests) so failed or busy
 * generations can resume directly from the next incomplete scene.
 */

import { Scene, StoryBible } from '../types';
import { PlannedScene } from './stage2BeatPlan';
import { hashStoryInput } from './bibleCache';

export interface GroundedPipelineCheckpoint {
  key: string;
  totalWords: number;
  updatedAt: number;
  bible?: StoryBible;
  plannedScenes?: PlannedScene[];
  completedScenes: Scene[];
  lastDepicts?: string[];
}

export interface GroundedCheckpointProgress {
  key: string;
  hasBible: boolean;
  totalScenes: number;
  completedScenes: number;
  updatedAt: number;
}

const STORAGE_PREFIX = 'storyframe_grounded_ckpt_v2_';
const CHECKPOINT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const memoryFallbackStore = new Map<string, GroundedPipelineCheckpoint>();

function hasLocalStorage(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function normalizeStyleForKey(style?: string): string {
  return (style || '').trim().toLowerCase().slice(0, 120);
}

export function buildCheckpointKey(
  cleanNarration: string,
  authorNotes: string | undefined,
  format: string,
  generationMode: string,
  modelQuality: string,
  characterStyle?: string,
  targetVideoDuration?: number
): string {
  const baseHash = hashStoryInput(cleanNarration, authorNotes, characterStyle);
  const clipTag = generationMode === 'video' && targetVideoDuration ? `_clip${targetVideoDuration}s` : '';
  return `${baseHash}_${format}_${generationMode}_${modelQuality}_${normalizeStyleForKey(characterStyle)}${clipTag}`;
}

export function getGroundedCheckpoint(key: string): GroundedPipelineCheckpoint | null {
  if (!key) return null;

  const mem = memoryFallbackStore.get(key);
  if (mem) {
    if (Date.now() - mem.updatedAt > CHECKPOINT_TTL_MS) {
      memoryFallbackStore.delete(key);
      return null;
    }
    return mem;
  }

  if (!hasLocalStorage()) return null;

  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GroundedPipelineCheckpoint;
    if (!parsed || typeof parsed.updatedAt !== 'number') return null;
    if (Date.now() - parsed.updatedAt > CHECKPOINT_TTL_MS) {
      window.localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
      return null;
    }
    if (!Array.isArray(parsed.completedScenes)) {
      parsed.completedScenes = [];
    }
    memoryFallbackStore.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function saveGroundedCheckpoint(checkpoint: GroundedPipelineCheckpoint): void {
  if (!checkpoint || !checkpoint.key) return;
  const payload: GroundedPipelineCheckpoint = {
    ...checkpoint,
    updatedAt: Date.now(),
  };
  memoryFallbackStore.set(checkpoint.key, payload);

  if (!hasLocalStorage()) return;

  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${checkpoint.key}`, JSON.stringify(payload));
  } catch {
    // Prune older StoryFrame checkpoints if storage quota is tight and retry once
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX) && k !== `${STORAGE_PREFIX}${checkpoint.key}`) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => window.localStorage.removeItem(k));
      window.localStorage.setItem(`${STORAGE_PREFIX}${checkpoint.key}`, JSON.stringify(payload));
    } catch {
      // Non-fatal: in-memory fallback remains intact for active session retry
    }
  }
}

export function clearGroundedCheckpoint(key: string): void {
  if (!key) return;
  memoryFallbackStore.delete(key);
  if (!hasLocalStorage()) return;
  try {
    window.localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
  } catch {
    // Ignore storage removal errors
  }
}

export function clearAllGroundedCheckpoints(): void {
  memoryFallbackStore.clear();
  if (!hasLocalStorage()) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // Ignore
  }
}

export function summarizeGroundedCheckpoint(key: string): GroundedCheckpointProgress | null {
  const ckpt = getGroundedCheckpoint(key);
  if (!ckpt) return null;
  const totalScenes = Array.isArray(ckpt.plannedScenes) ? ckpt.plannedScenes.length : 0;
  const completedScenes = Array.isArray(ckpt.completedScenes) ? ckpt.completedScenes.length : 0;
  if (!ckpt.bible && totalScenes === 0 && completedScenes === 0) return null;
  return {
    key: ckpt.key,
    hasBible: Boolean(ckpt.bible),
    totalScenes,
    completedScenes,
    updatedAt: ckpt.updatedAt,
  };
}
