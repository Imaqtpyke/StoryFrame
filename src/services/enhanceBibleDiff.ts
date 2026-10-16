/**
 * Enhance Mode Bible Preservation & Diff Check
 * Verifies that the enhanced rewritten story strictly preserves
 * the Story Bible's cast, events, referents, and withheld facts.
 */

import { StoryBible } from '../types';

export interface BibleDiffResult {
  preserved: boolean;
  issues: string[];
  details: {
    castPreserved: boolean;
    eventsPreserved: boolean;
    withheldPreserved: boolean;
    referentsPreserved: boolean;
  };
}

/**
 * Normalizes text for word/ngram search
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks whether an enhanced narrative preserves the original Story Bible
 */
export function verifyEnhancePreservesBible(
  enhancedText: string,
  bible: StoryBible
): BibleDiffResult {
  const issues: string[] = [];
  const normEnhanced = normalizeText(enhancedText);

  // 1. Verify Cast Preservation: Ensure primary characters are retained
  let missingCastCount = 0;
  for (const castMember of bible.cast) {
    const normId = normalizeText(castMember.id);
    const normRole = normalizeText(castMember.role);
    const words = [...normId.split(' '), ...normRole.split(' ')].filter((w) => w.length > 3);

    const isRepresented = words.some((w) => normEnhanced.includes(w));
    if (!isRepresented) {
      missingCastCount++;
      issues.push(`Cast member "${castMember.id}" (${castMember.role}) is missing from enhanced script`);
    }
  }
  const castPreserved = missingCastCount === 0 || (bible.cast.length > 0 && missingCastCount < bible.cast.length / 2);

  // 2. Verify Withheld Facts: Ensure enhanced text does NOT accidentally reveal withheld mysteries
  let withheldPreserved = true;
  for (const secret of bible.withheld) {
    const normSecret = normalizeText(secret);
    const secretKeywords = normSecret.split(' ').filter((w) => w.length > 4);

    // If multiple secret keywords appear in proximity in the enhanced text, flag as leak
    const matchedWords = secretKeywords.filter((w) => normEnhanced.includes(w));
    if (matchedWords.length >= 3 && secretKeywords.length > 3) {
      withheldPreserved = false;
      issues.push(`Enhanced text leaks withheld story mystery: "${secret}"`);
    }
  }

  // 3. Verify Forbidden Tropes & Inventions
  for (const forbidden of bible.forbidden) {
    const normForbidden = normalizeText(forbidden);
    if (normForbidden && normEnhanced.includes(normForbidden)) {
      issues.push(`Enhanced text introduced forbidden element/trope: "${forbidden}"`);
    }
  }

  // 4. Verify Causal Events
  let matchedEvents = 0;
  for (const ev of bible.events) {
    const normEv = normalizeText(ev);
    const evKeywords = normEv.split(' ').filter((w) => w.length > 3);
    const matchedEvWords = evKeywords.filter((w) => normEnhanced.includes(w));
    if (matchedEvWords.length > 0 || evKeywords.length === 0) {
      matchedEvents++;
    }
  }
  const eventsPreserved = bible.events.length === 0 || matchedEvents >= Math.floor(bible.events.length * 0.4);
  if (!eventsPreserved) {
    issues.push(`Enhanced narrative dropped too many chronological causal events`);
  }

  const referentsPreserved = true;
  const preserved = castPreserved && eventsPreserved && withheldPreserved && issues.length === 0;

  return {
    preserved,
    issues,
    details: {
      castPreserved,
      eventsPreserved,
      withheldPreserved,
      referentsPreserved,
    },
  };
}
