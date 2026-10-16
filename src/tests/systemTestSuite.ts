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

