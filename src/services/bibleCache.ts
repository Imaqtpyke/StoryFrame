/**
 * Session Story Bible Cache
 * Caches the generated Story Bible per story based on a hash of
 * (cleanStoryText + NOTES block).
 * Switching formats (short/long) or modes (image/video) reuses the cached Bible,
 * regenerating only when the story text or NOTES change.
 */

import { StoryBible } from '../types';

const bibleSessionCache = new Map<string, StoryBible>();

/**
 * Generates a simple fast deterministic hash for a string
 */
export function hashStoryInput(storyText: string, notesText?: string): string {
  const combined = `${storyText.trim()}|||${(notesText || '').trim()}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return `bible_${hash}_len${combined.length}`;
}

/**
 * Retrieves cached Story Bible if present for this story and notes
 */
export function getCachedStoryBible(storyText: string, notesText?: string): StoryBible | null {
  if (!storyText || !storyText.trim()) return null;
  const key = hashStoryInput(storyText, notesText);
  return bibleSessionCache.get(key) || null;
}

/**
 * Saves a Story Bible into session cache
 */
export function setCachedStoryBible(storyText: string, notesText: string | undefined, bible: StoryBible): void {
  if (!storyText || !storyText.trim() || !bible) return;
  const key = hashStoryInput(storyText, notesText);
  bibleSessionCache.set(key, bible);
}

/**
 * Clears the session Story Bible cache
 */
export function clearCachedStoryBible(): void {
  bibleSessionCache.clear();
}
