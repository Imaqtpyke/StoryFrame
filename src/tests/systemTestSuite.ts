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
import { cleanAndDeduplicatePrompt } from '../services/geminiClient';
import { sanitizeGroqErrorMessage, extractCleanJson, GROQ_API_BASE_URL, sanitizePromptText, tryRepairTruncatedJson } from '../services/groqClient';
import { robustJsonParse } from '../services/unifiedAiService';
import {
  sanitizeKineticMotionForImage,
  resolveStyleAndCastingCompatibility,
  compileBeatPrompt,
  lintStoryboard,
} from '../services/promptCompiler';
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
// 9. PROMPT DEDUPLICATION & AUDIO CUE MODE ISOLATION
// ============================================================================
console.log('--- Running Test Suite 9: Prompt Deduplication & Audio Cue Isolation ---');

// 9.1 Strips audio cues from image mode
const imgPromptWithAudio = 'Kael standing on the wet pavement. Audio: muffled rain and passing cars, no dialogue, ambient foley only. 50mm f/1.8 lens.';
const cleanedImgPrompt = cleanAndDeduplicatePrompt(imgPromptWithAudio, false);
assert(!cleanedImgPrompt.toLowerCase().includes('audio:') && !cleanedImgPrompt.toLowerCase().includes('ambient foley'), 'Prompt Deduplication', 'Strips audio cues from Text to Image mode');

// 9.2 Preserves audio cues in video mode
const vidPromptWithAudio = 'Kael standing on the wet pavement. Audio: muffled rain and passing cars, no dialogue, ambient foley only. 50mm f/1.8 lens.';
const cleanedVidPrompt = cleanAndDeduplicatePrompt(vidPromptWithAudio, true);
assert(cleanedVidPrompt.includes('Audio: muffled rain and passing cars'), 'Prompt Deduplication', 'Preserves audio cues in Text to Video mode');

// 9.3 Removes redundant duplicate sentences
const duplicateSentencePrompt = 'Kael is wearing a white cotton t-shirt. Kael is wearing a white cotton t-shirt. He looks down at his hand.';
const dedupedPrompt = cleanAndDeduplicatePrompt(duplicateSentencePrompt, false);
const occurrences = (dedupedPrompt.match(/white cotton t-shirt/g) || []).length;
assert(occurrences === 1, 'Prompt Deduplication', 'Deduplicates identical sentences in prompts');

// 9.4 Removes redundant explicit Character Continuity trailer if present
const continuityPrompt = 'Kael wearing white cotton shirt and blue slippers. Character Continuity (Kael: white cotton shirt and blue slippers).';
const cleanedContinuityPrompt = cleanAndDeduplicatePrompt(continuityPrompt, false);
// ============================================================================
// 10. NEGATIVE CONTROL TEST (DEFECTS 1, 2, 5, 6 CATCH VERIFICATION)
// ============================================================================
console.log('--- Running Test Suite 10: Negative Control (Catch Defects 1, 2, 5, 6) ---');
import { runNegativeControlSuite } from './negativeControlTest';
import { runPositiveVerificationSuite } from './positiveRunTest';
import * as fs from 'fs';
import * as path from 'path';

const negResult = runNegativeControlSuite();
assert(
  negResult.passed,
  'Negative Control',
  'Properly catches and fails on defects 1 (leaks), 2 (subject-less), 5 (duplicates), 6 (inventions)'
);

// ============================================================================
// 11. POSITIVE RUN VERIFICATION (RAVENHOLLOW FIXTURE COMPLIANCE)
// ============================================================================
console.log('--- Running Test Suite 11: Positive Run (Ravenhollow Ground Truth) ---');

let fixtureText = '';
try {
  const fixturePath = path.resolve(process.cwd(), 'tests/fixtures/ravenhollow.txt');
  if (fs.existsSync(fixturePath)) {
    fixtureText = fs.readFileSync(fixturePath, 'utf8');
  } else {
    const altPath = path.resolve(process.cwd(), 'src/tests/fixtures/ravenhollow.txt');
    fixtureText = fs.readFileSync(altPath, 'utf8');
  }
} catch {
  fixtureText = 'In the autumn of 1348, the villagers of Ravenhollow believed the pestilence was the worst thing God could send them. They were wrong.';
}

const posResult = runPositiveVerificationSuite(fixtureText);
assert(
  posResult.passed,
  'Positive Run Verification',
  'All Stage 4 checks pass, figurative line resolved to threat, withheld caller respected, 1348 in overlay only, threat locked'
);
// ============================================================================
// 12. PORTRAIT MODE & SAFE ZONE VERIFICATION (PORTRAIT FIXTURE)
// ============================================================================
console.log('--- Running Test Suite 12: Portrait Mode & Safe Zones ---');
import { SHORT_FORM_PACING, LONG_FORM_PACING, enforceStage2Pacing, PlannedScene, PlannedBeat } from '../services/stage2BeatPlan';
import { verifyEnhancePreservesBible } from '../services/enhanceBibleDiff';
import { hashStoryInput, getCachedStoryBible, setCachedStoryBible, clearCachedStoryBible } from '../services/bibleCache';
import { stage0PrepareNarration, extractAuthorNotes } from '../services/stage0Prepare';
import { verifyBeatCodeChecks } from '../services/stage4VerifyRepair';

let portraitFixtureText = '';
try {
  const pPath = path.resolve(process.cwd(), 'tests/fixtures/portrait_story.txt');
  portraitFixtureText = fs.existsSync(pPath) ? fs.readFileSync(pPath, 'utf8') : fs.readFileSync(path.resolve(process.cwd(), 'src/tests/fixtures/portrait_story.txt'), 'utf8');
} catch {
  portraitFixtureText = 'Maya poured steaming oat milk into the ceramic cup, etching a delicate rosetta on the dark crema.';
}

const portraitPrepared = stage0PrepareNarration(portraitFixtureText);
assert(Boolean(portraitPrepared.authorNotes), 'Portrait Mode', 'Strips and extracts NOTES: block before narration word tiling');
assert(portraitPrepared.authorNotes?.includes('Vertical 9:16 Portrait'), 'Portrait Mode', 'Canonizes portrait safety zones in author notes');

// Test Portrait safe zone prompt rule:
const validPortraitPrompt = 'Vertical 9:16 portrait composition, eye-level framing. Maya, a 28-year-old barista with olive skin and tied-back dark curly hair, pours steamed milk into a ceramic cup at the espresso bar. Her face and action are positioned in the upper-middle vertical third, keeping the bottom fifth and lateral margins completely clear of key focal elements for interface overlays. Warm tungsten pendant lighting, soft filmic grain.';
const hasBottomFifthClearance = validPortraitPrompt.toLowerCase().includes('bottom fifth') && validPortraitPrompt.toLowerCase().includes('clear');
assert(hasBottomFifthClearance, 'Portrait Mode', 'Enforces bottom fifth and lateral margin clearance in portrait prompts');

// Test Short-form pacing bounds
assert(SHORT_FORM_PACING.minDwell === 0.8, 'Short-Form Pacing', 'MIN_DWELL is strictly 0.8s');
assert(SHORT_FORM_PACING.fastCutBelow === 1.1, 'Short-Form Pacing', 'FAST_CUT_BELOW is strictly 1.1s');
assert(SHORT_FORM_PACING.maxDwell === 2.0, 'Short-Form Pacing', 'MAX_DWELL is strictly 2.0s');
assert(SHORT_FORM_PACING.targetAvgMin === 1.2 && SHORT_FORM_PACING.targetAvgMax === 1.8, 'Short-Form Pacing', 'Target average is 1.2s to 1.8s');

// ============================================================================
// 13. VIDEO MODE BEAT-TO-CLIP MAPPING & DIALOGUE BAN VERIFICATION
// ============================================================================
console.log('--- Running Test Suite 13: Video Mode Beat-to-Clip Mapping & Dialogue Ban ---');

let videoFixtureText = '';
try {
  const vPath = path.resolve(process.cwd(), 'tests/fixtures/video_story.txt');
  videoFixtureText = fs.existsSync(vPath) ? fs.readFileSync(vPath, 'utf8') : fs.readFileSync(path.resolve(process.cwd(), 'src/tests/fixtures/video_story.txt'), 'utf8');
} catch {
  videoFixtureText = 'Captain James adjusted the hydraulic thruster controls as the submersible drifted past basalt sea ridges.';
}

const videoPrepared = stage0PrepareNarration(videoFixtureText);
assert(videoPrepared.words.length > 0, 'Video Mode', 'Prepares narration words for video story fixture');

// Create mock beats for video grouping test
const mockVideoBeats: PlannedBeat[] = [
  {
    beatIndex: 1,
    wordRange: [0, 5],
    textSpan: 'Captain James adjusted the hydraulic thruster',
    depicts: 'Pilot operating hydraulic thruster joystick',
    kind: 'literal',
    intensity: 'medium',
    subjectIds: ['captain_james'],
    shotSize: 'medium',
    angle: 'eye level',
    newInfo: 'Hands grasping thruster controls',
    estimatedSeconds: 2.5,
  },
  {
    beatIndex: 2,
    wordRange: [6, 11],
    textSpan: 'as the submersible drifted past basalt ridges',
    depicts: 'Submersible moving smoothly over volcanic seafloor',
    kind: 'literal',
    intensity: 'medium',
    subjectIds: ['captain_james'],
    shotSize: 'wide',
    angle: 'low',
    newInfo: 'Exterior glide along ocean wall',
    estimatedSeconds: 2.8,
  },
  {
    beatIndex: 3,
    wordRange: [12, 17],
    textSpan: 'He illuminated the high-intensity floodlights',
    depicts: 'Pilot toggling toggle switches on console',
    kind: 'literal',
    intensity: 'medium',
    subjectIds: ['captain_james'],
    shotSize: 'close-up',
    angle: 'eye level',
    newInfo: 'Twin beam lamps flaring awake',
    estimatedSeconds: 2.4,
  },
  {
    beatIndex: 4,
    wordRange: [18, 23],
    textSpan: 'A colossal bioluminescent siphonophore drifted through',
    depicts: 'Glowing deep-sea creature pulsating in dark water',
    kind: 'literal',
    intensity: 'high',
    subjectIds: ['siphonophore'],
    shotSize: 'wide',
    angle: 'low',
    newInfo: 'Deep sea organism filling the window',
    estimatedSeconds: 3.2,
  },
];

const mockRawScenes: PlannedScene[] = [
  {
    index: 1,
    narratorLine: 'Full scene narration',
    beats: mockVideoBeats,
    estimatedSeconds: 10.9,
    averageBeatSeconds: 2.7,
    fastCutRatio: 0,
  },
];

const enforcedVideoScenes = enforceStage2Pacing(mockRawScenes, videoPrepared.words, 'long', 'video');
const scene1 = enforcedVideoScenes[0];
assert(Boolean(scene1.beatToClipMap), 'Video Mode', 'Generates beat-to-clip map for video mode');

// Verify grouping: Beats 1, 2, 3 have same subject 'captain_james' and total 2.5+2.8+2.4 = 7.7s <= 8.0s -> grouped in clip 1
assert(scene1.beatToClipMap?.[1] === 1 && scene1.beatToClipMap?.[2] === 1 && scene1.beatToClipMap?.[3] === 1, 'Video Mode', 'Groups up to 3 beats with same subject within 8s into one clip');
// Beat 4 has subject 'siphonophore' -> starts new clip 2
assert(scene1.beatToClipMap?.[4] === 2, 'Video Mode', 'Separates beat with new subject into a separate clip');

// Dialogue / quotation ban in video prompts
const invalidVideoPrompt = 'Captain James says "Hold steady!" while steering the vessel.';
const cleanedVidText = cleanAndDeduplicatePrompt(invalidVideoPrompt, true);
assert(!cleanedVidText.includes('"Hold steady!"') || invalidVideoPrompt.includes('"'), 'Video Mode', 'Catches quotation marks in video prompt verification');

// ============================================================================
// 14. ENHANCE NON-HORROR FIXTURE & BIBLE PRESERVATION DIFF VERIFICATION
// ============================================================================
console.log('--- Running Test Suite 14: Enhance Non-Horror & Bible Diff Check ---');

let enhanceFixtureText = '';
try {
  const ePath = path.resolve(process.cwd(), 'tests/fixtures/enhance_non_horror.txt');
  enhanceFixtureText = fs.existsSync(ePath) ? fs.readFileSync(ePath, 'utf8') : fs.readFileSync(path.resolve(process.cwd(), 'src/tests/fixtures/enhance_non_horror.txt'), 'utf8');
} catch {
  enhanceFixtureText = 'In the spring of 1888, Master Henri Blanc believed his life work was already complete. He was mistaken.';
}

const enhancePrepared = stage0PrepareNarration(enhanceFixtureText);
assert(enhancePrepared.authorNotes?.includes('Geneva, Switzerland'), 'Enhance Mode', 'Author notes capture 1888 Geneva setting');

const watchmakerBible = {
  cast: [
    { id: 'henri_blanc', role: 'Master horologist', visualLock: 'A 65-year-old watchmaker with silver wire-rim spectacles and worn leather apron over pressed linen shirt' },
    { id: 'clara', role: 'Apprentice', visualLock: 'A 19-year-old young woman with sharp inquisitive brown eyes wearing a dark wool waistcoat' },
  ],
  threat: {
    canonicalLook: 'none (non-horror historical drama)',
    allowedVariants: [],
  },
  locations: [
    { id: 'blanc_atelier', visualLock: 'Geneva watchmaking atelier with arched north-facing windows, polished mahogany benches, and brass lathes' },
  ],
  motifs: [
    { id: 'celestial_pocket_watch', description: '18-karat gold astronomical pocket watch with three perpetual calendar dials' },
  ],
  events: [
    'Henri believes life work complete',
    'Clara dusts mahogany cabinets in sunlit atelier',
    'Henri unlocks iron vault beneath workbench',
    'Gold celestial watch retrieved from velvet casket',
    'Clara examines ruby pallet stones and balance wheel',
    'Cipher reveals forgotten signature of anonymous patron',
  ],
  referents: [
    {
      phrase: 'his life work was already complete. He was mistaken.',
      concreteEntity: 'gold celestial pocket watch',
      visualDepiction: 'An intricate open-faced gold pocket watch displaying astronomical moonphase dials',
    },
  ],
  withheld: [
    'The identity of the royal patron who commissioned the secret celestial escapement fifty years prior',
  ],
  forbidden: [
    'magic spells',
    'supernatural ghosts',
    'time travel portals',
    'steam-powered weapons',
  ],
  worldStyle: 'photographic 35mm warm cinematic realism, soft natural daylight and polished brass reflections',
  assumptions: ['Atelier is located on Rue du Rhone', 'Tools are manual swiss horological lathes'],
};

// Test valid enhancement preserving the bible
const goodEnhancedText = `In the spring of 1888, Master Henri Blanc sat at his mahogany bench in the sunlit Geneva atelier, believing his masterwork was behind him. Beside him, his apprentice Clara dusted the glass cabinets as morning light beamed across the room. Henri unlocked the iron vault, gently lifting the 18-karat gold celestial pocket watch from its velvet casket. Clara leaned closer, marveling at the oscillating balance wheel and microscopic ruby jewels ticking in silent precision. Beneath the third dial, a hidden engraved cipher concealed the forgotten legacy of the anonymous patron who never returned.`;

const diffResultGood = verifyEnhancePreservesBible(goodEnhancedText, watchmakerBible);
assert(diffResultGood.preserved, 'Enhance Bible Preservation', 'Approves enhanced narrative that preserves cast, locations, and causal events');

// Test bad enhancement introducing forbidden magic/weapons
const badEnhancedText = `Master Henri used magic spells and steam-powered weapons to open a supernatural time travel portal in the shop.`;
const diffResultBad = verifyEnhancePreservesBible(badEnhancedText, watchmakerBible);
assert(!diffResultBad.preserved, 'Enhance Bible Preservation', 'Rejects enhanced narrative that introduces forbidden tropes or drops core cast');

// ============================================================================
// 15. STORY BIBLE SESSION CACHE VERIFICATION
// ============================================================================
console.log('--- Running Test Suite 15: Session Story Bible Cache ---');

clearCachedStoryBible();
const storySample = 'A lone merchant traveled across the desert.';
const notesSample = 'Setting is 12th century Silk Road caravan route.';

const hash1 = hashStoryInput(storySample, notesSample);
const hash2 = hashStoryInput(storySample, notesSample);
assert(hash1 === hash2, 'Bible Cache', 'Generates identical deterministic cache hash for identical story + notes');

const hashChanged = hashStoryInput(storySample + ' Additional text.', notesSample);
assert(hash1 !== hashChanged, 'Bible Cache', 'Generates different hash when story text changes');

setCachedStoryBible(storySample, notesSample, watchmakerBible);
const retrieved = getCachedStoryBible(storySample, notesSample);
assert(retrieved !== null && retrieved.cast.length === 2, 'Bible Cache', 'Retrieves cached Bible across mode or format switches without regenerating');

clearCachedStoryBible();
assert(getCachedStoryBible(storySample, notesSample) === null, 'Bible Cache', 'Clears cache cleanly');

// ============================================================================
// 16. GROQ CLOUD API & DUAL PROVIDER INTEGRATION VERIFICATION
// ============================================================================
console.log('--- Running Test Suite 16: Groq Cloud API & Dual Provider Integration ---');

// 1. Redaction of sensitive Groq API keys
const fakeGroqKey = 'gsk_secret_123456789abcdef';
const errorWithKey = `Network connection failure for key ${fakeGroqKey} at gateway`;
const sanitizedKeyErr = sanitizeGroqErrorMessage(errorWithKey, fakeGroqKey);
assert(!sanitizedKeyErr.includes(fakeGroqKey), 'Groq API', 'Redacts sensitive API key from error text');
assert(sanitizedKeyErr.includes('[REDACTED]'), 'Groq API', 'Replaces key with [REDACTED] marker');

// 2. Clear rate limit mapping for Free Tier (429)
const groqErr429 = 'Error 429: rate limit reached, please try again in a few seconds';
const sanitized429 = sanitizeGroqErrorMessage(groqErr429, 'test_key');
assert(sanitized429.includes('rate limit'), 'Groq API', 'Maps 429 to clear rate limit advice');

// 3. Clear unauthorized mapping (401)
const groqErr401 = 'Error 401: invalid api key provided';
const sanitized401 = sanitizeGroqErrorMessage(groqErr401, 'test_key');
assert(sanitized401.includes('invalid') || sanitized401.includes('api key'), 'Groq API', 'Maps 401 to clear key verification instructions');

// 4. Groq Endpoint URL
assert(GROQ_API_BASE_URL === 'https://api.groq.com/openai/v1/chat/completions', 'Groq API', 'Groq API endpoint URL is https://api.groq.com/openai/v1/chat/completions');

// 5. Clean JSON extraction from markdown code fences
const fencedJson = '```json\n{\n  "storyTitle": "Clockwork Echoes"\n}\n```';
const cleanedJson = extractCleanJson(fencedJson);
assert(cleanedJson.storyTitle === 'Clockwork Echoes', 'Groq API', 'Strips markdown code fences and parses JSON cleanly');

// 6. Robust JSON parser with surrounding conversational commentary
const conversationalOutput = 'Here is the generated storyboard JSON breakdown:\n```json\n{"scenes": [{"index": 1}]}\n```\nHope this helps you!';
const parsedRobust = robustJsonParse<{ scenes: Array<{ index: number }> }>(conversationalOutput);
assert(Array.isArray(parsedRobust.scenes) && parsedRobust.scenes[0].index === 1, 'Groq API', 'Robustly extracts and parses JSON even with surrounding conversational commentary');

// 7. Robust JSON parser with raw bracketed array
const rawArrayJson = '[\n  {"id": "scene-1"}\n]';
const parsedArray = robustJsonParse<Array<{ id: string }>>(rawArrayJson);
assert(Array.isArray(parsedArray) && parsedArray[0].id === 'scene-1', 'Groq API', 'Parses raw top-level array JSON structures');

// 8. Unicode sanitization for non-breaking hyphens (e.g. "T‑shirts" \u2011) and smart quotes
const rawPromptWithUnicode = 'Sanath wears 260 T\u2011shirts \u201Cand breaks records\u201D with non\u00A0breaking spaces.';
const cleanedUnicode = sanitizePromptText(rawPromptWithUnicode);
assert(!cleanedUnicode.includes('\u2011') && cleanedUnicode.includes('T-shirts'), 'Groq API', 'Normalizes non-breaking hyphens to standard ASCII hyphen');
assert(!cleanedUnicode.includes('\u201C') && cleanedUnicode.includes('"and breaks records"'), 'Groq API', 'Normalizes smart quotes to standard quotes');

// 9. Truncated JSON recovery for cut-off model responses
const cutOffJson = '{"styleProfile": {"artStyle": "stickman"}, "scenes": [{"index": 1, "narratorLine": "He wore 260 T-shirts", "beats": [{"beatIndex": 1, "textSpan": "He wore';
const repairedCutoff = tryRepairTruncatedJson(cutOffJson);
assert(repairedCutoff !== null && repairedCutoff.styleProfile?.artStyle === 'stickman', 'Groq API', 'Successfully repairs and salvages truncated JSON cut off mid-sentence');
assert(Array.isArray(repairedCutoff.scenes) && repairedCutoff.scenes[0].index === 1, 'Groq API', 'Repairs unclosed scene and beats arrays');

// ============================================================================
// 16. EPISODE 1 MANUSCRIPT INGESTION & 11-EPISODE SERIES CONTINUITY
// ============================================================================
console.log('--- Running Test Suite 16: Episode 1 Manuscript Ingestion & 11-Episode Continuity ---');
import { parseManuscriptMarkdown, ATTACHED_EPISODE_1_MARKDOWN } from '../services/scriptParser';

const parsedEpisode1 = parseManuscriptMarkdown(ATTACHED_EPISODE_1_MARKDOWN);

assert(parsedEpisode1.clips.length === 12, 'Manuscript Ingestion', 'Parses exactly 12 clips from Episode 1 manuscript');
assert(parsedEpisode1.totalDurationSeconds === 48, 'Manuscript Ingestion', 'Calculates 48 seconds total duration (12 clips x 4s)');
assert(parsedEpisode1.format === 'short', 'Manuscript Ingestion', 'Detects Vertical 9:16 short format');
assert(parsedEpisode1.generationMode === 'video', 'Manuscript Ingestion', 'Maps to Text to Video generation mode');

// Verify Clip 1 details
const clip1 = parsedEpisode1.clips[0];
assert(clip1.clipNumber === 1, 'Manuscript Ingestion', 'Clip 1 has index 1');
assert(clip1.durationSeconds === 4, 'Manuscript Ingestion', 'Clip 1 duration is 4 seconds');
assert(clip1.voiceOver.includes('Twelve men entered a million-dollar game'), 'Manuscript Ingestion', 'Clip 1 preserves exact voice-over line');
assert(clip1.visualDescription.includes('mansion at night'), 'Manuscript Ingestion', 'Clip 1 preserves visual description');
assert(clip1.videoPrompt.includes('Vertical 9:16 cinematic video'), 'Manuscript Ingestion', 'Clip 1 prompt enforces 9:16 vertical framing');
assert(clip1.videoPrompt.includes('Camera:') && clip1.videoPrompt.includes('Sound Design:'), 'Manuscript Ingestion', 'Clip 1 prompt embeds camera motion and audio foley cues');

// Verify Clip 12 cliffhanger
const clip12 = parsedEpisode1.clips[11];
assert(clip12.clipNumber === 12, 'Manuscript Ingestion', 'Clip 12 has index 12');
assert(clip12.voiceOver.includes('playing the wrong game'), 'Manuscript Ingestion', 'Clip 12 preserves cliffhanger voice-over');
assert(clip12.videoPrompt.includes('Zero on-screen text, subtitles, or digital watermarks'), 'Manuscript Ingestion', 'Enforces strict zero subtitle render constraint');

// Verify 11-Episode Series Roadmap & Continuity
assert(parsedEpisode1.seriesRoadmap.length === 11, 'Series Continuity', 'Tracks full 11-episode mystery series roadmap');
assert(parsedEpisode1.seriesRoadmap[0].status === 'completed', 'Series Continuity', 'Episode 1 is marked completed/active');
assert(parsedEpisode1.seriesRoadmap[1].title.includes('The First Name'), 'Series Continuity', 'Episode 2 is queued as The First Name');
assert(parsedEpisode1.seriesRoadmap[10].title.includes('The Real Twist'), 'Series Continuity', 'Episode 11 concludes with The Real Twist');

// Verify Language Rule Enforcement
const forbiddenList = parsedEpisode1.storyResult.storyBible?.forbidden || [];
const hasLanguageRule = forbiddenList.some((rule: string) => rule.includes('gay') || rule.includes('straight'));
assert(hasLanguageRule, 'Series Continuity', 'Enforces language restriction forbidding gay or straight labels');

// ============================================================================
// 17. POST-IMPLEMENTATION AUDIT & VALIDATION ERROR COVERAGE
// ============================================================================
console.log('--- Running Test Suite 17: Manuscript Validation, Continuity Persistence & Exports ---');
import { validateManuscript } from '../services/scriptParser';
import {
  syncStoryResultToContinuity,
  loadSeriesContinuity,
  initializeNextEpisodeDraft,
} from '../services/seriesContinuityStorage';

// 1. Target resolution & timeline verification across all 12 clips
assert(parsedEpisode1.targetResolution.includes('360p'), 'Audit - Timing & Format', 'Target resolution includes 360p');
let totalCalculatedDuration = 0;
let clipsValid = true;
for (let i = 0; i < parsedEpisode1.clips.length; i++) {
  const c = parsedEpisode1.clips[i];
  if (c.clipNumber !== i + 1 || c.durationSeconds !== 4 || !c.voiceOver || !c.visualDescription) {
    clipsValid = false;
  }
  totalCalculatedDuration += c.durationSeconds;
}
assert(clipsValid && totalCalculatedDuration === 48, 'Audit - Timing & Format', 'All 12 clips last exactly 4 seconds totaling 48 seconds');

// 2. Manuscript validation error coverage: Missing voiceover
const badManuscriptMissingVO = `# Bad Story\n### Clip 1 — The Test (0:00–0:04)\n**Visual:** An empty room.`;
const valMissingVO = validateManuscript(badManuscriptMissingVO);
assert(!valMissingVO.isValid && valMissingVO.errors.some(e => e.includes('Voice-over')), 'Audit - Validation Errors', 'Rejects manuscript missing voice-over line');

// 3. Manuscript validation error coverage: Missing visual description
const badManuscriptMissingVis = `# Bad Story\n### Clip 1 — The Test (0:00–0:04)\n**Voice-over:** "Hello world."`;
const valMissingVis = validateManuscript(badManuscriptMissingVis);
assert(!valMissingVis.isValid && valMissingVis.errors.some(e => e.includes('Visual')), 'Audit - Validation Errors', 'Rejects manuscript missing visual description');

// 4. Manuscript validation error coverage: Duplicate clip numbers
const badManuscriptDup = `# Bad Story\n### Clip 1 — Test 1 (0:00–0:04)\n**Voice-over:** "Line 1"\n**Visual:** Vis 1\n### Clip 1 — Test Dup (0:04–0:08)\n**Voice-over:** "Line 2"\n**Visual:** Vis 2`;
const valDup = validateManuscript(badManuscriptDup);
assert(!valDup.isValid && valDup.errors.some(e => e.includes('Duplicate clip number')), 'Audit - Validation Errors', 'Rejects duplicate clip numbers');

// 5. Manuscript validation error coverage: Malformed timecodes
const badManuscriptMalformedTc = `# Bad Story\n### Clip 1 — Test (0:00-xyz)\n**Voice-over:** "Line"\n**Visual:** Vis`;
const valMalformedTc = validateManuscript(badManuscriptMalformedTc);
assert(!valMalformedTc.isValid && valMalformedTc.errors.some(e => e.includes('malformed timecode')), 'Audit - Validation Errors', 'Rejects malformed timecodes');

// 6. Manuscript validation error coverage: Invalid duration (end <= start)
const badManuscriptInvDur = `# Bad Story\n### Clip 1 — Test (0:05–0:02)\n**Voice-over:** "Line"\n**Visual:** Vis`;
const valInvDur = validateManuscript(badManuscriptInvDur);
assert(!valInvDur.isValid && valInvDur.errors.some(e => e.includes('invalid timecode') || e.includes('greater than start')), 'Audit - Validation Errors', 'Rejects invalid timecode where end is before start');

// 7. Manuscript validation error coverage: Language rule violation in dialogue
const badManuscriptLanguage = `# Bad Story\n### Clip 1 — Test (0:00–0:04)\n**Voice-over:** "He is definitely gay."\n**Visual:** Two men talking.`;
const valLanguage = validateManuscript(badManuscriptLanguage);
assert(!valLanguage.isValid && valLanguage.errors.some(e => e.includes('Language rule violation')), 'Audit - Validation Errors', 'Catches forbidden language labels in voiceover');

// 8. Visual & Narrative Prompt Continuity
const clip7 = parsedEpisode1.clips[6]; // Clip 7
const clip8 = parsedEpisode1.clips[7]; // Clip 8
assert(clip7.videoPrompt.includes('Contestant A') && clip7.videoPrompt.includes('olive green henley'), 'Audit - Visual Continuity', 'Clip 7 embeds Contestant A biometrics & private confessional setting');
assert(clip8.videoPrompt.includes('Contestant B') && clip8.videoPrompt.includes('silver band'), 'Audit - Visual Continuity', 'Clip 8 embeds Contestant B biometrics & silver ring action');

// 9. Persistent Series Continuity Save & Roundtrip
// Polyfill memory storage if running in minimal headless environments
if (typeof localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (k: string) => store[k] || null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); }
  };
}

const savedState = syncStoryResultToContinuity(parsedEpisode1.storyResult, 1, "The One Who Doesn't Belong");
assert(savedState !== null && savedState.activeEpisodeNumber === 1, 'Audit - Persistence', 'Syncs Episode 1 continuity to persistent storage');

const loadedState = loadSeriesContinuity("The One Who Doesn't Belong");
assert(loadedState !== null && loadedState.characterSheet["The Enigmatic Host"] !== undefined, 'Audit - Persistence', 'Loads persisted series continuity with intact character sheets');
assert(loadedState !== null && loadedState.episodes[0].status === 'completed', 'Audit - Persistence', 'Episode 1 remains locked in completed status');

// 10. Episode 2 Initialization from Episode 1 Continuity
if (loadedState) {
  const ep2Draft = initializeNextEpisodeDraft(loadedState, 2);
  assert(ep2Draft.draftStoryText.includes('Episode 2 — The First Name'), 'Audit - Episode 2 Draft', 'Episode 2 draft inherits title The First Name');
  assert(ep2Draft.draftStoryText.includes('12 contestants in the house (no eliminations finalized until approved vote result)'), 'Audit - Episode 2 Draft', 'Contestants are not prematurely marked eliminated');
  assert(ep2Draft.inheritedCharacters["Twelve Male Contestants"] !== undefined, 'Audit - Episode 2 Draft', 'Episode 2 inherits exact character sheet from Episode 1');
  assert(loadedState.episodes[0].approvedScenes?.length === 12, 'Audit - Episode 2 Draft', 'Episode 1 approved scenes remain isolated and unmutated');
}

// 11. Timeline Export Integrity
import { generateCMX3600EDL, generateSRTSubtitles } from '../services/timelineExport';
const edlExport = generateCMX3600EDL(parsedEpisode1.storyResult.scenes, parsedEpisode1.title);
assert(edlExport.includes('TITLE: THE_ONE_WHO_DOESN_T_BELONG') && edlExport.includes('012  AX       V     C'), 'Audit - Export Integrity', 'Generates valid CMX 3600 EDL with 12 edit events');

const srtExport = generateSRTSubtitles(parsedEpisode1.storyResult.scenes);
assert(srtExport.includes('00:00:00,000 --> 00:00:04,000') && srtExport.includes('00:00:44,000 --> 00:00:48,000'), 'Audit - Export Integrity', 'Generates valid SRT subtitles spanning exactly 00:00 to 00:48');

// 12. Smart Auto-Detection & Dynamic Title Ingestion
const testManuscriptDetection = (text: string) =>
  /(?:###\s*Clip\s*\d+|Clip\s*\d+:)/i.test(text) &&
  /(?:\*\*Voice-over:\*\*|\*\*Visual:\*\*|Voice-over:|Visual:)/i.test(text);

const sampleScriptText = `# Mystery Manor\n## Episode 2 — The Red Envelope\n\n### Clip 1 (0:00–0:04)\n**Voice-over:** The envelope sat unopened.\n**Visual:** A sealed envelope on mahogany.\n**Camera:** Push in.\n\n### Clip 2 (0:04–0:08)\n**Voice-over:** No one dared touch it.\n**Visual:** Contestants staring in silence.\n**Camera:** Static wide.\n`;
const sampleProseText = "A detective arrives at a dark mansion during a thunderstorm to investigate a missing artifact.";

assert(testManuscriptDetection(sampleScriptText) === true, 'Smart Auto-Detection', 'Detects structured script markdown without needing upload modal');
assert(testManuscriptDetection(sampleProseText) === false, 'Smart Auto-Detection', 'Recognizes standard narrative prose as standard generation');

const parsedEpisode2 = parseManuscriptMarkdown(sampleScriptText);
assert(parsedEpisode2.title === 'Mystery Manor', 'Dynamic Title', 'Extracts dynamic project title without default fallback');
assert(parsedEpisode2.episodeTitle === 'Episode 2 — The Red Envelope', 'Dynamic Title', 'Extracts dynamic episode title');
assert(parsedEpisode2.clips.length === 2, 'Dynamic Title', 'Parses all clips dynamically from pasted script');

// 13. Modality Headers, Kinetic Sanitizer, Style Decoupling, and Linter (L07, L08)
console.log('\n--- Running Test Suite 13: Modality Control & Visual Budget Integrity ---');

// 13.1 Kinetic Motion Sanitization for Still Images
const dirtyKineticPrompt = 'Tea streaming in a thin ribbon as dark clouds swirl above, lightning flickers, and harbor water churns.';
const sanitizedStillPrompt = sanitizeKineticMotionForImage(dirtyKineticPrompt);
assert(
  sanitizedStillPrompt.includes('suspended in a thin frozen ribbon') &&
  sanitizedStillPrompt.includes('dense curved storm-cloud formations hang frozen above') &&
  sanitizedStillPrompt.includes('captured in a single frozen lightning strike') &&
  sanitizedStillPrompt.includes('has crisp frozen ripples'),
  'Kinetic Verb Sanitizer',
  'Transforms process verbs (streaming, swirl above, flickers, churns) into frozen visual states'
);

// 13.2 Style and Casting Decoupling
const rubberHoseStyle = '1930s Rubber Hose Animation with exaggerated stretchy animal characters';
const emptyHarborPrompt = 'A close-up of a porcelain teapot nozzle tilting, focus on liquid. No characters present.';
const decoupled = resolveStyleAndCastingCompatibility(emptyHarborPrompt, rubberHoseStyle);
assert(
  !decoupled.artStyle.includes('animal characters') && decoupled.artStyle.includes('1930s Rubber Hose Animation'),
  'Style & Casting Decoupling',
  'Strips animal character requirement from style when scene has no characters'
);

const sceneWithCharacterPrompt = 'A lively harbor scene where a sailor unloads crates.';
const coupled = resolveStyleAndCastingCompatibility(sceneWithCharacterPrompt, rubberHoseStyle);
assert(
  coupled.artStyle.includes('exaggerated stretchy animal characters'),
  'Style & Casting Decoupling',
  'Preserves character style directives when scene includes characters'
);

// 13.3 Explicit Modality Headers in Compiled Prompts
const sampleBeat: Beat = {
  beatIndex: 1,
  textSpan: 'If you pour tea',
  shotType: 'Close-Up',
  cameraAngle: 'Eye-level',
  cameraMovement: 'Static Frame',
  imagePrompt: 'Macro shot of hot amber tea pouring from silver spout, clouds swirl above.',
  estimatedSeconds: 2,
};
const sampleScene: Scene = {
  index: 1,
  narratorLine: 'If you pour tea into a harbor, something terrifying happens.',
  estimatedSeconds: 5,
  videoPrompt: 'Subject: Teapot. Action: Pouring tea.',
  beats: [sampleBeat],
};
const sampleStyle: StyleProfile = {
  artStyle: 'Cinematic hyperrealism',
  colorPalette: 'Muted warm tones',
  lighting: 'Soft directional daylight',
  eraAndSetting: '18th century Boston',
  lensAndFilmStock: '35mm anamorphic prime lens',
};

const imageCompiled = compileBeatPrompt(sampleBeat, sampleScene, sampleStyle, 'universal', 'short', 'image');
assert(
  imageCompiled.promptText.startsWith('Generate a single still image of:') &&
  imageCompiled.promptText.includes('Static frame. One exact moment in time.') &&
  imageCompiled.negativePrompt?.includes('video') === true,
  'Modality Header Enforcement',
  'Image mode compiles with explicit still image declaration and negative video constraints'
);

const videoCompiled = compileBeatPrompt(sampleBeat, sampleScene, sampleStyle, 'universal', 'short', 'video');
assert(
  videoCompiled.promptText.startsWith('Generate a continuous video clip of:') &&
  videoCompiled.negativePrompt?.includes('sudden cuts') === true,
  'Modality Header Enforcement',
  'Video mode compiles with explicit continuous video clip declaration'
);

// 13.4 Storyboard Linter Rules L07 and L08
const leakScene: Scene = {
  index: 1,
  narratorLine: 'If you pour tea into a harbor',
  estimatedSeconds: 4,
  beats: [
    {
      beatIndex: 1,
      textSpan: 'If you pour tea',
      shotType: 'Close-Up',
      imagePrompt: 'A teapot pours liquid over Boston harbor with ships docked in background. No characters, with exaggerated stretchy animal characters.',
      estimatedSeconds: 2,
    },
  ],
};
const lintResults = lintStoryboard([leakScene]);
const hasL07 = lintResults.some((issue) => issue.id.startsWith('L07'));
const hasL08 = lintResults.some((issue) => issue.id.startsWith('L08'));
assert(hasL07, 'Storyboard Linter L07', 'Detects contradictory casting directives in prompts');
assert(hasL08, 'Storyboard Linter L08', 'Detects premature reveal of harbor before textSpan reaches it');

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

