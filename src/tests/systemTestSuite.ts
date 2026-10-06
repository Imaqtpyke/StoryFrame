/**
 * StoryFrame Comprehensive System Verification Test Suite
 * Tests every mode, pipeline function, duration constraint,
 * hook rule, and error handling pattern across the application.
 */

import {
  extractTemporalAnchor,
  sanitizeImagePromptShotFraming,
  splitPhraseIntoSubBeats,
  enforceBeatCeilings,
  cleanRedundantOnScreenText,
} from '../services/beatSplitting';
import {
  evaluateVideoSuitability,
  updateVideoPromptDuration,
} from '../services/videoSuitability';
import {
  extractStoryTitle,
} from '../services/historyStorage';
import { Scene, Beat, StyleProfile, StoryGenerationResult } from '../types';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, suite: string, name: string, details?: string) {
  results.push({
    suite,
    name,
    passed: condition,
    details: condition ? undefined : details || 'Assertion failed',
  });
}

// ============================================================================
// 1. DURATION LIMITS & 1-SECOND CUSTOM CONSTRAINTS
// ============================================================================
console.log('\n--- Running Test Suite 1: Duration Limits & 1-Second Constraints ---');

function validateDurationInput(
  mode: 'image' | 'video',
  format: 'short' | 'long',
  valueStr: string
): { isValid: boolean; parsed?: number; error?: string } {
  const num = parseFloat(valueStr);
  if (mode === 'video') {
    if (!num || isNaN(num) || num < 1 || num > 60) {
      return { isValid: false, error: 'Please enter a custom clip duration between 1 and 60 seconds.' };
    }
    return { isValid: true, parsed: Math.round(num) };
  } else {
    if (format === 'short') {
      if (!num || isNaN(num) || num < 1 || num > 600) {
        return { isValid: false, error: 'Please enter a custom target duration between 1 and 600 seconds.' };
      }
      return { isValid: true, parsed: Math.round(num) };
    } else {
      if (!num || isNaN(num) || num < 1 || num > 120) {
        return { isValid: false, error: 'Please enter a custom target duration between 1 and 120 minutes.' };
      }
      return { isValid: true, parsed: Math.round(num * 60) };
    }
  }
}

// 1.1 Video Mode: 1-second boundary
const v1 = validateDurationInput('video', 'short', '1');
assert(v1.isValid && v1.parsed === 1, 'Duration Constraints', 'Allows 1 second clip duration in video mode');

// 1.2 Video Mode: 60-second upper boundary
const v60 = validateDurationInput('video', 'short', '60');
assert(v60.isValid && v60.parsed === 60, 'Duration Constraints', 'Allows 60 second clip duration in video mode');

// 1.3 Video Mode: Below 1 second rejected
const v0 = validateDurationInput('video', 'short', '0');
assert(!v0.isValid && typeof v0.error === 'string', 'Duration Constraints', 'Rejects 0 second clip duration');

const vNeg = validateDurationInput('video', 'short', '-5');
assert(!vNeg.isValid, 'Duration Constraints', 'Rejects negative clip duration');

const v75 = validateDurationInput('video', 'short', '75');
assert(!v75.isValid, 'Duration Constraints', 'Rejects clip duration > 60 seconds');

// 1.4 Image Mode Short: 1-second boundary
const s1 = validateDurationInput('image', 'short', '1');
assert(s1.isValid && s1.parsed === 1, 'Duration Constraints', 'Allows 1 second target duration in short-form image mode');

// 1.5 Image Mode Short: 600 seconds
const s600 = validateDurationInput('image', 'short', '600');
assert(s600.isValid && s600.parsed === 600, 'Duration Constraints', 'Allows 600 seconds target duration in short-form image mode');

// 1.6 Image Mode Short: 0 rejected
const s0 = validateDurationInput('image', 'short', '0');
assert(!s0.isValid, 'Duration Constraints', 'Rejects 0 second target duration in image mode');

// ============================================================================
// 2. TEMPORAL ANCHORS & CHRONOLOGY CONTINUITY
// ============================================================================
console.log('--- Running Test Suite 2: Temporal Anchors & Chronology ---');

const anchor1 = extractTemporalAnchor('In 1945, the war came to a sudden halt.');
assert(anchor1 === '1945', 'Temporal Anchors', 'Extracts 4-digit historical year ("1945")');

const anchor2 = extractTemporalAnchor('He waited on December 24, 1971 in the quiet rain.');
assert(anchor2?.includes('December 24, 1971') === true, 'Temporal Anchors', 'Extracts exact calendar date');

const anchor3 = extractTemporalAnchor('The lighthouse keeper remained stationed for 29 years.');
assert(anchor3 === 'for 29 years', 'Temporal Anchors', 'Extracts elapsed duration phrase ("for 29 years")');

const anchor4 = extractTemporalAnchor('Circa 300 BC, ancient mathematicians calculated the stars.');
assert(/300\s*BC/i.test(anchor4 || ''), 'Temporal Anchors', 'Extracts ancient BC/BCE temporal markers');

const anchorNull = extractTemporalAnchor('A man ordered a coffee and sat down.');
assert(anchorNull === null, 'Temporal Anchors', 'Returns null when no temporal anchor exists');

// ============================================================================
// 3. IMAGE PROMPT SANITIZATION & SHOT FRAMING PURIFICATION
// ============================================================================
console.log('--- Running Test Suite 3: Image Prompt Sanitization ---');

const dirtyPrompt1 = '[Wide Establishing Shot, Eye-Level, Static Frame] A towering gothic cathedral under storm clouds.';
const cleanPrompt1 = sanitizeImagePromptShotFraming(dirtyPrompt1);
assert(
  cleanPrompt1 === 'A towering gothic cathedral under storm clouds.',
  'Image Prompt Sanitization',
  'Strips leading bracketed camera labels [Shot, Angle, Movement]'
);

const dirtyPrompt2 = 'Extreme close-up detail shot focusing tightly on: A single antique silver coin resting on velvet.';
const cleanPrompt2 = sanitizeImagePromptShotFraming(dirtyPrompt2);
assert(
  cleanPrompt2 === 'A single antique silver coin resting on velvet.',
  'Image Prompt Sanitization',
  'Strips "focusing tightly on:" meta-framing prefixes'
);

const dirtyPrompt3 = '[Close-Up] [Low Angle] A vintage sports car roaring past the camera.';
const cleanPrompt3 = sanitizeImagePromptShotFraming(dirtyPrompt3);
assert(
  cleanPrompt3 === 'A vintage sports car roaring past the camera.',
  'Image Prompt Sanitization',
  'Strips multiple stacked bracketed tokens'
);

// ============================================================================
// 4. BEAT CEILING ENFORCEMENT & MULTI-BEAT BREAKDOWN
// ============================================================================
console.log('--- Running Test Suite 4: Beat Splitting & Ceilings ---');

const longSentence = 'The scientist carefully inserted the glowing core into the reactor, secured the titanium bolts, and activated the containment shield.';
const subBeats = splitPhraseIntoSubBeats(longSentence, 8);
assert(subBeats.length >= 3, 'Beat Decomposition', 'Partitions long sentence into 3+ digestible visual beats');

// Enforce ceilings on mock scene
const dummyBeats: Beat[] = [
  {
    beatIndex: 1,
    textSpan: 'The scientist carefully inserted the glowing core into the reactor chamber while alarms blared loudly in the distance',
    imagePrompt: 'Scientist inserting core into reactor chamber, high tension',
    estimatedSeconds: 3.5,
  },
];

const calibratedBeats = enforceBeatCeilings(dummyBeats, 1, { isVideoMode: false });
assert(calibratedBeats.length >= 2, 'Beat Ceilings', 'Subdivides oversized beats (> 2.0s or > 8 words) into compliant sub-beats');
for (const b of calibratedBeats) {
  const wordCount = b.textSpan.split(/\s+/).filter(Boolean).length;
  assert(wordCount <= 9, 'Beat Ceilings', `Sub-beat word count (${wordCount}) adheres to ceiling limit`);
}

// Test short-form rapid beat pacing on introductory prepositional sentence
const forestSentence = 'Above ground, a forest appears as individual trees, standing tall and seemingly alone.';
const forestSubBeats = splitPhraseIntoSubBeats(forestSentence, 5);
assert(
  forestSubBeats.length >= 3,
  'Short-Form Rapid Pacing',
  `Partitions "Above ground..." into ${forestSubBeats.length} rapid retention beats (expected >= 3)`
);
assert(
  forestSubBeats[0].toLowerCase().includes('above ground'),
  'Spatial Anchor Beat',
  'Preserves "Above ground," as a standalone spatial establishing beat'
);

// ============================================================================
// 5. VIDEO SUITABILITY & DURATION CALIBRATION
// ============================================================================
console.log('--- Running Test Suite 5: Video Mode Suitability & Prompt Calibration ---');

// Test 5s clip with 10 words (~2.0 words/sec -> optimal)
const suitOptimal = evaluateVideoSuitability('He pressed the red button and braced for the sudden impact.', 5, 2);
assert(suitOptimal.status === 'optimal', 'Video Suitability', 'Detects optimal narration pacing for 5s clip');

// Test 5s clip with 25 words (> 2.8 words/sec -> dense)
const suitDense = evaluateVideoSuitability(
  'He pressed the red button and braced for impact while sirens wailed and the warning lights flashed across the control deck frantically as the door locked.',
  5,
  3
);
assert(suitDense.status === 'dense', 'Video Suitability', 'Identifies overly dense voiceover for short video clips');

// Test 10s clip with 3 words (< 1.1 words/sec -> sparse)
const suitSparse = evaluateVideoSuitability('He looked up.', 10, 1);
assert(suitSparse.status === 'sparse', 'Video Suitability', 'Identifies sparse voiceover with dead air');

// Test updateVideoPromptDuration
const sampleVideoPrompt = 'Subject: Astronaut in helmet. Action: Turns head slowly. Camera: Close-Up. Duration: 5 seconds. Aspect Ratio: 16:9.';
const updatedPrompt = updateVideoPromptDuration(sampleVideoPrompt, 8, 4);
assert(updatedPrompt.includes('Duration: 8 seconds'), 'Video Prompt Duration', 'Updates prompt duration cleanly using regex replacement');

// ============================================================================
// 6. ZACK D. FILMS HOOK PATTERNS & PROMPT VERIFICATION
// ============================================================================
console.log('--- Running Test Suite 6: Zack D. Films Hook Architecture ---');

const bannedPhrases = [
  "Imagine a world where your body's internal clock sped up uncontrollably",
  "Have you ever wondered what would happen if",
  "Picture this in your mind",
  "In a distant future across the cosmos",
];

function testHookIsZackDFilms(hook: string): { passes: boolean; pattern?: string; reason?: string } {
  for (const banned of bannedPhrases) {
    if (hook.toLowerCase().includes(banned.toLowerCase())) {
      return { passes: false, reason: `Contains strictly banned weak cliché: "${banned}"` };
    }
  }

  // Check against the 6 authentic patterns:
  if (/^if you\b.*,\s*(?:you might think|you'd think|you would expect).*but\b/i.test(hook)) {
    return { passes: true, pattern: '1. Misconception Flip' };
  }
  if (/^why you should never\b|^if you ever see\b.*turn around\b/i.test(hook)) {
    return { passes: true, pattern: '2. Urgent Danger / Why You Should Never' };
  }
  if (/^(?:(?:here|this)\s+is\s+(?:what\s+)?|what\s+)(?:actually\s+)?happens\s+(?:to|inside)\s+your\b/i.test(hook)) {
    return { passes: true, pattern: '3. Visceral Internal Anatomy' };
  }
  if (/^if you\b.*(?:swallow|wrap|paint|put salt).*something (?:terrifying|bad|dangerous) happens\b/i.test(hook)) {
    return { passes: true, pattern: '4. Everyday Object Suspense' };
  }
  if (/^what (?:would happen|happens) if you\b/i.test(hook)) {
    return { passes: true, pattern: '5. Extreme Hypothetical' };
  }
  if (/^if you ever\b.*(?:insult|cross|touch).*here is why you will regret it\b/i.test(hook)) {
    return { passes: true, pattern: '6. Animal Grudge' };
  }

  return { passes: false, reason: 'Does not match any of the 6 authentic Zack D. Films hook patterns' };
}

// Test positive examples
const hook1 = "If you swallow a watermelon seed, you might think a vine will start growing in your stomach. But that is actually not what happens.";
const res1 = testHookIsZackDFilms(hook1);
assert(res1.passes, 'Zack D Films Hook Validation', 'Recognizes Misconception Flip hook');

const hook2 = "Why you should never pop a blister.";
const res2 = testHookIsZackDFilms(hook2);
assert(res2.passes, 'Zack D Films Hook Validation', 'Recognizes Urgent Danger ("Why you should never") hook');

const hook3 = "Here is what actually happens inside your lungs when you inhale cigarette smoke.";
const res3 = testHookIsZackDFilms(hook3);
assert(res3.passes, 'Zack D Films Hook Validation', 'Recognizes Internal Anatomy hook');

const hook4 = "What would happen if you were swallowed alive by a humpback whale?";
const res4 = testHookIsZackDFilms(hook4);
assert(res4.passes, 'Zack D Films Hook Validation', 'Recognizes Extreme Hypothetical hook');

// Test negative (banned cliché)
const badHook = "Imagine a world where your body's internal clock sped up uncontrollably, causing every biological process to accelerate.";
const resBad = testHookIsZackDFilms(badHook);
assert(!resBad.passes, 'Zack D Films Hook Validation', 'Strictly rejects banned cliché ("Imagine a world where...")');

// ============================================================================
// 7. ASSISTANT TEXT SANITIZER & ERROR MAPPING
// ============================================================================
console.log('--- Running Test Suite 7: Assistant Sanitizer & Error Handling ---');

function cleanAssistantText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*/g, '')
    .replace(/[\u2014\u2013]/g, ', ')
    .replace(/\s*--\s*/g, ', ')
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu, '')
    .trim();
}

const rawAssistantText = "**Scene 1:** If you swallow a magnet—it can be dangerous! 🚀 Here is why: *do not wait*.";
const cleanedAssistant = cleanAssistantText(rawAssistantText);
assert(!cleanedAssistant.includes('*'), 'Assistant Sanitizer', 'Strips all asterisks completely');
assert(!cleanedAssistant.includes('—'), 'Assistant Sanitizer', 'Converts em dashes to comma or hyphen');
assert(!cleanedAssistant.includes('🚀'), 'Assistant Sanitizer', 'Strips all emoji characters');

// Error mapping
function mapErrorToUserMessage(rawError: string, apiKey: string): string {
  const lower = rawError.toLowerCase();
  if (lower.includes('429') || lower.includes('quota')) {
    return 'Gemini API rate limit or quota exceeded. Please wait a moment before trying again.';
  }
  if (lower.includes('permission_denied') || lower.includes('403')) {
    return 'Permission denied. Please verify your Gemini API key has the Generative Language API enabled.';
  }
  if (lower.includes('503') || lower.includes('overloaded')) {
    return 'Google Gemini servers are temporarily busy (503). Please wait 10 seconds and try again.';
  }
  if (lower.includes('failed to fetch')) {
    return 'Network connection error. Please check your internet connection and try again.';
  }
  let clean = rawError;
  if (apiKey && apiKey.length > 6) {
    clean = clean.replaceAll(apiKey, '[REDACTED]');
  }
  return clean;
}

const err429 = mapErrorToUserMessage('API error (429): Resource has been exhausted', 'AIzaSySecretKey123');
assert(err429.includes('rate limit or quota exceeded'), 'Error Handling', 'Maps 429 to clear rate limit advice');

const err503 = mapErrorToUserMessage('API error (503): Service Unavailable cluster overloaded', 'AIzaSySecretKey123');
assert(err503.includes('temporarily busy'), 'Error Handling', 'Maps 503 to server busy notice with retry advice');

const errSecret = mapErrorToUserMessage('Failed at key AIzaSySecretKey123 connection lost', 'AIzaSySecretKey123');
assert(!errSecret.includes('AIzaSySecretKey123') && errSecret.includes('[REDACTED]'), 'Error Handling', 'Redacts sensitive API key from error strings');

// ============================================================================
// 8. STORY TITLE & HISTORY STORAGE CONTRACT
// ============================================================================
console.log('--- Running Test Suite 8: History & Title Extraction ---');

const title1 = extractStoryTitle('What happens if you plug an active volcano with concrete and stone?');
assert(title1.length <= 60, 'History Storage', 'Extracts title within 60 character ceiling');

const emptyTitle = extractStoryTitle('');
assert(emptyTitle === 'Untitled Story', 'History Storage', 'Provides fallback title for empty story');

// ============================================================================
// SUMMARY & TEST METRICS
// ============================================================================
console.log('\n====================================================================');
console.log('                  FULL-SYSTEM VERIFICATION REPORT                  ');
console.log('====================================================================');

const total = results.length;
const passed = results.filter(r => r.passed).length;
const failed = total - passed;

for (const r of results) {
  const icon = r.passed ? '[PASS]' : '[FAIL]';
  console.log(`${icon} [${r.suite}] ${r.name}`);
  if (!r.passed && r.details) {
    console.log(`       Error: ${r.details}`);
  }
}

console.log('--------------------------------------------------------------------');
console.log(`TOTAL TESTS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('====================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
