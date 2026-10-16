/**
 * Stage 0: Preparation (Deterministic Code)
 * Slices the narration into an indexed sequence of words,
 * extracts author canon from NOTES: blocks, and processes
 * optional word-timing data from SRT, VTT, or JSON files.
 */

export interface NumberedWord {
  index: number;
  word: string;
  cleanWord: string;
  startSec?: number;
  endSec?: number;
  isEstimated: boolean;
}

export interface PreparedNarration {
  rawInput: string;
  cleanNarration: string;
  authorNotes?: string;
  words: NumberedWord[];
  totalEstimatedSeconds: number;
  timingSource: 'actual' | 'estimated';
}

export interface TimingSpan {
  text: string;
  startSec: number;
  endSec: number;
}

/**
 * Extracts NOTES: block if present from raw story text
 */
export function extractAuthorNotes(input: string): { cleanStory: string; notes?: string } {
  if (!input) return { cleanStory: '' };

  // Match NOTES: followed by content up to a double newline before a story paragraph or end of string
  const notesRegex = /(?:^|\n)\s*NOTES\s*:\s*([\s\S]*?)(?=(?:\n\s*\n\s*[A-Z0-9"']|\n\s*[A-Z0-9_-]+\s*:|$))/i;
  const match = input.match(notesRegex);

  if (match) {
    const notes = match[1].trim();
    const cleanStory = input.replace(notesRegex, '\n\n').replace(/\n{3,}/g, '\n\n').trim();
    return { cleanStory, notes };
  }

  return { cleanStory: input.trim() };
}

/**
 * Parses optional SRT subtitle text to extract timed spans
 */
export function parseSrtTiming(srtContent: string): TimingSpan[] {
  const spans: TimingSpan[] = [];
  const srtBlockRegex = /(?:\d+\s+)?(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*\r?\n([\s\S]*?)(?=\n\s*\r?\n|\n*$)/g;
  let match;

  while ((match = srtBlockRegex.exec(srtContent)) !== null) {
    const startSec =
      parseInt(match[1], 10) * 3600 +
      parseInt(match[2], 10) * 60 +
      parseInt(match[3], 10) +
      parseInt(match[4], 10) / 1000;
    const endSec =
      parseInt(match[5], 10) * 3600 +
      parseInt(match[6], 10) * 60 +
      parseInt(match[7], 10) +
      parseInt(match[8], 10) / 1000;
    const text = match[9].replace(/<[^>]+>/g, '').replace(/\r?\n/g, ' ').trim();
    if (text) {
      spans.push({ text, startSec, endSec });
    }
  }

  return spans;
}

/**
 * Parses optional VTT subtitle text to extract timed spans
 */
export function parseVttTiming(vttContent: string): TimingSpan[] {
  const spans: TimingSpan[] = [];
  const vttBlockRegex = /(?:(\d{2}):)?(\d{2}):(\d{2})[.](\d{3})\s*-->\s*(?:(\d{2}):)?(\d{2}):(\d{2})[.](\d{3})\s*\r?\n([\s\S]*?)(?=\n\s*\r?\n|\n*$)/g;
  let match;

  while ((match = vttBlockRegex.exec(vttContent)) !== null) {
    const startHours = match[1] ? parseInt(match[1], 10) : 0;
    const startSec =
      startHours * 3600 +
      parseInt(match[2], 10) * 60 +
      parseInt(match[3], 10) +
      parseInt(match[4], 10) / 1000;

    const endHours = match[5] ? parseInt(match[5], 10) : 0;
    const endSec =
      endHours * 3600 +
      parseInt(match[6], 10) * 60 +
      parseInt(match[7], 10) +
      parseInt(match[8], 10) / 1000;

    const text = match[9].replace(/<[^>]+>/g, '').replace(/\r?\n/g, ' ').trim();
    if (text) {
      spans.push({ text, startSec, endSec });
    }
  }

  return spans;
}

/**
 * Parses optional JSON word timing (ElevenLabs, Whisper, or CapCut export)
 */
export function parseJsonWordTiming(jsonContent: string): TimingSpan[] {
  try {
    const parsed = JSON.parse(jsonContent);
    const wordsList = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.words)
      ? parsed.words
      : Array.isArray(parsed.segments)
      ? parsed.segments
      : null;

    if (!wordsList) return [];

    return wordsList
      .map((item: any) => {
        const text = item.word || item.text || '';
        const startSec = typeof item.start === 'number' ? item.start : typeof item.startSec === 'number' ? item.startSec : 0;
        const endSec = typeof item.end === 'number' ? item.end : typeof item.endSec === 'number' ? item.endSec : startSec + 0.5;
        return { text: String(text).trim(), startSec, endSec };
      })
      .filter((s: TimingSpan) => s.text.length > 0);
  } catch {
    return [];
  }
}

/**
 * Main Stage 0 entry point: prepares narration words and timings
 */
export function stage0PrepareNarration(
  rawInput: string,
  timingPayload?: string
): PreparedNarration {
  const { cleanStory, notes } = extractAuthorNotes(rawInput);

  // Split into raw words preserving whitespace separation
  const rawWords = cleanStory.split(/\s+/).filter(Boolean);

  let spans: TimingSpan[] = [];
  let timingSource: 'actual' | 'estimated' = 'estimated';

  if (timingPayload && timingPayload.trim()) {
    const trimmed = timingPayload.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      spans = parseJsonWordTiming(trimmed);
    } else if (trimmed.includes('-->')) {
      if (trimmed.startsWith('WEBVTT') || trimmed.includes('WEBVTT')) {
        spans = parseVttTiming(trimmed);
      } else {
        spans = parseSrtTiming(trimmed);
      }
    }
    if (spans.length > 0) {
      timingSource = 'actual';
    }
  }

  const words: NumberedWord[] = [];
  const standardWordsPerSec = 2.33; // ~140 WPM

  let runningSec = 0;

  for (let i = 0; i < rawWords.length; i++) {
    const raw = rawWords[i];
    const clean = raw.toLowerCase().replace(/[^a-z0-9]/g, '');

    let startSec: number;
    let endSec: number;
    let isEstimated = true;

    if (timingSource === 'actual' && spans.length > 0) {
      // Find matching span by index or approximate position
      if (i < spans.length) {
        startSec = spans[i].startSec;
        endSec = spans[i].endSec;
        isEstimated = false;
      } else {
        startSec = runningSec;
        endSec = runningSec + 1 / standardWordsPerSec;
      }
    } else {
      startSec = Math.round(runningSec * 100) / 100;
      const wordDuration = 1 / standardWordsPerSec;
      endSec = Math.round((runningSec + wordDuration) * 100) / 100;
      runningSec = endSec;
    }

    words.push({
      index: i,
      word: raw,
      cleanWord: clean,
      startSec,
      endSec,
      isEstimated,
    });
  }

  const totalEstimatedSeconds = words.length > 0 ? words[words.length - 1].endSec || runningSec : 0;

  return {
    rawInput,
    cleanNarration: cleanStory,
    authorNotes: notes,
    words,
    totalEstimatedSeconds: Math.max(1, Math.round(totalEstimatedSeconds * 10) / 10),
    timingSource,
  };
}
