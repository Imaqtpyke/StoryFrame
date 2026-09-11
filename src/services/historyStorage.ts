import { GenerateStoryRequest, HistoryItem, StoryGenerationResult } from '../types';

const STORAGE_KEY = 'storyframe_history_v1';
const MAX_HISTORY_ITEMS = 30;

/**
 * Extract a concise, readable title from the story text
 */
export function extractStoryTitle(story: string): string {
  if (!story || !story.trim()) return 'Untitled Story';
  const clean = story.trim().replace(/\s+/g, ' ');
  if (clean.length <= 60) return clean;
  // Truncate at word boundary
  const truncated = clean.substring(0, 57);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > 20) {
    return truncated.substring(0, lastSpace) + '...';
  }
  return truncated + '...';
}

/**
 * Load all history items from localStorage
 */
export function getHistoryItems(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(item => item && item.id && item.result && item.request);
    }
  } catch (err) {
    console.error('Failed to parse history from localStorage', err);
  }
  return [];
}

/**
 * Add a new generation to history
 */
export function addHistoryItem(request: GenerateStoryRequest, result: StoryGenerationResult): HistoryItem[] {
  try {
    const current = getHistoryItems();
    const newItem: HistoryItem = {
      id: `story_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      storyTitle: extractStoryTitle(request.story),
      request,
      result,
    };

    // Keep unique by story or prepend new, and limit to max items
    const updated = [newItem, ...current.filter(item => item.storyTitle !== newItem.storyTitle)].slice(0, MAX_HISTORY_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Failed to save story to history', err);
    return getHistoryItems();
  }
}

/**
 * Delete a specific history item
 */
export function deleteHistoryItem(id: string): HistoryItem[] {
  try {
    const current = getHistoryItems();
    const updated = current.filter(item => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Failed to remove story from history', err);
    return getHistoryItems();
  }
}

/**
 * Clear all history items
 */
export function clearAllHistory(): HistoryItem[] {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear history', err);
  }
  return [];
}
