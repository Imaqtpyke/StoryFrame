import { GenerationMode, StoryFormat } from '../types';

export const STYLE_PRESETS_STORAGE_KEY = 'storyframe_style_presets_v1';
const MAX_PRESETS = 30;

export interface StylePreset {
  id: string;
  name: string;
  characterStyle: string;
  includeFormatAndDuration: boolean;
  format?: StoryFormat;
  generationMode?: GenerationMode;
  targetVideoDuration?: number;
  updatedAt: number;
}

export interface SaveStylePresetInput {
  id?: string;
  name: string;
  characterStyle: string;
  includeFormatAndDuration: boolean;
  format?: StoryFormat;
  generationMode?: GenerationMode;
  targetVideoDuration?: number;
}

let memoryFallbackPresets: StylePreset[] = [];

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
  } catch {
    // Storage unavailable
  }
  return null;
}

function sanitizePresetsList(raw: unknown): StylePreset[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is StylePreset => {
      return (
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as StylePreset).id === 'string' &&
        typeof (item as StylePreset).name === 'string' &&
        typeof (item as StylePreset).characterStyle === 'string' &&
        (item as StylePreset).name.trim().length > 0 &&
        (item as StylePreset).characterStyle.trim().length > 0
      );
    })
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, MAX_PRESETS);
}

export function loadStylePresets(): StylePreset[] {
  const storage = getStorage();
  if (!storage) {
    return [...memoryFallbackPresets];
  }
  try {
    const raw = storage.getItem(STYLE_PRESETS_STORAGE_KEY);
    if (!raw) return [];
    return sanitizePresetsList(JSON.parse(raw));
  } catch {
    return [];
  }
}

function writePresets(presets: StylePreset[]): void {
  const clean = sanitizePresetsList(presets);
  const storage = getStorage();
  if (!storage) {
    memoryFallbackPresets = clean;
    return;
  }
  try {
    storage.setItem(STYLE_PRESETS_STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // Ignore storage quota errors
  }
}

export function saveStylePreset(input: SaveStylePresetInput): {
  presets: StylePreset[];
  saved: StylePreset;
  overwritten: boolean;
} {
  const trimmedName = input.name.trim();
  const trimmedStyle = input.characterStyle.trim();
  if (!trimmedName) {
    throw new Error('Enter a preset name before saving.');
  }
  if (!trimmedStyle) {
    throw new Error('Enter a visual style description before saving a preset.');
  }

  const existing = loadStylePresets();
  const normalizedTargetName = trimmedName.toLowerCase();
  const matchIndex = existing.findIndex(
    (p) => (input.id && p.id === input.id) || p.name.trim().toLowerCase() === normalizedTargetName
  );
  const overwritten = matchIndex >= 0;

  const entry: StylePreset = {
    id: overwritten ? existing[matchIndex].id : `preset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: trimmedName,
    characterStyle: trimmedStyle,
    includeFormatAndDuration: Boolean(input.includeFormatAndDuration),
    ...(input.includeFormatAndDuration
      ? {
          format: input.format,
          generationMode: input.generationMode,
          targetVideoDuration: input.targetVideoDuration,
        }
      : {}),
    updatedAt: Date.now(),
  };

  const next = overwritten
    ? existing.map((p, idx) => (idx === matchIndex ? entry : p))
    : [entry, ...existing];

  writePresets(next);
  return {
    presets: loadStylePresets(),
    saved: entry,
    overwritten,
  };
}

export function deleteStylePreset(id: string): StylePreset[] {
  const next = loadStylePresets().filter((p) => p.id !== id);
  writePresets(next);
  return next;
}

export function clearAllStylePresets(): void {
  writePresets([]);
}

/**
 * Resolves only the fields permitted by the preset's includeFormatAndDuration setting,
 * preventing style presets from silently flipping 16:9 / 9:16 or clip durations unless opted in.
 */
export function applyStylePresetToState(preset: StylePreset): {
  characterStyle: string;
  format?: StoryFormat;
  generationMode?: GenerationMode;
  targetVideoDuration?: number;
} {
  if (!preset.includeFormatAndDuration) {
    return {
      characterStyle: preset.characterStyle,
    };
  }
  return {
    characterStyle: preset.characterStyle,
    format: preset.format,
    generationMode: preset.generationMode,
    targetVideoDuration: preset.targetVideoDuration,
  };
}
