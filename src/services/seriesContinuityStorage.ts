/**
 * Persistent Series Continuity Storage
 * Manages multi-episode story continuity, character sheets, locked rules,
 * and episodic states across browser sessions using localStorage.
 */

import { StyleProfile, StoryBible, Scene, StoryGenerationResult } from '../types';

export interface SeriesEpisodeState {
  episodeNumber: number;
  title: string;
  description: string;
  status: 'planned' | 'drafting' | 'completed' | 'draft';
  targetDurationSeconds?: number;
  approvedScenes?: Scene[];
  eliminatedContestants?: string[];
  notes?: string;
}

export interface SeriesContinuityState {
  seriesId: string;
  seriesTitle: string;
  genre: string;
  corePremise: string;
  languageRule: string;
  totalEpisodes: number;
  styleProfile: StyleProfile;
  characterSheet: Record<string, string>;
  locationSheet: Record<string, string>;
  storyBible?: StoryBible;
  activeEpisodeNumber: number;
  episodes: SeriesEpisodeState[];
  lastUpdated: number;
}

const STORAGE_KEY = 'storyframe_series_continuity_v1';

/**
 * Generates a storage key for a specific series title
 */
export function getSeriesStorageKey(seriesTitle: string): string {
  const slug = seriesTitle.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `${STORAGE_KEY}_${slug}`;
}

const memoryStore = new Map<string, string>();

function getStorageItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    if (typeof localStorage !== 'undefined' && localStorage.getItem) {
      return localStorage.getItem(key);
    }
  } catch {
    // restricted iframe / environment fallback
  }
  return memoryStore.get(key) || null;
}

function setStorageItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    } else if (typeof localStorage !== 'undefined' && localStorage.setItem) {
      localStorage.setItem(key, value);
    }
  } catch {
    // restricted iframe / environment fallback
  }
  memoryStore.set(key, value);
}

/**
 * Saves or updates approved series continuity state in localStorage
 */
export function saveSeriesContinuity(state: SeriesContinuityState): void {
  try {
    const key = getSeriesStorageKey(state.seriesTitle);
    const data = JSON.stringify({
      ...state,
      lastUpdated: Date.now(),
    });
    setStorageItem(key, data);
    // Also save as current active series
    setStorageItem(`${STORAGE_KEY}_active`, key);
  } catch (err) {
    console.error('Failed to save series continuity:', err);
  }
}

/**
 * Loads series continuity state from localStorage
 */
export function loadSeriesContinuity(seriesTitle?: string): SeriesContinuityState | null {
  try {
    const key = seriesTitle ? getSeriesStorageKey(seriesTitle) : getStorageItem(`${STORAGE_KEY}_active`);
    if (!key) return null;
    const raw = getStorageItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load series continuity:', err);
    return null;
  }
}

/**
 * Updates a specific episode's status (e.g. marking Episode 1 completed or Episode 2 drafting)
 */
export function updateEpisodeStatus(
  seriesTitle: string,
  episodeNumber: number,
  status: 'planned' | 'drafting' | 'completed',
  approvedScenes?: Scene[],
  eliminatedContestants?: string[]
): SeriesContinuityState | null {
  const current = loadSeriesContinuity(seriesTitle);
  if (!current) return null;

  const updatedEpisodes = current.episodes.map((ep) => {
    if (ep.episodeNumber === episodeNumber) {
      return {
        ...ep,
        status,
        ...(approvedScenes ? { approvedScenes } : {}),
        ...(eliminatedContestants ? { eliminatedContestants } : {}),
      };
    }
    return ep;
  });

  const updated: SeriesContinuityState = {
    ...current,
    activeEpisodeNumber: episodeNumber,
    episodes: updatedEpisodes,
    lastUpdated: Date.now(),
  };

  saveSeriesContinuity(updated);
  return updated;
}

/**
 * Creates and initializes an Episode 2 drafting payload from approved Episode 1 continuity
 */
export function initializeNextEpisodeDraft(
  current: SeriesContinuityState,
  targetEpisodeNumber: number
): {
  draftStoryText: string;
  characterStyle: string;
  format: 'short' | 'long';
  generationMode: 'video';
  targetVideoDuration: number;
  inheritedCharacters: Record<string, string>;
  inheritedLocations: Record<string, string>;
  inheritedStyle: StyleProfile;
} {
  const targetEp = current.episodes.find((e) => e.episodeNumber === targetEpisodeNumber);
  const epTitle = targetEp ? targetEp.title : `Episode ${targetEpisodeNumber}`;
  const epDesc = targetEp ? targetEp.description : 'Follow the fallout and new alliances.';

  // Build structured story template inheriting locked premise and language rule
  const draftStoryText = [
    `# ${current.seriesTitle}`,
    `## ${epTitle}`,
    ``,
    `**Format:** Vertical short-form video (9:16)`,
    `**Target duration:** 48 seconds`,
    `**Clip length:** 4 seconds each`,
    `**Number of clips:** 12`,
    `**Generation target:** 360p, text-to-video`,
    `**Genre:** ${current.genre}`,
    ``,
    `### Core premise`,
    current.corePremise,
    ``,
    `**Language rule:** ${current.languageRule}`,
    ``,
    `### Episode ${targetEpisodeNumber} outline`,
    epDesc,
    ``,
    `**Active Contestants:** 12 contestants in the house (no eliminations finalized until approved vote result).`,
  ].join('\n');

  return {
    draftStoryText,
    characterStyle: current.styleProfile.artStyle,
    format: 'short',
    generationMode: 'video',
    targetVideoDuration: 4,
    inheritedCharacters: { ...current.characterSheet },
    inheritedLocations: { ...current.locationSheet },
    inheritedStyle: { ...current.styleProfile },
  };
}

/**
 * Automatically maps and saves an approved StoryGenerationResult to SeriesContinuityState
 */
export function syncStoryResultToContinuity(
  result: StoryGenerationResult,
  episodeNumber: number = 1,
  seriesTitle?: string
): SeriesContinuityState {
  const resolvedTitle = seriesTitle || result.title || "Untitled Series";
  const existing = loadSeriesContinuity(resolvedTitle);

  // Map 11 roadmap episodes
  const roadmapEpisodes = result.seriesRoadmap && result.seriesRoadmap.length > 0
    ? result.seriesRoadmap
    : [
        { episodeNumber: 1, title: 'Episode 1 — Twelve Suspects', description: 'Introduce the prize, rules, contestants’ paranoia, and first-vote cliffhanger.', status: 'completed' as const },
        { episodeNumber: 2, title: 'Episode 2 — The First Name', description: 'Reveal the first eliminated contestant and show how the vote creates alliances.', status: 'planned' as const },
        { episodeNumber: 3, title: 'Episode 3 — The Perfect Act', description: 'A confident contestant becomes the new target after a suspicious conversation.', status: 'planned' as const },
        { episodeNumber: 4, title: 'Episode 4 — The Private Interviews', description: 'Conflicting confessions make the contestants doubt their own theories.', status: 'planned' as const },
        { episodeNumber: 5, title: 'Episode 5 — The Alliance', description: 'Several contestants agree to protect one another, but one secretly breaks the deal.', status: 'planned' as const },
        { episodeNumber: 6, title: 'Episode 6 — The Wrong Suspect', description: 'The group eliminates someone they are certain is the outsider.', status: 'planned' as const },
        { episodeNumber: 7, title: 'Episode 7 — The Pattern', description: 'A contestant notices that everyone seems to be hiding the same kind of fear.', status: 'planned' as const },
        { episodeNumber: 8, title: 'Episode 8 — The House Turns', description: 'An argument fractures the remaining alliances, and the vote becomes personal.', status: 'planned' as const },
        { episodeNumber: 9, title: 'Episode 9 — No One Trusts Anyone', description: 'The contestants are close to the final two, but their theories contradict one another.', status: 'planned' as const },
        { episodeNumber: 10, title: 'Episode 10 — Two Remain', description: 'The final vote leaves two contestants facing the prize briefcase.', status: 'planned' as const },
        { episodeNumber: 11, title: 'Episode 11 — The Real Twist', description: 'The host reveals that every contestant believed he was the outsider. The real trick was that there was no actual outsider among them; the contestants had misunderstood the premise and projected their own fears onto one another.', status: 'planned' as const },
      ];

  const episodes: SeriesEpisodeState[] = roadmapEpisodes.map((r) => {
    const existingEp = existing?.episodes.find((e) => e.episodeNumber === r.episodeNumber);
    if (r.episodeNumber === episodeNumber) {
      return {
        episodeNumber: r.episodeNumber,
        title: r.title,
        description: r.description,
        status: 'completed',
        targetDurationSeconds: result.totalDurationSeconds || 48,
        approvedScenes: result.scenes,
        eliminatedContestants: existingEp?.eliminatedContestants || [],
        notes: result.authorNotes,
      };
    }
    return existingEp || {
      episodeNumber: r.episodeNumber,
      title: r.title,
      description: r.description,
      status: r.status,
      eliminatedContestants: [],
    };
  });

  const state: SeriesContinuityState = {
    seriesId: resolvedTitle.toLowerCase().replace(/[^a-z0-9]/g, '_'),
    seriesTitle: resolvedTitle,
    genre: (result.storyBible?.worldStyle as string) || "Narrative Series",
    corePremise: result.hookAnalysis?.headlineHook || "Series narrative arc",
    languageRule: "Preserve character and narrative continuity across all episodes.",
    totalEpisodes: episodes.length,
    styleProfile: result.styleProfile,
    characterSheet: result.characterSheet || {},
    locationSheet: result.locationSheet || {},
    storyBible: result.storyBible,
    activeEpisodeNumber: episodeNumber,
    episodes,
    lastUpdated: Date.now(),
  };

  saveSeriesContinuity(state);
  return state;
}

/**
 * Checks whether persistent continuity exists for the given series
 */
export function hasSavedSeriesContinuity(seriesTitle: string = "Untitled Series"): boolean {
  return loadSeriesContinuity(seriesTitle) !== null;
}
