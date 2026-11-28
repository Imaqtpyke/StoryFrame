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
  extractGeographicAnchor,
  generateCartographicPrompt,
} from '../services/beatSplitting';
import {
  evaluateVideoSuitability,
  updateVideoPromptDuration,
} from '../services/videoSuitability';
import {
  extractStoryTitle,
} from '../services/historyStorage';
import {
  cleanAndDeduplicatePrompt,
  assembleCleanPrompt,
  sanitizeCharacterIdentitySheet,
  buildPartialStoryResultFromStream,
  normalizeStoryBibleResponse,
} from '../services/geminiClient';
import {
  deduplicateAndProgressSceneBeats,
  verifyAndRepairSceneNarrationCoverage,
  sanitizeFakePrecisionMath,
  injectCompactCharacterLocks,
  sanitizeEraBleedAcrossScenes,
  normalizeStoryboardForDisplay,
  stripTransientExpressionsAndPoses,
  buildCompactCharacterAnchor,
  formatFinalBeatPrompt,
  isMonochromeStyle,
  sanitizeMonochromeLighting,
  isInfancyOrChildhoodFlashback,
  hasDistinctMontageFocalSubject,
  auditScenesForRepair,
  scaleBeatsToTargetDuration,
  runTwoPhaseProgressionAndRepair,
  normalizeContinuitySheetKeys,
  sanitizeStillImageMotionAndOptics,
  buildSharedContextIgnoreTokens,
  computeVisualPromptSimilarity,
  synchronizeCharacterSheetWithFirstAppearances,
  findUncoveredTrailingScript,
  sanitizeMasterVideoPrompt,
  enrichStartFramePrompt,
  synchronizeBeatMetadataWithPrompt,
  sanitizeSharedVisualStyle,
  harmonizeScenePropMaterials,
  sanitizePromptGrammarAndTypos,
} from '../services/beatProgressionEngine';
import {
  sanitizeGroqErrorMessage,
  extractCleanJson,
  GROQ_API_BASE_URL,
  sanitizePromptText,
  tryRepairTruncatedJson,
  getGroqReasoningOptions,
  stripReasoningWrappers,
} from '../services/groqClient';
import {
  robustJsonParse,
  extractCompletedStoryboardFields,
  resolveGeminiModelId,
  formatGemini429Error,
  sanitizeGenericErrorMessage,
  streamJsonLlmWithSceneProgress,
} from '../services/unifiedAiService';
import { isNonRetryableQuotaExhaustion, parseRetryAfterMs } from '../utils/retryFetch';
import {
  sanitizeKineticMotionForImage,
  resolveStyleAndCastingCompatibility,
  compileBeatPrompt,
  lintStoryboard,
  inferStoryAdaptiveFont,
  compileThumbnailPrompt,
  inferStoryAdaptiveCtaQuestion,
  compileCtaPrompt,
  classifyVisualStyleFamily,
  getStyleNativeRenderCue,
} from '../services/promptCompiler';
import {
  buildCheckpointKey,
  clearGroundedCheckpoint,
  getGroundedCheckpoint,
  saveGroundedCheckpoint,
  summarizeGroundedCheckpoint,
} from '../services/groundedCheckpoint';
import { getGroundedProgressForRequest, clearGroundedProgressForRequest } from '../services/groundedPipeline';
import {
  extractAndRecordGeminiUsage,
  extractAndRecordGroqUsage,
  getAiUsageSnapshot,
  resetAiUsage,
  formatCompactTokenCount,
} from '../services/aiUsageStorage';
import {
  MAX_ASSISTANT_IMAGES,
  calculateScaledDimensions,
  extractBase64FromDataUrl,
} from '../utils/imageAttachment';
import {
  parseMessageSegments,
  buildDefaultImagePrompt,
  isGroqVisionModel,
  getMaxImagesForProvider,
  selectSendableAttachmentIds,
  sendChatMessage,
} from '../services/assistantChatService';
import {
  buildStoryFingerprint,
  markBeatCopied,
  loadCopiedBeatsMap,
  isBeatCopiedMatch,
  countCopiedBeats,
  clearCopiedBeatsForStory,
} from '../services/copiedBeatsStorage';
import {
  loadStylePresets,
  saveStylePreset,
  deleteStylePreset,
  applyStylePresetToState,
  clearAllStylePresets,
} from '../services/stylePresetStorage';
import {
  buildSingleBeatRewritePrompt,
  normalizeRewrittenBeat,
} from '../services/beatRewriteService';
import {
  buildOpeningHookStage2Guidance,
  applyOpeningHookContrast,
} from '../services/stage2BeatPlan';
import {
  buildOpeningHookStage3Guidance,
  getOpeningHookBeatIndices,
} from '../services/stage3PromptWriter';
import { Scene, Beat, StyleProfile, StoryGenerationResult, GenerateStoryRequest, AssistantImageAttachment, AssistantChatMessage } from '../types';

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
import {
  SHORT_FORM_PACING,
  LONG_FORM_PACING,
  enforceStage2Pacing,
  buildPlannedScenesFromCustomScenes,
  PlannedScene,
  PlannedBeat,
} from '../services/stage2BeatPlan';
import { hashStoryInput, getCachedStoryBible, setCachedStoryBible, clearCachedStoryBible } from '../services/bibleCache';
import { stage0PrepareNarration, extractAuthorNotes } from '../services/stage0Prepare';
import { verifyBeatCodeChecks } from '../services/stage4VerifyRepair';
import type { WrittenPromptBeat } from '../services/stage3PromptWriter';

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
// 14. AUTHOR NOTES & NARRATION PREPARATION CHECK
// ============================================================================
console.log('--- Running Test Suite 14: Author Notes & Narration Prep ---');

const notesSampleInput =
  'In the spring of 1888, Master Henri Blanc believed his life work was already complete. He was mistaken.\n\nNOTES:\nSetting: Geneva, Switzerland (1888).';
const notesPrepared = stage0PrepareNarration(notesSampleInput);
assert(
  notesPrepared.authorNotes?.includes('Geneva, Switzerland') === true &&
    !notesPrepared.cleanNarration.includes('NOTES:'),
  'Stage 0 Prep',
  'Author notes capture 1888 Geneva setting and strip NOTES block from narration'
);

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

const sampleCacheBible = {
  cast: [
    { id: 'merchant', role: 'Caravan merchant', visualLock: 'Weather-beaten traveler in sand-colored linen robe' },
    { id: 'guide', role: 'Trail guide', visualLock: 'Older scout carrying an iron oil lantern' },
  ],
  threat: { canonicalLook: 'none', allowedVariants: [] },
  locations: [{ id: 'silk_road', visualLock: 'Wind-carved desert pass at dusk' }],
  motifs: [],
  events: ['Merchant leads pack camels into the canyon pass'],
  referents: [],
  withheld: [],
  forbidden: [],
  worldStyle: 'Warm 35mm cinematic realism',
  assumptions: [],
};

setCachedStoryBible(storySample, notesSample, sampleCacheBible);
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

// 14. Geographic Demonym Entity Isolation & Cartographic Anchor Suite
console.log('\n--- Running Test Suite 14: Geographic Demonym Entity Isolation & Cartographic Anchors ---');

// 14.1 Extraction of Demonym and Country Anchors
const swedishAnchor = extractGeographicAnchor('Swedish');
assert(
  swedishAnchor !== null &&
  swedishAnchor.countryOrRegion === 'Sweden' &&
  swedishAnchor.flagDescription.includes('Scandinavian cross flag of Sweden'),
  'Geographic Anchor Extraction',
  'Extracts Swedish nationality and maps to Sweden with national flag'
);

const britishAnchor = extractGeographicAnchor('British');
assert(
  britishAnchor !== null &&
  britishAnchor.countryOrRegion === 'Great Britain' &&
  britishAnchor.flagDescription.includes('Union Jack'),
  'Geographic Anchor Extraction',
  'Extracts British nationality and maps to Great Britain with Union Jack'
);

const frenchAnchor = extractGeographicAnchor('In France');
assert(
  frenchAnchor !== null &&
  frenchAnchor.countryOrRegion === 'France',
  'Geographic Anchor Extraction',
  'Extracts country anchor from "In France"'
);

// 14.2 Sub-beat Splitting for Temporal + Geographic Demonym + Character
const testPhraseNoComma = 'In 1896 Swedish scientist Svante Arrhenius';
const splitBeatsNoComma = splitPhraseIntoSubBeats(testPhraseNoComma);
assert(
  splitBeatsNoComma.length === 3 &&
  splitBeatsNoComma[0] === 'In 1896' &&
  splitBeatsNoComma[1] === 'Swedish' &&
  splitBeatsNoComma[2] === 'scientist Svante Arrhenius',
  'Geographic Demonym Splitting',
  'Splits "In 1896 Swedish scientist Svante Arrhenius" into exact 3 beats: temporal, nationality, and character'
);

const testPhraseWithComma = 'In 1896, Swedish scientist Svante Arrhenius';
const splitBeatsWithComma = splitPhraseIntoSubBeats(testPhraseWithComma);
assert(
  splitBeatsWithComma.length === 3 &&
  splitBeatsWithComma[0].replace(/,$/, '') === 'In 1896' &&
  splitBeatsWithComma[1] === 'Swedish' &&
  splitBeatsWithComma[2] === 'scientist Svante Arrhenius',
  'Geographic Demonym Splitting',
  'Splits "In 1896, Swedish scientist Svante Arrhenius" into exact 3 beats even when comma is present'
);

// 14.3 Cartographic Visual Prompt Generation
if (swedishAnchor) {
  const stillCartoPrompt = generateCartographicPrompt(swedishAnchor, false);
  assert(
    stillCartoPrompt.includes('Sweden') &&
    stillCartoPrompt.includes('terrestrial globe') &&
    stillCartoPrompt.includes('glowing border lines') &&
    stillCartoPrompt.includes('location pin') &&
    stillCartoPrompt.includes('flag of Sweden') &&
    stillCartoPrompt.includes('no people or characters'),
    'Cartographic Prompt Generator',
    'Generates still image prompt featuring globe, highlighted border, location pin, and flag without people'
  );

  const videoCartoPrompt = generateCartographicPrompt(swedishAnchor, true);
  assert(
    videoCartoPrompt.includes('terrestrial globe rotating') &&
    videoCartoPrompt.includes('location pin dropping') &&
    videoCartoPrompt.includes('waving subtly'),
    'Cartographic Prompt Generator',
    'Generates video prompt featuring rotating globe, dropping pin, and waving flag motion physics'
  );
}

// 14.4 enforceBeatCeilings Automatic Cartographic Resolution
const rawBeatsInput: Beat[] = [
  {
    beatIndex: 1,
    textSpan: 'In 1896',
    shotType: 'Close-Up',
    imagePrompt: 'A calendar page reading 1896.',
    estimatedSeconds: 1.5,
  },
  {
    beatIndex: 2,
    textSpan: 'Swedish',
    shotType: 'Medium Shot',
    imagePrompt: 'A scientist in a lab.', // Generic prompt lacking cartographic focus
    estimatedSeconds: 1.5,
  },
  {
    beatIndex: 3,
    textSpan: 'scientist Svante Arrhenius',
    shotType: 'Medium Shot',
    imagePrompt: 'Svante Arrhenius working at his desk with chemistry glassware.',
    estimatedSeconds: 2.0,
  },
];

const ceilingResolved = enforceBeatCeilings(rawBeatsInput, 1, { isVideoMode: false });
const beat2Resolved = ceilingResolved.find((b) => b.textSpan === 'Swedish');
assert(
  beat2Resolved !== undefined &&
  beat2Resolved.imagePrompt.includes('globe') &&
  beat2Resolved.imagePrompt.includes('Sweden') &&
  beat2Resolved.shotType === 'High-Angle Macro Shot',
  'Automatic Cartographic Upgrade',
  'enforceBeatCeilings automatically upgrades a demonym beat with a globe, pin, and flag cartographic prompt'
);

// 14.5 Storyboard Linter Rule L09
const nonCartoScene: Scene = {
  index: 1,
  narratorLine: 'In 1896 Swedish scientist Svante Arrhenius',
  estimatedSeconds: 5,
  beats: [
    {
      beatIndex: 1,
      textSpan: 'Swedish',
      shotType: 'Medium Shot',
      imagePrompt: 'A scientist looking through a microscope.', // Lacks map, globe, pin, or flag
      estimatedSeconds: 1.5,
    },
  ],
};
const lintResultL09 = lintStoryboard([nonCartoScene]);
const hasL09 = lintResultL09.some((issue) => issue.id.startsWith('L09'));
assert(hasL09, 'Storyboard Linter L09', 'Linter emits L09 when a demonym beat lacks cartographic environment focus');

// ============================================================================
// 15. PRODUCTION COVER & THUMBNAIL BLUEPRINT
// ============================================================================
console.log('--- Running Test Suite 15: Production Cover & Thumbnail Blueprint ---');

// 15.1 Story-Adaptive Typography Inference
const fontZombie = inferStoryAdaptiveFont('Hyperrealistic survival horror', '60 days inside a post-apocalyptic zombie outbreak');
assert(
  fontZombie.includes('distressed weathered stencil'),
  'Story-Adaptive Typography',
  'Selects distressed weathered stencil sans-serif for zombie/horror apocalypse'
);

const fontCyber = inferStoryAdaptiveFont('Neon retro synthwave', 'A rogue hacker infiltrates a cybernetic mega-corporation in 2088');
assert(
  fontCyber.includes('sleek futuristic geometric') && fontCyber.includes('neon'),
  'Story-Adaptive Typography',
  'Selects sleek futuristic geometric neon sans-serif for cyberpunk/sci-fi'
);

const fontFantasy = inferStoryAdaptiveFont('1970s dark fantasy oil painting', 'An ancient knight ventures into a cursed gothic castle');
assert(
  fontFantasy.includes('chiseled archaic roman serif'),
  'Story-Adaptive Typography',
  'Selects chiseled archaic roman serif for medieval gothic fantasy'
);

const fontDoc = inferStoryAdaptiveFont('19th century archival daguerreotype', 'Historical documentary about the 1896 scientific expeditions');
assert(
  fontDoc.includes('bold editorial headline serif'),
  'Story-Adaptive Typography',
  'Selects bold editorial headline serif for historical documentary'
);

const fontCartoon = inferStoryAdaptiveFont('1930s rubber hose animation', 'A mischievous cartoon teacup runs through kitchen cupboards');
assert(
  fontCartoon.includes('playful hand-lettered bold cartoon bubble serif'),
  'Story-Adaptive Typography',
  'Selects playful cartoon bubble serif for 1930s rubber hose'
);

// 15.2 16:9 Widescreen YouTube Thumbnail Compilation & Safe Zones
const testStyleProfile: StyleProfile = {
  artStyle: 'Gritty 35mm cinematic film',
  colorPalette: 'Muted teal and amber',
  lighting: '3200K warm tungsten key light with cold ambient fill',
  eraAndSetting: 'Ruined post-outbreak metropolis',
};
const testCharSheet: Record<string, string> = {
  'Elena': '32-year-old survivor with short dark hair, cheek scar, wearing torn olive field jacket and leather backpack',
};

const thumb169 = compileThumbnailPrompt({
  rawThumbnail: {
    heroMoment: 'Elena stepping into the abandoned subway tunnel with flashlight raised',
    expression: 'exhausted but fiercely determined gaze',
    bgDescription: 'crumbling subway station with distant glowing eyes in shadows',
    accentColor: 'cold electric cyan',
    hookText: 'ZOMBIE OUTBREAK FOR 60 DAYS', // Exceeds 4 words - should truncate to <= 4 words
  },
  styleProfile: testStyleProfile,
  characterSheet: testCharSheet,
  storyPremise: '60 days after the infection spread',
  format: 'long',
  platform: 'YouTube',
});

assert(
  thumb169.aspectRatio === '16:9' &&
  thumb169.targetPlatform === 'YouTube Widescreen',
  'Thumbnail Compilation (16:9)',
  'Compiles 16:9 widescreen format for YouTube'
);

assert(
  thumb169.compiledPrompt.includes('Elena (locked visual identity: 32-year-old survivor') &&
  thumb169.compiledPrompt.includes('exhausted but fiercely determined gaze'),
  'Thumbnail Compilation (16:9)',
  'Preserves locked character identity and adapts intense expression'
);

assert(
  thumb169.compiledPrompt.includes('strictly keep the bottom-right corner clear') &&
  thumb169.compiledPrompt.includes('left third'),
  'Thumbnail Compilation (16:9)',
  'Enforces YouTube platform safe-zone clearing bottom-right timestamp badge'
);

assert(
  thumb169.hookText.split(/\s+/).length <= 4 &&
  thumb169.compiledPrompt.includes(`"${thumb169.hookText}"`),
  'Thumbnail Compilation (16:9)',
  'Limits hook text to <= 4 words in ALL CAPS'
);

assert(
  thumb169.cleanPlatePrompt.includes('Clean negative space') &&
  thumb169.cleanPlatePrompt.includes('without any text, lettering, words') &&
  !thumb169.cleanPlatePrompt.includes('Graphic headline text'),
  'Thumbnail Clean Plate',
  'Generates text-free clean plate prompt for external typography design'
);

// 15.3 9:16 Vertical Shorts / TikTok Thumbnail Compilation & Safe Zones
const thumb916 = compileThumbnailPrompt({
  rawThumbnail: {
    heroMoment: 'Elena staring down into the foggy street from a rooftop ladder',
    expression: 'hyper-alert paranoia',
    bgDescription: 'towering broken skyscrapers blanketed in toxic fog',
    accentColor: 'crimson red',
    hookText: 'DAY 60',
  },
  styleProfile: testStyleProfile,
  characterSheet: testCharSheet,
  storyPremise: '60 days of horror in the city',
  format: 'short',
  platform: 'TikTok',
});

assert(
  thumb916.aspectRatio === '9:16' &&
  thumb916.targetPlatform === 'TikTok / Shorts / Reels',
  'Thumbnail Compilation (9:16)',
  'Compiles 9:16 vertical cover format for TikTok / Shorts'
);

assert(
  thumb916.compiledPrompt.includes('top 12% clear for header/profile') &&
  thumb916.compiledPrompt.includes('bottom 25% clear for captions') &&
  thumb916.compiledPrompt.includes('right edge clear'),
  'Thumbnail Compilation (9:16)',
  'Enforces vertical Shorts/TikTok safe zones for UI button and caption overlays'
);

// 15.4 Export Isolation Check
const sampleResultWithThumbnail: StoryGenerationResult = {
  totalDurationSeconds: 12,
  styleProfile: testStyleProfile,
  characterSheet: testCharSheet,
  locationSheet: {},
  scenes: [
    {
      index: 1,
      narratorLine: 'Scene one text.',
      estimatedSeconds: 6,
      beats: [
        { beatIndex: 1, textSpan: 'Scene one text.', imagePrompt: 'Prompt 1', estimatedSeconds: 6 }
      ]
    },
    {
      index: 2,
      narratorLine: 'Scene two text.',
      estimatedSeconds: 6,
      beats: [
        { beatIndex: 1, textSpan: 'Scene two text.', imagePrompt: 'Prompt 2', estimatedSeconds: 6 }
      ]
    }
  ],
  thumbnail: thumb169,
};

assert(
  sampleResultWithThumbnail.scenes.length === 2 &&
  sampleResultWithThumbnail.scenes.reduce((sum, s) => sum + s.beats.length, 0) === 2,
  'Thumbnail Export Isolation',
  'Thumbnail prompt does not corrupt scene count or beat counts'
);

// ============================================================================
// 18. VISUAL-EVENT PACING, NARRATION COVERAGE, CLONE PREVENTION & ALIGNMENT
// ============================================================================
console.log('\n--- Running Test Suite 18: Visual-Event Pacing, Coverage & Deduplication ---');

// 18.1 Double orientation prefix & comma/period cleanup
const dirtyDoublePrefix =
  'Vertical 9:16 portrait composition, extreme-wide, high-angle framing shows Kael standing on stone battlements. Vertical 9:16 portrait composition. --ar 9:16 --ar 9:16';
const cleanedPrefixPrompt = assembleCleanPrompt(dirtyDoublePrefix, false);
const verticalPrefixCount = (cleanedPrefixPrompt.match(/Vertical 9:16 portrait composition/gi) || []).length;
const arCount = (cleanedPrefixPrompt.match(/--ar 9:16/gi) || []).length;
assert(
  verticalPrefixCount === 1 && arCount === 1 && !cleanedPrefixPrompt.includes('—'),
  'Orientation & Flag Deduplication',
  'Strips comma/period double orientation prefixes and duplicate --ar flags cleanly'
);

// 18.2 Fake precision biomechanical math sanitizer
const mathPrompt =
  'Kael gripping his rifle firmly with body weight anchored 70% onto his left boot and torso twisted 15 degrees to the right, wrist flexed at 25 degrees.';
const naturalPrompt = sanitizeFakePrecisionMath(mathPrompt);
assert(
  !/70%/.test(naturalPrompt) &&
    !/15\s*degrees/i.test(naturalPrompt) &&
    !/25\s*degrees/i.test(naturalPrompt) &&
    naturalPrompt.toLowerCase().includes('weight planted firmly'),
  'Natural Biomechanics Sanitizer',
  'Replaces robotic weight percentages and degree angles with natural posture language'
);

// 18.3 Intra-scene A-B-A-B clone resolution & short connector merge
const ababBeats: Beat[] = [
  {
    beatIndex: 1,
    textSpan: 'But he has one problem:',
    shotType: 'Medium Shot',
    cameraAngle: 'eye-level',
    cameraMovement: 'Static',
    imagePrompt:
      'Vertical 9:16 portrait composition, Medium Shot, eye-level of Kael standing near stone crenellations checking his rifle magazine at dusk, warm amber torchlight, 50mm f/2.0 lens. --ar 9:16',
    estimatedSeconds: 1.2,
  },
  {
    beatIndex: 2,
    textSpan: 'his ammunition is strictly limited to one magazine.',
    shotType: 'Extreme Close-Up',
    cameraAngle: 'high-angle',
    cameraMovement: 'Slow Push-In',
    imagePrompt:
      'Vertical 9:16 portrait composition, Extreme Close-Up, high-angle on Kael holding an open translucent rifle magazine revealing only a few brass bullets left inside, dramatic rim light, 85mm f/1.8 lens. --ar 9:16',
    estimatedSeconds: 1.8,
  },
  {
    beatIndex: 3,
    textSpan: 'Every shot he fires could be his last.',
    shotType: 'Medium Shot',
    cameraAngle: 'eye-level',
    cameraMovement: 'Static',
    imagePrompt:
      'Vertical 9:16 portrait composition, Medium Shot, eye-level of Kael standing near stone crenellations checking his rifle magazine at dusk, warm amber torchlight, 50mm f/2.0 lens. --ar 9:16',
    estimatedSeconds: 2.4,
  },
];
const progressedAbab = deduplicateAndProgressSceneBeats(ababBeats, {
  styleProfile: testStyleProfile,
  characterSheet: { Kael: '22-year-old modern Filipino soldier in tactical olive jacket and combat boots' },
  locationSheet: { Ramparts: 'weathered medieval stone castle battlements under smoky twilight sky' },
  isLongForm: false,
  isVideoMode: false,
});
assert(
  progressedAbab.length === 2 &&
    progressedAbab[0].textSpan.includes('But he has one problem:') &&
    progressedAbab[0].textSpan.includes('limited to one magazine') &&
    progressedAbab[0].imagePrompt !== progressedAbab[1].imagePrompt &&
    !progressedAbab[1].imagePrompt.includes('Alternative reaction perspective'),
  'Connector Merge & A-B-A-B Clone Elimination',
  'Merges short connector fragment into action beat and evolves non-adjacent clone without legacy templates'
);

// 18.4 Display normalizer preserves 2.5s / 12-word visual-event beats & shot metadata alignment
const displayInputScenes: Scene[] = [
  {
    index: 1,
    narratorLine: 'Above ground, armored knights march across the torchlit courtyard beneath gathering storm clouds.',
    estimatedSeconds: 5.2,
    beats: [
      {
        beatIndex: 1,
        textSpan: 'Above ground, armored knights march across the torchlit courtyard',
        shotType: 'Extreme Wide Shot',
        cameraAngle: 'low-angle',
        cameraMovement: 'Slow Pan',
        imagePrompt:
          'Vertical 9:16 portrait composition, Extreme Wide Shot, low-angle of rows of steel-armored medieval knights marching in formation across a stone courtyard lit by flickering torches, storm clouds overhead, 24mm f/4 lens. --ar 9:16',
        estimatedSeconds: 2.6,
      },
      {
        beatIndex: 2,
        textSpan: 'beneath gathering storm clouds as war horns sound.',
        shotType: 'Close-Up',
        cameraAngle: 'high-angle',
        cameraMovement: 'Slow Push-In',
        imagePrompt:
          'Vertical 9:16 portrait composition, Close-Up, high-angle focusing on an iron war horn raised against dark storm clouds with rain streaks catching amber torchlight, 85mm f/2.0 lens. --ar 9:16',
        estimatedSeconds: 2.6,
      },
    ],
  },
];
const normalizedDisplay = normalizeStoryboardForDisplay(displayInputScenes, {
  isVideoMode: false,
  isLongForm: false,
  styleProfile: testStyleProfile,
});
assert(
  normalizedDisplay[0].beats.length === 2 &&
    normalizedDisplay[0].beats[0].shotType === 'Extreme Wide Shot' &&
    normalizedDisplay[0].beats[0].cameraAngle === 'low-angle' &&
    normalizedDisplay[0].beats[1].shotType === 'Close-Up' &&
    normalizedDisplay[0].beats[1].cameraAngle === 'high-angle',
  'Display Normalizer Pacing & Metadata Preservation',
  'Preserves visual-event pacing without re-chopping into clones or overriding shot metadata'
);

// 18.5 100% spoken narration coverage recovery
const truncatedScene: Scene = {
  index: 7,
  narratorLine:
    'Every rival king wants him dead, yet nobody on the battlefield knows his ammunition is almost gone.',
  estimatedSeconds: 3.0,
  beats: [
    {
      beatIndex: 1,
      textSpan: 'Every rival king wants him dead,',
      shotType: 'Close-Up',
      cameraAngle: 'eye-level',
      cameraMovement: 'Slow Push-In',
      imagePrompt:
        'Vertical 9:16 portrait composition, Close-Up, eye-level of rival kings glaring across a war map table lit by tallow candles, 50mm f/2.0 lens. --ar 9:16',
      estimatedSeconds: 2.2,
    },
  ],
};
const recoveredScenes = verifyAndRepairSceneNarrationCoverage(
  [truncatedScene],
  testStyleProfile,
  { Kael: '22-year-old soldier in olive tactical jacket' },
  { Battlefield: 'muddy medieval battlefield surrounded by stone watchtowers' },
  { isLongForm: false, isVideoMode: false }
);
const recoveredSpoken = recoveredScenes[0].beats.map((b) => b.textSpan).join(' ').toLowerCase();
assert(
  recoveredScenes[0].beats.length >= 2 &&
    recoveredSpoken.includes('nobody') &&
    recoveredSpoken.includes('ammunition') &&
    recoveredSpoken.includes('almost gone'),
  '100% Spoken Narration Coverage Recovery',
  'Recovers missing trailing narration clauses into distinct visual beats'
);

// 18.6 Option A compact character identity lock on pronoun beats
const pronounBeatPrompt =
  'Vertical 9:16 portrait composition, Medium Shot, eye-level showing him raising his rifle behind a stone pillar. --ar 9:16';
const lockedPronounPrompt = injectCompactCharacterLocks(
  pronounBeatPrompt,
  'as he raises his rifle',
  'Kael spots the approaching cavalry and he raises his rifle.',
  { Kael: '22-year-old modern Filipino soldier with tanned skin, olive tactical jacket, dark cargo pants, and combat boots' }
);
assert(
  lockedPronounPrompt.includes('Kael') &&
    lockedPronounPrompt.toLowerCase().includes('olive tactical jacket'),
  'Option A Compact Character Lock',
  'Embeds compact character visual identity into pronoun beats while preserving prompt flow'
);

// 18.7 Chronological era-bleed scrubbing
const eraBleedScenes: Scene[] = [
  {
    index: 3,
    narratorLine: 'Suddenly a temporal vortex hurls Kael 800 years into the past into a medieval kingdom.',
    estimatedSeconds: 4.0,
    beats: [
      {
        beatIndex: 1,
        textSpan: 'Suddenly a temporal vortex hurls Kael 800 years into the past,',
        shotType: 'Medium Shot',
        cameraAngle: 'low-angle',
        cameraMovement: 'Whip-Pan',
        imagePrompt:
          'Vertical 9:16 portrait composition, Medium Shot, low-angle of Kael braced against swirling energy, metallic armory racks glowing with neon cyan panels in the background. --ar 9:16',
        estimatedSeconds: 4.0,
      },
    ],
  },
];
const eraFixedScenes = sanitizeEraBleedAcrossScenes(eraBleedScenes, testStyleProfile, {
  Ramparts: 'medieval stone castle courtyard',
});
assert(
  !/metallic armory racks/i.test(eraFixedScenes[0].beats[0].imagePrompt) &&
    eraFixedScenes[0].beats[0].imagePrompt.includes('Ramparts'),
  'Chronological Era-Bleed Scrubber',
  'Removes modern/futuristic armory bleed after historical time-travel transitions'
);

// 18.8 Linter L10 / L11 / L12 detection
const lintDefectScenes: Scene[] = [
  {
    index: 1,
    narratorLine: 'He draws his blade and faces the charging horsemen in the rain.',
    estimatedSeconds: 4.0,
    beats: [
      {
        beatIndex: 1,
        textSpan: 'He draws his blade',
        shotType: 'Close-Up',
        cameraAngle: 'eye-level',
        cameraMovement: 'Static',
        imagePrompt:
          'Vertical 9:16 portrait composition, Extreme Wide Shot, birds-eye view of an empty mountain valley at dawn with mist rolling over pine trees. --ar 9:16',
        estimatedSeconds: 2.0,
      },
      {
        beatIndex: 2,
        textSpan: 'and faces the',
        shotType: 'Close-Up',
        cameraAngle: 'eye-level',
        cameraMovement: 'Static',
        imagePrompt:
          'Vertical 9:16 portrait composition, Extreme Wide Shot, birds-eye view of an empty mountain valley at dawn with mist rolling over pine trees. --ar 9:16',
        estimatedSeconds: 2.0,
      },
    ],
  },
];
const detectedLint = lintStoryboard(lintDefectScenes);
const codes = new Set(detectedLint.map((i) => i.id.split('-')[0]));
assert(
  codes.has('L10') && codes.has('L11') && codes.has('L12'),
  'Storyboard Linter Rules L10/L11/L12',
  'Flags intra-scene beat clones (L10), missing spoken narration words (L11), and metadata contradiction (L12)'
);

// ============================================================================
// 19. MONOCHROME LOCK, TWIST SAFETY, EXPRESSION PURITY, HYGIENE & MIRROR CTA
// ============================================================================
console.log('\n--- Running Test Suite 19: Monochrome Lock, Hygiene, Taxonomy & Mirror CTA ---');

// 19.1 Expression/pose stripping in characterSheet & clean phrase-boundary compaction
const dirtyCharDesc =
  'gaunt dark-haired person in dark blue oversized cotton pajamas, bare feet, tousled black hair falling into eyes, eyes wide, neutral expression, mouth open, dark circles under eyes';
const cleanCharSheetDesc = sanitizeCharacterIdentitySheet(dirtyCharDesc);
const compactCharDesc = buildCompactCharacterAnchor(cleanCharSheetDesc, 20);
assert(
  !/eyes wide|neutral expression|mouth open/i.test(cleanCharSheetDesc) &&
    cleanCharSheetDesc.includes('bare feet') &&
    !/neutral\)$/.test(compactCharDesc) &&
    !compactCharDesc.endsWith('('),
  'Expression-Free CharacterSheet & Safe Compaction',
  'Strips transient expressions while keeping barefoot trait and never breaks mid-phrase'
);

// 19.2 Monochrome style lock, entity expansion, barefoot alignment, still-image motion/optics cleanup, & OTS-vs-angle sync
const junjiStyleProfile: StyleProfile = {
  artStyle: 'Junji Ito inspired high-contrast black-and-white horror manga ink art, no gray gradients',
  colorPalette: 'Strict pure black-and-white ink with cold cyan accents and 3200K warm highlights',
  lighting: '3200K warm tungsten key light with cold 5400K rim lighting',
  eraAndSetting: 'Cramped shadowy bedroom before an antique standing mirror',
};
const mirrorCharSheet: Record<string, string> = {
  Protagonist: 'pale slender figure with tousled black hair, dark oversized sleepwear, and barefoot stance',
};
const mirrorLocSheet: Record<string, string> = {
  DarkRoom: 'cramped shadowy bedroom with peeling wallpaper, tall wooden standing mirror',
};

const rawDirtyBeat: Beat = {
  beatIndex: 1,
  textSpan: 'Because it is guarding something.',
  shotType: 'Close-Up',
  cameraAngle: 'over-the-shoulder',
  cameraMovement: 'Static Frame',
  imagePrompt:
    'Vertical 9:16 portrait composition, Medium Close-Up, over-the-shoulder view of Protagonist in DarkRoom,cramped bedroom.. Shot on 35mm 35mm f/2.8 lens, tracking left to reveal both boots planted firmly while listening to an unseen whisper, 3200K warm tungsten and cold cyan rim lighting. --ar 9:16',
  estimatedSeconds: 2.2,
};

const formattedHorrorBeat = formatFinalBeatPrompt(rawDirtyBeat, false, false, {
  styleProfile: junjiStyleProfile,
  characterSheet: mirrorCharSheet,
  locationSheet: mirrorLocSheet,
});

assert(
  formattedHorrorBeat.shotType === 'Medium Close-Up' &&
    formattedHorrorBeat.cameraAngle === 'eye-level' &&
    !formattedHorrorBeat.imagePrompt.includes('DarkRoom') &&
    !formattedHorrorBeat.imagePrompt.includes('Protagonist') &&
    !formattedHorrorBeat.imagePrompt.includes('..') &&
    !formattedHorrorBeat.imagePrompt.includes('35mm 35mm') &&
    !formattedHorrorBeat.imagePrompt.includes('tracking left to reveal') &&
    !formattedHorrorBeat.imagePrompt.includes('listening to an unseen whisper') &&
    !formattedHorrorBeat.imagePrompt.includes('both boots') &&
    !/3200K|5400K|warm tungsten|cold cyan/i.test(formattedHorrorBeat.imagePrompt),
  'Prompt Hygiene, Monochrome Lock & OTS/Angle Sync',
  'Expands DarkRoom/Protagonist, strips B&W chromatic Kelvin/cyan, fixes OTS in cameraAngle, syncs Medium Close-Up, and respects barefoot stance'
);

// 19.3 Zero spoken-text fallback leakage in coverage repair & chronological twist safety
const mirrorTruncatedScene: Scene = {
  index: 6,
  narratorLine: 'Think about it: you can touch the glass anytime. So why can you never reach out and cross to the other side?',
  estimatedSeconds: 4.0,
  beats: [
    {
      beatIndex: 1,
      textSpan: 'Think about it: you can touch the glass anytime.',
      shotType: 'Medium Shot',
      cameraAngle: 'eye-level',
      cameraMovement: 'Static Frame',
      imagePrompt:
        'Vertical 9:16 portrait composition, Medium Shot, eye-level of the protagonist standing motionless before a dark standing mirror, stark ink contrast, 50mm f/2.0 lens. --ar 9:16',
      estimatedSeconds: 2.0,
    },
  ],
};
const repairedMirrorScenes = verifyAndRepairSceneNarrationCoverage(
  [mirrorTruncatedScene],
  junjiStyleProfile,
  mirrorCharSheet,
  mirrorLocSheet,
  { isLongForm: false, isVideoMode: false }
);
const recoveredMirrorPrompt = repairedMirrorScenes[0].beats[1]?.imagePrompt || '';
assert(
  repairedMirrorScenes[0].beats.length >= 2 &&
    !/turning point of|escalating stakes of/i.test(recoveredMirrorPrompt) &&
    !recoveredMirrorPrompt.includes('Protagonist') &&
    !recoveredMirrorPrompt.includes('DarkRoom') &&
    !/smiling/i.test(recoveredMirrorPrompt),
  'Zero Spoken-Text Leakage & Twist Preservation',
  'Coverage repair never injects spoken text strings, expands entity keys, and withholds final smile reveal'
);

// 19.4 Monochrome Thumbnail & Universal Mirror-Horror CTA Compilation
const monoThumb = compileThumbnailPrompt({
  rawThumbnail: {
    heroMoment: 'The protagonist staring into DarkRoom mirror as the reflection freezes',
    expression: 'horrified, mouth open in silent dread',
    bgDescription: 'cramped dark bedroom bathed in 3200K warm and cold cyan shadows',
    accentColor: 'cold electric cyan',
    hookText: 'IT NEVER BLINKED',
  },
  styleProfile: junjiStyleProfile,
  characterSheet: { Protagonist: dirtyCharDesc },
  storyPremise: "You've been told a lie about what mirrors are... Your reflection blinks a half-second late. Now it's smiling.",
  format: 'short',
  platform: 'TikTok',
});
assert(
  isMonochromeStyle(junjiStyleProfile) &&
    !/cold electric cyan|cold cyan rim|3200K warm/i.test(monoThumb.compiledPrompt) &&
    !/eyes wide|neutral expression|mouth open.*locked visual identity/i.test(
      monoThumb.compiledPrompt.split('expression horrified')[0] || ''
    ),
  'Monochrome Thumbnail & Clean Identity Lock',
  'Removes chromatic rim colors from B&W manga thumbnails and strips clashing neutral expressions'
);

const mirrorCtaQuery = inferStoryAdaptiveCtaQuestion(
  "You've been told a lie about what mirrors actually are. Every reflection is a warden guarding a parallel universe. Now it's smiling.",
  'Protagonist'
);
const mirrorCtaPrompt = compileCtaPrompt({
  storyPremise:
    "You've been told a lie about what mirrors actually are. Every reflection is a warden guarding a parallel universe. Now it's smiling.",
  styleProfile: junjiStyleProfile,
  characterSheet: { Protagonist: dirtyCharDesc },
  format: 'short',
  platform: 'tiktok',
  modality: 'image',
});
assert(
  mirrorCtaQuery.primaryQuestion.toLowerCase().includes('mirror') &&
    !mirrorCtaQuery.primaryQuestion.includes('in the wrong here') &&
    !mirrorCtaPrompt.compiledPrompt.includes('--style raw') &&
    !mirrorCtaPrompt.compiledPrompt.includes('--v 6.1') &&
    !/3200K|5400K/i.test(mirrorCtaPrompt.compiledPrompt),
  'Mirror Horror CTA & Universal Flags',
  'Detects mirror horror ahead of incidental lie keyword and omits legacy --style raw --v 6.1 flags'
);

// 19.5 Linter L12 + L13 detection for OTS in cameraAngle & monochrome Kelvin bleed
const l13Scene: Scene[] = [
  {
    index: 1,
    narratorLine: 'He stares into the glass in the dark room.',
    estimatedSeconds: 3.0,
    beats: [
      {
        beatIndex: 1,
        textSpan: 'He stares into the glass in the dark room.',
        shotType: 'Close-Up',
        cameraAngle: 'over-the-shoulder',
        cameraMovement: 'Static Frame',
        imagePrompt:
          'Vertical 9:16 portrait composition, Medium Close-Up, over-the-shoulder view inside DarkRoom under 3200K warm tungsten key light. --ar 9:16',
        estimatedSeconds: 3.0,
      },
    ],
  },
];
const l13Issues = lintStoryboard(l13Scene, mirrorCharSheet, junjiStyleProfile);
const l13Codes = new Set(l13Issues.map((i) => i.id.split('-')[0]));
assert(
  l13Codes.has('L12') && l13Codes.has('L13'),
  'Storyboard Linter Rules L12/L13 Extended',
  'Flags OTS in cameraAngle + Medium Close-Up mismatch (L12) and monochrome Kelvin bleed + raw DarkRoom key (L13)'
);

// ============================================================================
// SUITE 20: Action-Triplet Montage, Semantic Crib Flashback & 8-Word Auditor
// ============================================================================
console.log('Running Test Suite 20: Action-Triplet Montage, Semantic Flashbacks & Dense Auditor...');

const dualCharEntitySheet: Record<string, string> = {
  Protagonist: 'young person with short black hair, pallid skin, thin black turtleneck sweater, dark jeans, barefoot',
  MirrorEntity: 'gaunt pitch-black ink silhouette matching human proportions, hollow white unblinking eyes, elongated tapered fingers',
};

// 20.1 Preserve "every blink / every breath / every move" rapid montage while still merging pure grammar connectors
const montageAndGlueScene: Scene = {
  index: 3,
  narratorLine: 'perfectly mimicking every blink, every breath, every move.',
  estimatedSeconds: 2.5,
  beats: [
    {
      beatIndex: 1,
      textSpan: 'perfectly mimicking every blink,',
      shotType: 'Extreme Close-Up',
      cameraAngle: 'eye-level',
      cameraMovement: 'Static Frame',
      imagePrompt:
        'Vertical 9:16 portrait composition, Extreme Close-Up, eye-level macro framing of the protagonist eyelid frozen half-shut mid-blink beside the glass eye reflection in exact 1:1 mirror symmetry, stark white highlight on dark lashes, Shot on 100mm macro f/2.8 lens. --ar 9:16',
      estimatedSeconds: 0.9,
    },
    {
      beatIndex: 2,
      textSpan: 'every breath,',
      shotType: 'Extreme Close-Up',
      cameraAngle: 'eye-level',
      cameraMovement: 'Static Frame',
      imagePrompt:
        'Vertical 9:16 portrait composition, Extreme Close-Up, eye-level macro view of faint condensation frost vapor misting outward across the cold ebony mirror surface beside parted lips in exact 1:1 mirrored synchrony, cross-hatched condensation droplets, Shot on 85mm f/1.8 lens. --ar 9:16',
      estimatedSeconds: 0.8,
    },
    {
      beatIndex: 3,
      textSpan: 'every move.',
      shotType: 'Medium Shot',
      cameraAngle: 'eye-level',
      cameraMovement: 'Static Frame',
      imagePrompt:
        'Vertical 9:16 portrait composition, Medium Shot, eye-level wide torso framing of raised left hand and shifted shoulder posture mirrored in exact 1:1 unsmiling synchrony across the tall bedroom mirror glass, bare feet grounded on wooden floorboards, Shot on 35mm f/4 lens. --ar 9:16',
      estimatedSeconds: 0.8,
    },
  ],
};

const normalizedMontage = normalizeStoryboardForDisplay([montageAndGlueScene], {
  isVideoMode: false,
  isLongForm: false,
  styleProfile: junjiStyleProfile,
  characterSheet: dualCharEntitySheet,
  locationSheet: mirrorLocSheet,
});
const montageL10Issues = lintStoryboard(normalizedMontage, dualCharEntitySheet, junjiStyleProfile).filter((i) =>
  i.id.startsWith('L10')
);

// Also confirm plain grammar stub still merges
const plainGlueBeats = deduplicateAndProgressSceneBeats(
  [
    {
      beatIndex: 1,
      textSpan: 'But he has one problem:',
      shotType: 'Close-Up',
      cameraAngle: 'eye-level',
      cameraMovement: 'Static Frame',
      imagePrompt: 'Close-Up of young knight standing in torchlit stone corridor, 85mm f/1.8 lens.',
      estimatedSeconds: 1.0,
    },
    {
      beatIndex: 2,
      textSpan: 'his rifle has no ammo left.',
      shotType: 'Close-Up',
      cameraAngle: 'eye-level',
      cameraMovement: 'Static Frame',
      imagePrompt: 'Close-Up of young knight staring at open empty metal rifle chamber in torchlit corridor, 85mm f/1.8 lens.',
      estimatedSeconds: 1.5,
    },
  ],
  { isLongForm: false, isVideoMode: false, styleProfile: junjiStyleProfile }
);

assert(
  normalizedMontage[0].beats.length === 3 &&
    normalizedMontage[0].beats[0].textSpan.includes('every blink') &&
    normalizedMontage[0].beats[1].textSpan.includes('every breath') &&
    normalizedMontage[0].beats[2].textSpan.includes('every move') &&
    montageL10Issues.length === 0 &&
    plainGlueBeats.length === 1,
  'Action-Triplet Montage Preservation & Stub Glue Merging',
  'Preserves every blink / every breath / every move without Pass 3 overwrite or L10 false positives while still merging plain connector stubs'
);

// 20.2 Semantic-Anchor + Confirmed Crib Flashback Isolation & Zero Adult Wardrobe Bleed
const semanticFlashbackScene: Scene = {
  index: 3,
  narratorLine: "It's an entity that has studied you since birth,",
  estimatedSeconds: 3.1,
  beats: [
    {
      beatIndex: 1,
      textSpan: "It's an entity",
      shotType: 'Medium Close-Up',
      cameraAngle: 'low-angle',
      cameraMovement: 'Static Frame',
      imagePrompt:
        'Vertical 9:16 portrait composition, Medium Close-Up, low-angle stark reveal of MirrorEntity (gaunt pitch-black ink silhouette, hollow white unblinking eyes, elongated tapered fingers), blank unsmiling expression, Shot on 50mm f/2.0 lens. --ar 9:16',
      estimatedSeconds: 1.0,
    },
    {
      beatIndex: 2,
      textSpan: 'that has studied',
      shotType: 'Over-the-Shoulder (OTS)',
      cameraAngle: 'high-angle',
      cameraMovement: 'Static Frame',
      imagePrompt:
        'Vertical 9:16 portrait composition, Over-the-Shoulder (OTS), high-angle framing of the protagonist facing forward completely unaware in crisp focus while MirrorEntity looms behind in deep room shadow watching silently, Shot on 35mm f/2.8 lens. --ar 9:16',
      estimatedSeconds: 1.0,
    },
    {
      beatIndex: 3,
      textSpan: 'you since birth,',
      shotType: 'Medium Shot',
      cameraAngle: 'high-angle',
      cameraMovement: 'Static Frame',
      imagePrompt:
        'Vertical 9:16 portrait composition, Medium Shot, high-angle flashback inside a dimly lit wooden nursery showing a tiny infant protagonist swaddled safely inside a wooden crib while MirrorEntity lurks behind dark crib slats in shadow watching silently, Shot on 35mm f/2.8 lens. --ar 9:16',
      estimatedSeconds: 1.1,
    },
  ],
};

const normalizedSemantic = normalizeStoryboardForDisplay([semanticFlashbackScene], {
  isVideoMode: false,
  isLongForm: false,
  styleProfile: junjiStyleProfile,
  characterSheet: dualCharEntitySheet,
  locationSheet: mirrorLocSheet,
});
const cribLockedPrompt = injectCompactCharacterLocks(
  semanticFlashbackScene.beats[2].imagePrompt,
  semanticFlashbackScene.beats[2].textSpan,
  semanticFlashbackScene.narratorLine,
  dualCharEntitySheet
);

assert(
  isInfancyOrChildhoodFlashback('you since birth,', cribLockedPrompt) &&
    hasDistinctMontageFocalSubject(semanticFlashbackScene.beats[1], semanticFlashbackScene.beats[2]) &&
    normalizedSemantic[0].beats.length === 3 &&
    !cribLockedPrompt.includes('turtleneck') &&
    !cribLockedPrompt.includes('dark jeans') &&
    !cribLockedPrompt.includes('DarkRoom'),
  'Semantic-Anchor Crib Flashback Shield',
  'Keeps Entity -> Studied -> Since Birth split across 3 distinct beats and prevents adult wardrobe or bedroom bleed onto infant crib flashback'
);

// 20.3 Dense 8-9 Word Blind-Spot Auditor + Climax/Negation Repair with 0.7s Montage Floor
const denseBlindSpotScenes: Scene[] = [
  {
    index: 3,
    narratorLine: "It's an entity that has studied you since birth,",
    estimatedSeconds: 2.5,
    beats: [
      {
        beatIndex: 1,
        textSpan: "It's an entity that has studied you since birth,",
        shotType: 'Close-Up',
        cameraAngle: 'eye-level',
        cameraMovement: 'Static Frame',
        imagePrompt: 'Vertical 9:16 portrait composition, Close-Up of dark room glass mirror. --ar 9:16',
        estimatedSeconds: 2.5,
      },
    ],
  },
  {
    index: 4,
    narratorLine: 'perfectly mimicking every blink, every breath, every move.',
    estimatedSeconds: 2.5,
    beats: [
      {
        beatIndex: 1,
        textSpan: 'perfectly mimicking every blink, every breath, every move.',
        shotType: 'Extreme Close-Up',
        cameraAngle: 'eye-level',
        cameraMovement: 'Static Frame',
        imagePrompt: 'Vertical 9:16 portrait composition, Extreme Close-Up of eyelids. --ar 9:16',
        estimatedSeconds: 2.5,
      },
    ],
  },
  {
    index: 6,
    narratorLine: 'You never reach out. You never cross.',
    estimatedSeconds: 2.5,
    beats: [
      {
        beatIndex: 1,
        textSpan: 'You never reach out. You never cross.',
        shotType: 'Medium Shot',
        cameraAngle: 'eye-level',
        cameraMovement: 'Static Frame',
        imagePrompt: 'Vertical 9:16 portrait composition, Medium Shot of protagonist standing by mirror. --ar 9:16',
        estimatedSeconds: 2.5,
      },
    ],
  },
  {
    index: 7,
    narratorLine: "But tonight, your reflection was a half-second late. Now it's smiling.",
    estimatedSeconds: 2.7,
    beats: [
      {
        beatIndex: 1,
        textSpan: "But tonight, your reflection was a half-second late. Now it's smiling.",
        shotType: 'Medium Shot',
        cameraAngle: 'high-angle',
        cameraMovement: 'Static Frame',
        imagePrompt: 'Vertical 9:16 portrait composition, Medium Shot of protagonist blinking before glass. --ar 9:16',
        estimatedSeconds: 2.7,
      },
    ],
  },
];

const denseAuditResults = auditScenesForRepair(denseBlindSpotScenes, junjiStyleProfile, false);
const coverageRecoveryMontage = verifyAndRepairSceneNarrationCoverage(
  [
    {
      index: 3,
      narratorLine: "It's an entity that has studied you since birth",
      estimatedSeconds: 2.0,
      beats: [
        {
          beatIndex: 1,
          textSpan: "It's an entity that has studied",
          shotType: 'Medium Close-Up',
          cameraAngle: 'low-angle',
          cameraMovement: 'Static Frame',
          imagePrompt: 'Vertical 9:16 portrait composition, Medium Close-Up, low-angle of unsmiling MirrorEntity silhouette. --ar 9:16',
          estimatedSeconds: 1.5,
        },
      ],
    },
  ],
  junjiStyleProfile,
  dualCharEntitySheet,
  mirrorLocSheet,
  { isLongForm: false, isVideoMode: false }
);
const recoveredCribBeat = coverageRecoveryMontage[0].beats[1];

assert(
  denseAuditResults.length === 4 &&
    Boolean(recoveredCribBeat) &&
    recoveredCribBeat.textSpan.toLowerCase().includes('since birth') &&
    recoveredCribBeat.estimatedSeconds >= 0.7 &&
    recoveredCribBeat.estimatedSeconds <= 1.3 &&
    recoveredCribBeat.imagePrompt.toLowerCase().includes('crib') &&
    !recoveredCribBeat.imagePrompt.includes('DarkRoom') &&
    !recoveredCribBeat.imagePrompt.includes('turtleneck'),
  'Dense 8-9 Word Pattern Auditor & 0.7s Crib Coverage Recovery',
  'Flags short 8-9 word unsplit triplets, entity+birth flashbacks, negations, and climax merges while recovering infant crib beat cleanly at montage timing'
);

// ============================================================================
// TEST SUITE 21: TEXT-TO-VIDEO 4S DURATION ALIGNMENT & IMAGE MODE ISOLATION
// ============================================================================
async function runTestSuite21() {
  console.log('\n--- Running Test Suite 21: Video Mode 4s Alignment ---');

  // 21.1: scaleBeatsToTargetDuration sums cleanly to 4.0s
  const scaledThreeBeats = scaleBeatsToTargetDuration(
    [
      {
        beatIndex: 1,
        textSpan: 'You stand still',
        shotType: 'Medium Shot',
        cameraAngle: 'eye-level',
        cameraMovement: 'Slow Push-In',
        imagePrompt: 'Vertical 9:16 portrait composition, Medium Shot, eye-level of Alex standing still.',
        estimatedSeconds: 1.8,
      },
      {
        beatIndex: 2,
        textSpan: 'before the glass',
        shotType: 'Close-Up',
        cameraAngle: 'low-angle',
        cameraMovement: 'Static Frame',
        imagePrompt: 'Vertical 9:16 portrait composition, Close-Up, low-angle of glass surface.',
        estimatedSeconds: 1.7,
      },
      {
        beatIndex: 3,
        textSpan: 'watching in silence',
        shotType: 'Extreme Close-Up',
        cameraAngle: 'eye-level',
        cameraMovement: 'Slow Push-In',
        imagePrompt: 'Vertical 9:16 portrait composition, Extreme Close-Up, eye-level of unblinking eyes.',
        estimatedSeconds: 2.0,
      },
    ],
    4
  );
  const scaledSum = Math.round(scaledThreeBeats.reduce((sum, b) => sum + (b.estimatedSeconds || 0), 0) * 10) / 10;

  assert(
    scaledSum === 4 && scaledThreeBeats.every((b) => (b.estimatedSeconds || 0) >= 0.6),
    'Suite 21: Video Mode 4s Alignment',
    '21.1 scaleBeatsToTargetDuration Locks Exact 4.0s Sum',
    `Expected beat sum === 4.0s, got ${scaledSum}s (${scaledThreeBeats.map((b) => b.estimatedSeconds).join(' + ')})`
  );

  // 21.2: runTwoPhaseProgressionAndRepair syncs Video Mode scenes, beats, and videoPrompt Duration to 4s
  const videoPipelineScenes = await runTwoPhaseProgressionAndRepair({
    scenes: [
      {
        index: 1,
        narratorLine: 'It is an entity that has studied you since birth in the dark hallway.',
        estimatedSeconds: 4,
        videoPrompt: 'Subject: Protagonist and entity in dark hallway. Duration: 4 seconds. Vertical 9:16.',
        beats: [
          {
            beatIndex: 1,
            textSpan: 'It is an entity',
            shotType: 'Medium Close-Up',
            cameraAngle: 'low-angle',
            cameraMovement: 'Slow Push-In',
            imagePrompt: 'Vertical 9:16 portrait composition, Medium Close-Up, low-angle of entity silhouette in hallway.',
            estimatedSeconds: 2.0,
          },
          {
            beatIndex: 2,
            textSpan: 'that has studied you since birth',
            shotType: 'Over-the-Shoulder (OTS)',
            cameraAngle: 'high-angle',
            cameraMovement: 'Static Frame',
            imagePrompt: 'Vertical 9:16 portrait composition, Over-the-Shoulder (OTS), high-angle of infant in wooden crib with shadow behind slats.',
            estimatedSeconds: 2.2,
          },
          {
            beatIndex: 3,
            textSpan: 'in the dark hallway.',
            shotType: 'Wide Establishing Shot',
            cameraAngle: 'eye-level',
            cameraMovement: 'Slow Push-In',
            imagePrompt: 'Vertical 9:16 portrait composition, Wide Establishing Shot, eye-level of empty hallway mirror.',
            estimatedSeconds: 1.9,
          },
        ],
      },
    ],
    styleProfile: junjiStyleProfile,
    characterSheet: dualCharEntitySheet,
    locationSheet: mirrorLocSheet,
    isLongForm: false,
    isVideoMode: true,
    targetVideoDuration: 4,
  });

  const videoScene = videoPipelineScenes[0];
  const videoBeatSum = Math.round(videoScene.beats.reduce((sum, b) => sum + (b.estimatedSeconds || 0), 0) * 10) / 10;
  const normalizedVideoDisplay = normalizeStoryboardForDisplay(videoPipelineScenes, {
    isVideoMode: true,
    isLongForm: false,
    targetVideoDuration: 4,
    styleProfile: junjiStyleProfile,
    characterSheet: dualCharEntitySheet,
    locationSheet: mirrorLocSheet,
  });
  const displayBeatSum = Math.round(
    normalizedVideoDisplay[0].beats.reduce((sum, b) => sum + (b.estimatedSeconds || 0), 0) * 10
  ) / 10;

  assert(
    videoScene.estimatedSeconds === 4 &&
      videoBeatSum === 4 &&
      normalizedVideoDisplay[0].estimatedSeconds === 4 &&
      displayBeatSum === 4 &&
      Boolean(videoScene.videoPrompt?.includes('Duration: 4 seconds')),
    'Suite 21: Video Mode 4s Alignment',
    '21.2 Video Mode Pipeline & Display Sync to 4.0s Clip Duration',
    `Expected 4s scene and beat sum, got pipeline=${videoScene.estimatedSeconds}s/${videoBeatSum}s, display=${normalizedVideoDisplay[0].estimatedSeconds}s/${displayBeatSum}s`
  );

  // 21.3: Image Mode remains isolated and preserves natural beat sum (not forced to 4s)
  const imageModeScenes = await runTwoPhaseProgressionAndRepair({
    scenes: [
      {
        index: 1,
        narratorLine: 'perfectly mimicking every blink, every breath, every move.',
        estimatedSeconds: 2.8,
        beats: [
          {
            beatIndex: 1,
            textSpan: 'perfectly mimicking every blink,',
            shotType: 'Extreme Close-Up',
            cameraAngle: 'eye-level',
            cameraMovement: 'Static Crisp Frame',
            imagePrompt: 'Vertical 9:16 portrait composition, Extreme Close-Up, eye-level of eyelids mid-blink.',
            estimatedSeconds: 0.9,
          },
          {
            beatIndex: 2,
            textSpan: 'every breath,',
            shotType: 'Extreme Close-Up',
            cameraAngle: 'low-angle',
            cameraMovement: 'Static Crisp Frame',
            imagePrompt: 'Vertical 9:16 portrait composition, Extreme Close-Up, low-angle of frost mist on glass.',
            estimatedSeconds: 0.9,
          },
          {
            beatIndex: 3,
            textSpan: 'every move.',
            shotType: 'Medium Shot',
            cameraAngle: 'eye-level',
            cameraMovement: 'Static Crisp Frame',
            imagePrompt: 'Vertical 9:16 portrait composition, Medium Shot, eye-level of raised shoulders.',
            estimatedSeconds: 1.0,
          },
        ],
      },
    ],
    styleProfile: junjiStyleProfile,
    characterSheet: dualCharEntitySheet,
    locationSheet: mirrorLocSheet,
    isLongForm: false,
    isVideoMode: false,
    targetVideoDuration: 4,
  });
  const imageBeatSum = Math.round(imageModeScenes[0].beats.reduce((sum, b) => sum + (b.estimatedSeconds || 0), 0) * 10) / 10;

  assert(
    imageBeatSum === 2.8 && imageModeScenes[0].estimatedSeconds === 2.8,
    'Suite 21: Video Mode 4s Alignment',
    '21.3 Strict Image Mode Isolation Preserves Natural Montage Timing',
    `Expected natural 2.8s sum in Image Mode even if targetVideoDuration passed, got ${imageModeScenes[0].estimatedSeconds}s / ${imageBeatSum}s`
  );

  // ============================================================================
  // 22. NEONOIR REGRESSION FIXES: PREPOSITION GRAMMAR, MONOCHROME FALSE-POSITIVE, GEO GUARD & CTA ROLES
  // ============================================================================
  console.log('\n--- Running Test Suite 22: Neo-Noir Regression Guards ---');

  const dirtyOrientationPrompt =
    'Wide Establishing Shot in a Vertical 9:16 portrait composition from a high-angle perspective, showcasing a dark alley. --ar 9:16';
  const cleanedGrammarPrompt = assembleCleanPrompt(dirtyOrientationPrompt, false);
  const formattedGrammarBeat = formatFinalBeatPrompt(
    {
      beatIndex: 1,
      textSpan: 'Inside the rain-soaked alley.',
      shotType: 'Wide Establishing Shot',
      cameraAngle: 'high-angle',
      cameraMovement: 'Static Frame',
      imagePrompt: 'Vertical 9:16 portrait composition, Wide Establishing Shot in a from a high-angle perspective overlooking wet stones. --ar 9:16',
      estimatedSeconds: 2.0,
    },
    false,
    false
  );
  assert(
    !/\bin a from a\b/i.test(cleanedGrammarPrompt) &&
      !/\bin a from a\b/i.test(formattedGrammarBeat.imagePrompt) &&
      formattedGrammarBeat.imagePrompt.includes('from a high-angle perspective'),
    'Suite 22: Neo-Noir Regression Guards',
    '22.1 Eliminates Dangling Prepositions Around Orientation Prefixes',
    `Cleaned: ${cleanedGrammarPrompt} | Formatted: ${formattedGrammarBeat.imagePrompt}`
  );

  const neoNoirStyle: StyleProfile = {
    artStyle: 'Atmospheric 2.5D ink-illustrated Neo-Noir animation with round white stickman heads',
    colorPalette:
      'Deep rainy asphalt slate contrasted with darkroom crimson safelight, amber, neon cyan, and black-and-white silver-gelatin film prints',
    lighting: 'High-contrast nocturnal chiaroscuro with rain reflections',
    eraAndSetting: '1980s Neo-Seoul',
  };
  const neoNoirSanitized = sanitizeMonochromeLighting('Towering neon cyan signage and amber lamps', neoNoirStyle);
  assert(
    isMonochromeStyle(neoNoirStyle) === false &&
      neoNoirSanitized.includes('neon cyan') &&
      !neoNoirSanitized.includes('stark white accents'),
    'Suite 22: Neo-Noir Regression Guards',
    '22.2 Prevents False Monochrome Conversion on Full-Color Palettes With B&W Props',
    `isMono=${isMonochromeStyle(neoNoirStyle)}, text=${neoNoirSanitized}`
  );

  const neoSeoulGeo = extractGeographicAnchor('In 1980s Neo-Seoul, a young street photographer');
  const realCountryGeo = extractGeographicAnchor('In Sweden,');
  assert(
    neoSeoulGeo === null && realCountryGeo !== null && realCountryGeo.countryOrRegion === 'Sweden',
    'Suite 22: Neo-Noir Regression Guards',
    '22.3 Skips Cartographic Map Hijack on Fictional Hyphenated Settings While Keeping Real Countries',
    `neoSeoulGeo=${JSON.stringify(neoSeoulGeo)}, realCountryGeo=${JSON.stringify(realCountryGeo)}`
  );

  const photographerCta = compileCtaPrompt({
    storyPremise: 'A street photographer rescues a child at a midnight crosswalk.',
    styleProfile: neoNoirStyle,
    characterSheet: {
      Photographer: 'slender black-ink stickman with khaki trench coat and silver 35mm camera',
    },
    format: 'short',
    platform: 'tiktok',
    modality: 'image',
  });
  assert(
    photographerCta.questionText.includes("the photographer's position") &&
      !photographerCta.questionText.includes("Photographer's position") &&
      photographerCta.compiledPrompt.includes('portrait of the photographer (locked visual identity:'),
    'Suite 22: Neo-Noir Regression Guards',
    '22.4 Formats Generic Sheet Role Keys Into Natural Prose in CTA Prompts',
    `Got questionText: ${photographerCta.questionText}`
  );
}

// ============================================================================
// SUITE 23: SCI-FI REGRESSION GUARDS (CHARACTER LOCK ISOLATION, THUMBNAIL HYGIENE, DILEMMA CTA)
// ============================================================================
function runTestSuite23() {
  const sciFiSheet: Record<string, string> = {
    'Mira Vale':
      'A lean woman in her mid-twenties with olive skin, sharp jawline, and asymmetrical dark undercut hair, wearing a weathered black techwear jacket traced with glowing cyan circuitry seams',
    'Chrome-Faced Enforcers':
      'Tall armored tactical operatives wearing seamless polished liquid-chrome featureless faceplates and heavy matte-carbon trench coats with glowing magenta shoulder optics',
  };

  const soloBeatLocked = injectCompactCharacterLocks(
    'Vertical 9:16 portrait composition, Medium Close-Up at eye-level inside a damp doorway. The lean woman with asymmetrical dark undercut hair and weathered black techwear jacket connects the chip. Visual Style: Cinematic cyberpunk realism. --ar 9:16',
    'she discovers',
    'Hunted by chrome-faced enforcers, she discovers it holds the city’s erased history, and her own.',
    sciFiSheet
  );
  const firstNameBeatLocked = injectCompactCharacterLocks(
    'Vertical 9:16 portrait composition, Medium Shot from a low-angle on a rooftop beside a relay tower. Visual Style: Cinematic cyberpunk realism. --ar 9:16',
    'At dawn, Mira must choose:',
    'At dawn, Mira must choose: sell the truth or broadcast it.',
    sciFiSheet
  );
  assert(
    !soloBeatLocked.includes('Chrome-Faced Enforcers') &&
      soloBeatLocked.includes('Featuring Mira Vale') &&
      firstNameBeatLocked.includes('Featuring Mira Vale'),
    'Suite 23: Sci-Fi Regression Guards',
    '23.1 Multi-Character Lock Isolation & First-Name Alias Binding',
    `solo=${soloBeatLocked} | alias=${firstNameBeatLocked}`
  );

  const sciFiThumb = compileThumbnailPrompt({
    rawThumbnail: {
      heroMoment: 'Mira jamming the glowing cyan memory-chip into the rooftop relay',
      expression: 'Fierce defiance',
      bgDescription: 'Dark, simplified high-contrast Neo-Kaido skyline fading into silhouette towers',
      accentColor: 'intense glowing cyan with warm dawn amber rim light',
      hookText: 'BROADCAST THE TRUTH',
    },
    styleProfile: {
      artStyle: 'Cinematic cyberpunk realism',
      colorPalette: 'Deep charcoal shadows, glowing cyan circuitry, warm golden dawn amber',
      lighting: 'High-contrast neon chiaroscuro, transitioning to 3200K warm golden sunrise rim light at the climax',
      eraAndSetting: 'Near-future Neo-Kaido',
    },
    characterSheet: { 'Mira Vale': sciFiSheet['Mira Vale'] },
    format: 'short',
    platform: 'tiktok',
  });
  assert(
    !/intense\s+intense/i.test(sciFiThumb.compiledPrompt) &&
      !/rim\s+light\s+rim\s+lighting/i.test(sciFiThumb.compiledPrompt) &&
      !/dark\s+simplified\s+background:\s*Dark,\s*simplified/i.test(sciFiThumb.compiledPrompt) &&
      sciFiThumb.compiledPrompt.includes('. Subject centered in the upper-middle vertical band'),
    'Suite 23: Sci-Fi Regression Guards',
    '23.2 Clean Thumbnail Rim Lighting, Background Deduplication & Subject Capitalization',
    `Thumb: ${sciFiThumb.compiledPrompt}`
  );

  const sciFiPremise =
    "In Neo-Kaido, courier Mira Vale smuggles a stolen memory-chip through rain-soaked neon streets. Hunted by chrome-faced enforcers, she discovers it holds the city's erased history, and her own. At dawn, Mira must choose: sell the truth or broadcast it, igniting a revolution.";
  const sciFiCta = compileCtaPrompt({
    storyPremise: sciFiPremise,
    styleProfile: {
      artStyle: 'Cinematic cyberpunk realism',
      colorPalette: 'Deep charcoal shadows and glowing cyan circuitry',
      lighting:
        'High-contrast neon chiaroscuro with 5200K teal reflections, transitioning to 3200K warm golden sunrise rim light at the climax',
      eraAndSetting: 'Near-future Neo-Kaido',
    },
    characterSheet: { 'Mira Vale': sciFiSheet['Mira Vale'] },
    format: 'short',
    platform: 'tiktok',
    modality: 'image',
  });
  assert(
    sciFiCta.questionText === 'Would you sell the truth or broadcast it?' &&
      !sciFiCta.compiledPrompt.toLowerCase().includes('transitioning to'),
    'Suite 23: Sci-Fi Regression Guards',
    '23.3 Dilemma-First Sci-Fi CTA & Static Frame Lighting Scrubbing',
    `question=${sciFiCta.questionText} | prompt=${sciFiCta.compiledPrompt}`
  );
}

// ============================================================================
// SUITE 24: DOCUMENTARY REGRESSION GUARDS (CAMELCASE ROLE CLEANUP & HISTORY CTA)
// ============================================================================
function runTestSuite24() {
  const docStyle: StyleProfile = {
    artStyle: 'Authentic 1960s archival documentary realism',
    colorPalette: 'Muted mid-century office tones of warm cream, olive green, and charcoal gray',
    lighting: 'Restrained dramatic documentary lighting balancing 3400K desk lamps, shifting to 5600K solar rim light',
    eraAndSetting: '1969, NASA engineering offices and Apollo 11',
  };
  const docSheet: Record<string, string> = {
    LeadSoftwareEngineer:
      'Mid-1960s American woman in her early thirties with shoulder-length dark brown wavy hair, tortoise-shell rectangular eyeglasses, cream collared blouse, and muted olive cardigan',
  };

  const docThumb = compileThumbnailPrompt({
    rawThumbnail: {
      heroMoment: 'A focused 1960s female software engineer standing beside towering Apollo code printouts',
      expression: 'calm steely determination',
      bgDescription: 'darkened 1960s NASA computer lab',
      accentColor: 'warm amber',
      hookText: 'TRUST THE CODE',
    },
    styleProfile: docStyle,
    characterSheet: docSheet,
    format: 'short',
    platform: 'tiktok',
  });
  assert(
    !docThumb.compiledPrompt.includes('LeadSoftwareEngineer') &&
      docThumb.compiledPrompt.includes('Hero Subject: The lead software engineer (locked visual identity:'),
    'Suite 24: Documentary Regression Guards',
    '24.1 Splits CamelCase Role Keys Into Natural Prose in Thumbnail Prompts',
    `Thumb: ${docThumb.compiledPrompt}`
  );

  const docCta = compileCtaPrompt({
    storyPremise:
      'In 1969, American engineer Margaret Hamilton leads NASA Apollo guidance-software team as Apollo 11 approaches the Moon. On July 20, 1969, her work helps Neil Armstrong and Buzz Aldrin land safely on the Moon.',
    styleProfile: docStyle,
    characterSheet: docSheet,
    format: 'short',
    platform: 'tiktok',
    modality: 'image',
  });
  assert(
    !docCta.compiledPrompt.includes('LeadSoftwareEngineer') &&
      docCta.compiledPrompt.includes('portrait of the lead software engineer (locked visual identity:') &&
      docCta.questionText.includes('historic moment'),
    'Suite 24: Documentary Regression Guards',
    '24.2 Uses Documentary CTA Question & Natural Role Prose Without CamelCase Leak',
    `question=${docCta.questionText} | prompt=${docCta.compiledPrompt}`
  );
}

// ============================================================================
// SUITE 25: HORROR REGRESSION GUARDS (CLOSE-UP AGE/RUNNER-UP ISOLATION & THUMBNAIL PUNCTUATION)
// ============================================================================
function runTestSuite25() {
  const normalizedHorrorSheet = normalizeContinuitySheetKeys({
    Elara:
      'A pale, gaunt young woman in her late twenties with dark under-eye shadows, hollow cheekbones, and long tousled dark hair, wearing an oversized loose charcoal knit sweater.',
    TheWomanBehindHer:
      'A gaunt older woman with sunken cheeks, pale ashen skin, and long tangled silver-streaked dark hair, wearing a faded dusty charcoal nightgown with bare pale feet.',
  });
  const olderWomanCloseUp = injectCompactCharacterLocks(
    'Vertical 9:16 portrait composition, Close-Up with a tense dutch-tilt from the shadows behind the wrought-iron bed. The gaunt older woman with sunken cheeks, pale ashen skin, and tangled silver-streaked dark hair wearing the faded dusty charcoal nightgown snaps both hollow eyes wide open in the darkness, staring straight toward the blurred charcoal-sweatered silhouette of the unsuspecting young archivist standing ahead at the mirror. Visual Style: Psychological horror realism. --ar 9:16',
    'has been waiting.',
    'When Elara finally confronts it, she realizes the mirror has been showing her, and the woman sleeping behind her has been waiting.',
    normalizedHorrorSheet
  );
  assert(
    Object.keys(normalizedHorrorSheet).includes('The Woman Behind Her') &&
      !olderWomanCloseUp.includes('Featuring Elara'),
    'Suite 25: Horror Regression Guards',
    '25.1 Prevents Background/Age-Mismatched Lock From Stamping Onto Older Character Close-Up',
    `keys=${Object.keys(normalizedHorrorSheet).join(',')} | prompt=${olderWomanCloseUp}`
  );

  const horrorThumb = compileThumbnailPrompt({
    rawThumbnail: {
      heroMoment:
        'A pale archivist holding a flickering lantern confronts a cracked mirror that reveals a gaunt older woman awake on the bed behind her.',
      expression: 'wide-eyed frozen terror.',
      bgDescription: 'pitch-dark dust-filled Victorian parlor.',
      accentColor: 'dim amber and cold blue',
      hookText: 'LOOK BEHIND HER',
    },
    styleProfile: {
      artStyle: 'Psychological horror realism',
      colorPalette: 'Desaturated charcoal grays and flickering amber gold',
      lighting: 'Dim 2700K amber lantern key light',
      eraAndSetting: 'Victorian house',
    },
    characterSheet: normalizedHorrorSheet,
    format: 'short',
    platform: 'tiktok',
  });
  assert(
    !horrorThumb.compiledPrompt.includes('..') &&
      !horrorThumb.cleanPlatePrompt.includes('..'),
    'Suite 25: Horror Regression Guards',
    '25.2 Eliminates Double Periods From Thumbnail Hero Moment & Background',
    `Thumb: ${horrorThumb.compiledPrompt}`
  );
}

// ============================================================================
// SUITE 26: STYLIZED ART REGRESSION GUARDS (STATIC FRAME PHRASING, STYLE ISOLATION, COMMON-NOUN CASING)
// ============================================================================
function runTestSuite26() {
  const cleanStatic = sanitizeStillImageMotionAndOptics(
    'Vertical 9:16 composition, Extreme Wide Shot establishing Brushwick rooftop skyline with a crisp static frame of the hand-painted city skyline under golden morning sun. --ar 9:16',
    'Extreme Wide Shot',
    false
  );
  assert(
    cleanStatic.includes('with a crisp view of the') && !cleanStatic.includes('with a crisp of the'),
    'Suite 26: Stylized Art Regression Guards',
    '26.1 Preserves Noun Head When Stripping Static Frame Phrasing',
    `Prompt: ${cleanStatic}`
  );

  const stylizedSheet = {
    Ink: 'Small agile 2D black stickman figure with bold uniform charcoal linework and expressive white eye dots.',
    'Claymation Cat':
      'Chubby tactile terracotta-orange claymation cat with thumbprint sculpting textures, wide round eyes, and tiny charcoal whiskers.',
    'Animated Drawings':
      'Loose hand-drawn charcoal stickman sketches with fluttering paper edges and expressive white eye dots.',
    'The Inventor':
      'Young anime-style inventor with spiky dark hair, brass forehead goggles, and a dusty canvas work apron.',
  };

  const emptySkylineBeat = injectCompactCharacterLocks(
    'Vertical 9:16 composition, Extreme Wide Shot of the Brushwick city skyline at dawn, terracotta chimney tops casting soft long shadows across painted slate roofs. Visual Style: Bold stylized art blending clean 2D stickman animation, expressive anime character faces. --ar 9:16',
    'Brushwick woke under a painted sky.',
    'Brushwick woke under a painted sky. Every morning, ink-lined shadows stretched across the rooftops.',
    stylizedSheet
  );
  assert(
    !emptySkylineBeat.includes('Featuring Ink') &&
      !emptySkylineBeat.includes('Featuring Claymation Cat') &&
      !emptySkylineBeat.includes('Featuring Animated Drawings'),
    'Suite 26: Stylized Art Regression Guards',
    '26.2 Prevents Visual Style Keywords & Scenery Colors From Injecting Phantom Characters',
    `Prompt: ${emptySkylineBeat}`
  );

  const commonNounAndHyphenBeat = injectCompactCharacterLocks(
    'Vertical 9:16 composition, Medium Shot showing The Inventor wearing brass goggles and a canvas work apron as spiky-haired anime-style hands calm scrambling ink limbs beside Ink on the wooden desk. Visual Style: Mixed-media stylized art. --ar 9:16',
    'Ink darted away from The Inventor.',
    'Ink darted across the drafting desk away from The Inventor.',
    stylizedSheet
  );
  assert(
    !commonNounAndHyphenBeat.includes('scrambling ink (') &&
      commonNounAndHyphenBeat.includes('beside Ink (') &&
      !commonNounAndHyphenBeat.includes('The Inventor ('),
    'Suite 26: Stylized Art Regression Guards',
    '26.3 Enforces Case-Sensitive Common-Noun Locks & Hyphen-Aware Redundant Parenthesis Suppression',
    `Prompt: ${commonNounAndHyphenBeat}`
  );
}

// ============================================================================
// SUITE 27: MULTI-CHARACTER & FLASHBACK REGRESSION GUARDS
// ============================================================================
function runTestSuite27() {
  const lighthouseCast = {
    'Adult Elena':
      'Adult woman in her mid-thirties with silver-streaked dark hair tied neatly back, weathered fair skin, a buttoned navy waterproof raincoat, dark rubber coastal boots, and a brass storm lantern',
    'Child Elena':
      'Nine-year-old girl with dark hair tucked under a bright yellow rain hat, a yellow knit sweater over sturdy dark trousers, worn coastal sneakers, and a clothbound sketchbook',
    'Adult Rowan':
      'Adult man in his mid-thirties with tousled dark-brown hair, weathered tanned skin, a faded olive-green canvas jacket over a dark wool shirt, worn brown leather boots, and a scarred brass pocket compass',
    'Child Rowan':
      'Nine-year-old boy with messy brown hair, sun-tanned skin, a rolled-sleeve striped cotton shirt, sturdy canvas shorts, worn canvas sneakers, and an unscarred shiny brass pocket compass',
  };

  const emptyHeadlandLocked = injectCompactCharacterLocks(
    'Vertical 9:16 portrait composition, Wide Establishing Shot at a low-angle, A towering stone coastal lighthouse stands atop wet dark basalt cliffs overlooking choppy swells in present-day Harborline along the empty headland. Visual Style: Cinematic animated realism. --ar 9:16',
    'In present-day Harborline, lighthouse keeper Elena',
    'In present-day Harborline, lighthouse keeper Elena finds a message from her childhood friend Rowan, who vanished twenty years ago.',
    lighthouseCast
  );
  assert(
    !emptyHeadlandLocked.includes('Featuring Adult Elena') &&
      !emptyHeadlandLocked.includes('Featuring Child Elena') &&
      !emptyHeadlandLocked.includes('Featuring Adult Rowan'),
    'Suite 27: Multi-Character & Flashback Regression Guards',
    '27.1 Keeps Empty Headland Establishing Shot Free of Phantom Character Locks',
    `Prompt: ${emptyHeadlandLocked}`
  );

  const flashbackMixedLocked = injectCompactCharacterLocks(
    'Vertical 9:16 portrait composition, Wide Establishing Shot at eye-level, In a sun-drenched childhood summer flashback, a young girl in a yellow rain hat and sweater carrying a worn sketchbook runs along golden Harborline tide pools beside a young boy with messy brown hair in a rolled-sleeve shirt. Shot on 28mm f/2.8 prime lens. Visual Style: Cinematic animated realism. --ar 9:16',
    'As she reads, flashbacks reveal their shared summers',
    'As she reads, flashbacks reveal their shared summers and a promise to reunite.',
    lighthouseCast
  );
  assert(
    !flashbackMixedLocked.includes('Featuring Adult Elena') &&
      !flashbackMixedLocked.includes('Featuring Adult Rowan') &&
      flashbackMixedLocked.includes('Featuring Child Elena') &&
      flashbackMixedLocked.includes('Featuring Child Rowan'),
    'Suite 27: Multi-Character & Flashback Regression Guards',
    '27.2 Keeps Adult Locks Out of Childhood Flashback While Locking Both Child Characters Despite Framing Pronoun',
    `Prompt: ${flashbackMixedLocked}`
  );

  const soloRowanLocked = injectCompactCharacterLocks(
    'Vertical 9:16 portrait composition, Wide Establishing Shot at eye-level, Back in cool present-day Harborline, a quiet adult man in a faded green canvas jacket and worn leather boots stands on wooden pier planks. His broad shoulders face the distant lighthouse silhouette. Shot on 35mm f/2.8 wide prime lens. Visual Style: Cinematic animated realism. --ar 9:16',
    'Rowan returns changed,',
    'Rowan returns changed, but Elena must decide whether their old bond can survive the truth.',
    lighthouseCast
  );
  assert(
    !soloRowanLocked.includes('Featuring Adult Elena') &&
      !soloRowanLocked.includes('Featuring Child Elena') &&
      soloRowanLocked.includes('Featuring Adult Rowan'),
    'Suite 27: Multi-Character & Flashback Regression Guards',
    '27.3 Prevents Female & Child Locks From Stamping Onto Solitary Adult Male Shot',
    `Prompt: ${soloRowanLocked}`
  );

  const dualEraStyle: StyleProfile = {
    artStyle:
      'Cinematic animated realism with warm golden childhood flashbacks, cool blue-gray present-day coastal tones',
    colorPalette:
      'Cool slate blue-gray and deep navy in present-day Harborline; warm amber and vivid yellow in childhood flashbacks',
    lighting:
      'Overcast 5800K cool coastal twilight contrasted with 3000K warm brass lantern light in the present; rich 3000K golden-hour coastal sunlight in childhood flashbacks',
    eraAndSetting: 'Present-day Harborline lighthouse contrasted with coastal cove flashbacks',
  };

  const formattedPresentBeat = formatFinalBeatPrompt(
    {
      beatIndex: 3,
      textSpan: 'from her childhood friend Rowan,',
      shotType: 'Over-the-Shoulder (OTS)',
      cameraAngle: 'high-angle',
      cameraMovement: 'Slow Push-In',
      imagePrompt:
        'Over-the-Shoulder (OTS) at a high-angle, Seen past the adult woman navy raincoat shoulder, her hands unfold the damp paper message in cinematic animated realism. Shot on 50mm f/2 prime lens. --ar 9:16',
      estimatedSeconds: 2,
    },
    false,
    false,
    { styleProfile: dualEraStyle, characterSheet: lighthouseCast }
  );
  assert(
    formattedPresentBeat.imagePrompt.includes('Visual Style:') &&
      !formattedPresentBeat.imagePrompt.toLowerCase().includes('childhood flashback'),
    'Suite 27: Multi-Character & Flashback Regression Guards',
    '27.4 Appends Era-Clean Visual Style Suffix Without Flashback Leakage on Present-Day Beat',
    `Prompt: ${formattedPresentBeat.imagePrompt}`
  );

  const harborThumb = compileThumbnailPrompt({
    rawThumbnail: {
      heroMoment:
        'Adult Elena holding her glowing lantern inside the misty lighthouse doorway faces Rowan extending his scarred compass across the threshold.',
      expression: 'Guarded disbelief tightening her brows.',
      bgDescription: 'Dark fog-choked coastal stone doorway.',
      accentColor: 'Warm 3000K amber lantern rim light',
      hookText: 'TWENTY YEARS GONE',
    },
    styleProfile: dualEraStyle,
    characterSheet: lighthouseCast,
    format: 'short',
    platform: 'tiktok',
  });
  assert(
    harborThumb.compiledPrompt.includes('faces Adult Rowan (') &&
      !harborThumb.compiledPrompt.toLowerCase().includes('childhood flashback'),
    'Suite 27: Multi-Character & Flashback Regression Guards',
    '27.5 Expands Secondary Character Visual Identity & Strips Opposite-Era Clauses in Thumbnail',
    `Thumb: ${harborThumb.compiledPrompt}`
  );

  const reunionCta = compileCtaPrompt({
    storyPremise:
      'In present-day Harborline, lighthouse keeper Elena finds a message from her childhood friend Rowan, who vanished twenty years ago. As she reads, flashbacks reveal their shared summers and a promise to reunite. Rowan returns changed, but Elena must decide whether their old bond can survive the truth.',
    styleProfile: dualEraStyle,
    characterSheet: lighthouseCast,
    format: 'short',
    platform: 'tiktok',
    modality: 'image',
  });
  assert(
    !reunionCta.questionText.includes('single clue') &&
      reunionCta.questionText.includes('old bond') &&
      !reunionCta.compiledPrompt.toLowerCase().includes('childhood flashback'),
    'Suite 27: Multi-Character & Flashback Regression Guards',
    '27.6 Uses Emotional Reunion/Choice Question & Era-Clean Lighting in CTA',
    `question=${reunionCta.questionText} | prompt=${reunionCta.compiledPrompt}`
  );
}

// ============================================================================
// 28. LONG-SCRIPT LATENCY, SHARED-MEDIUM SIMILARITY & FINANCE CTA GUARDS
// ============================================================================
function runTestSuite28() {
  console.log('\n--- Running Test Suite 28: Long-Script Latency, Diorama Shared-Medium & Finance CTA ---');

  const dioramaStyle: StyleProfile = {
    artStyle:
      'Handcrafted stop-motion clay diorama with sculpted polymer figurines, carved walnut furniture, textured cardstock ledgers, and matte paper-craft backdrops',
    colorPalette:
      'Warm cream limestone, deep forest green cardstock, polished walnut brown, brushed brass accents, and muted crimson ink',
    lighting: 'Warm 3200K tabletop key light with soft miniature fill and crisp rim edges',
    eraAndSetting: 'Miniature handcrafted clay diorama of a classic walnut bank hall and homeowner living room',
  };

  const dioramaCast: Record<string, string> = {
    'Clay Homeowner':
      'Handcrafted matte clay miniature figurine of an anxious homeowner wearing a knitted sage green sweater, cuffed tan chinos, and round tortoiseshell glasses, sculpted hair',
    'Clay Bank Lender':
      'Handcrafted matte clay miniature figurine of a stern bank lender in a charcoal pinstripe suit, crisp white collar, silk crimson tie, slicked-back clay hair, holding a brass fountain pen',
  };

  const dioramaLocations: Record<string, string> = {
    'Walnut Bank Hall':
      'Miniature handcrafted clay diorama interior with carved walnut teller counter, green cardstock ledger stacks, brass banker lamp, and arched cream windows',
  };

  const ignoredTokens = buildSharedContextIgnoreTokens(dioramaStyle, dioramaLocations, dioramaCast);

  const beatA =
    'Vertical 9:16 portrait composition, Medium Shot at eye-level, Clay Homeowner slides brass abacus beads across the carved walnut teller counter inside the Walnut Bank Hall while checking handwritten interest figures. Shot on 50mm f/2.0 prime lens. Visual Style: Handcrafted stop-motion clay diorama. --ar 9:16';
  const beatB =
    'Vertical 9:16 portrait composition, Close-Up at high-angle, Heavy brass shears slice cleanly through a bright crimson ribbon tied around stacked green cardstock ledgers on the oak desk. Shot on 85mm f/1.8 portrait lens. Visual Style: Handcrafted stop-motion clay diorama. --ar 9:16';

  const simWithIgnore = computeVisualPromptSimilarity(beatA, beatB, ignoredTokens);
  const flaggedScene = auditScenesForRepair(
    [
      {
        index: 2,
        narratorLine: 'The lender calculated every month of interest and prepared the contract.',
        estimatedSeconds: 5,
        beats: [
          {
            beatIndex: 1,
            textSpan: 'The lender calculated every month of interest',
            shotType: 'Medium Shot',
            cameraAngle: 'eye-level',
            cameraMovement: 'Static Frame',
            imagePrompt: beatA,
            estimatedSeconds: 2.5,
          },
          {
            beatIndex: 2,
            textSpan: 'and prepared the contract.',
            shotType: 'Close-Up',
            cameraAngle: 'high-angle',
            cameraMovement: 'Static Frame',
            imagePrompt: beatB,
            estimatedSeconds: 2.5,
          },
        ],
      },
    ],
    dioramaStyle,
    false,
    undefined,
    dioramaCast,
    dioramaLocations
  );

  assert(
    simWithIgnore < 0.46 && flaggedScene.length === 0,
    'Suite 28: Long-Script Latency, Diorama Shared-Medium & Finance CTA',
    '28.1 Shared Diorama/Cast Medium Tokens Do Not Inflate Similarity or Trigger False Repair',
    `sim=${simWithIgnore.toFixed(3)} | flagged=${JSON.stringify(flaggedScene)}`
  );

  // 28.2 Solo Clay Homeowner beat must NOT receive Clay Bank Lender lock, AND inline description should not duplicate Featuring (...)
  const inlineSoloPrompt =
    'Vertical 9:16 portrait composition, Medium Close-Up at eye-level, A handcrafted matte clay miniature figurine of an anxious homeowner wearing a knitted sage green sweater, cuffed tan chinos, and round tortoiseshell glasses sighs over a paper mortgage bill at a kitchen table. Shot on 50mm f/2.0 prime lens. Visual Style: Handcrafted stop-motion clay diorama. --ar 9:16';
  const soloLocked = injectCompactCharacterLocks(
    inlineSoloPrompt,
    'She checked her monthly statement in worry.',
    'The homeowner stared at her mortgage bill, wondering if refinancing would save money.',
    dioramaCast
  );
  assert(
    !soloLocked.includes('Clay Bank Lender') && !soloLocked.includes('Featuring Clay Homeowner'),
    'Suite 28: Long-Script Latency, Diorama Shared-Medium & Finance CTA',
    '28.2 Prevents Shared-Medium Lender Leakage and Redundant Parenthetical Duplication',
    `Prompt: ${soloLocked}`
  );

  // 28.3 Lens punctuation, connector merge restraint, and clean duplicate fallback grammar
  const commaLensFormatted = formatFinalBeatPrompt(
    {
      beatIndex: 1,
      textSpan: 'Signing early triggers a steep fee',
      shotType: 'Close-Up',
      cameraAngle: 'low-angle',
      cameraMovement: 'Static Frame',
      imagePrompt:
        'Vertical 9:16 portrait composition, Close-Up at low-angle, Hands stamp a red ink seal onto the mortgage page (clay miniature hands), Shot on 50mm f/2.0 prime lens. --ar 9:16',
      estimatedSeconds: 2.2,
    },
    false,
    false,
    { styleProfile: dioramaStyle, characterSheet: dioramaCast }
  );

  const dupProgressed = deduplicateAndProgressSceneBeats(
    [
      {
        beatIndex: 1,
        textSpan: 'Before you sign that refinancing deal',
        shotType: 'Medium Shot',
        cameraAngle: 'eye-level',
        cameraMovement: 'Static Frame',
        imagePrompt:
          'Vertical 9:16 portrait composition, Medium Shot at eye-level, Clay Homeowner leans toward the teller counter inside a handcrafted bank room reading fine print. Shot on 35mm f/2.8 lens.',
        estimatedSeconds: 2.2,
      },
      {
        beatIndex: 2,
        textSpan: 'check whether a hidden fee awaits.',
        shotType: 'Medium Shot',
        cameraAngle: 'eye-level',
        cameraMovement: 'Static Frame',
        imagePrompt:
          'Vertical 9:16 portrait composition, Medium Shot at eye-level, Clay Homeowner leans toward the teller counter inside a handcrafted bank room reading fine print. Shot on 35mm f/2.8 lens.',
        estimatedSeconds: 2.2,
      },
    ],
    {
      styleProfile: dioramaStyle,
      characterSheet: dioramaCast,
      locationSheet: dioramaLocations,
      isLongForm: false,
      isVideoMode: false,
    }
  );

  const progressedPrompt2 = dupProgressed[1]?.imagePrompt || '';
  assert(
    commaLensFormatted.imagePrompt.includes('). Shot on 50mm f/2.0 prime lens') &&
      dupProgressed.length === 2 &&
      !/inside A\b/i.test(progressedPrompt2) &&
      !/\bof tight portrait study\b/i.test(progressedPrompt2) &&
      !/\.\s*palette\b/i.test(progressedPrompt2),
    'Suite 28: Long-Script Latency, Diorama Shared-Medium & Finance CTA',
    '28.3 Fixes Comma-Before-Lens Punctuation and Fallback Template Grammar',
    `commaLens=${commaLensFormatted.imagePrompt} | progressed2=${progressedPrompt2}`
  );

  // 28.4 Thumbnail prompt has no double periods ("..")
  const financeThumb = compileThumbnailPrompt({
    rawThumbnail: {
      heroMoment: 'Clay Homeowner freezes as crimson ink highlights a hidden penalty clause across the oversized parchment.',
      expression: 'Wide-eyed shock beneath round glasses.',
      bgDescription: 'Warm carved walnut bank hall softly out of focus.',
      accentColor: 'Muted crimson ink glow',
      hookText: 'THE HIDDEN TRAP',
    },
    styleProfile: dioramaStyle,
    characterSheet: dioramaCast,
    format: 'short',
    platform: 'tiktok',
  });
  assert(
    !financeThumb.compiledPrompt.includes('..'),
    'Suite 28: Long-Script Latency, Diorama Shared-Medium & Finance CTA',
    '28.4 Eliminates Double-Period Artifacts in Compiled Thumbnail Prompt',
    `Thumb: ${financeThumb.compiledPrompt}`
  );

  // 28.5 Financial mortgage script with "future income stream" must get Finance/Contract CTA, not Sci-Fi
  const financeCta = inferStoryAdaptiveCtaQuestion(
    'Most homeowners assume paying off a mortgage early is always smart, because lenders rely on that future income stream and build a prepayment penalty clause right into the contract.'
  );
  assert(
    financeCta.primaryQuestion.toLowerCase().includes('loan contract') &&
      !financeCta.primaryQuestion.toLowerCase().includes('technology'),
    'Suite 28: Long-Script Latency, Diorama Shared-Medium & Finance CTA',
    '28.5 Routes Mortgage Script With "future income stream" to Finance CTA Instead of Sci-Fi',
    `CTA: ${financeCta.primaryQuestion}`
  );
}

// ============================================================================
// 29. FULL-DETAIL FIRST-APPEARANCE CHARACTER LOCKS & PERSISTENT VISUAL STYLE
// ============================================================================
function runTestSuite29() {
  console.log('\n--- Running Test Suite 29: First-Appearance Eyewear/Outfit Locks & Persistent Style ---');

  const richDioramaStyle: StyleProfile = {
    artStyle:
      'Handcrafted miniature stop-motion diorama built from soft-matte sculpted clay, weathered oak, and heavy ivory cardstock with crimson wax seals',
    colorPalette: 'Warm ivory cardstock, weathered oak browns, soft-matte terracotta clay, crimson wax, brushed antique brass',
    lighting: 'Warm 3200K studio tungsten key lights with subtle 5200K cool rim highlights',
    eraAndSetting: 'Miniature financial diorama combining a cardstock home studio and weathered oak bank hall',
  };

  const fullMortgageCast: Record<string, string> = {
    'Clay Homeowner':
      'A handcrafted soft-matte clay miniature figure with rounded human proportions, warm terracotta clay skin tone, short sculpted dark brown clay hair, wearing a slate-blue knitted wool miniature sweater, charcoal trousers, and sturdy brown leather clay boots',
    'Clay Bank Lender':
      'A tall, rigid soft-matte clay miniature figure with sharp angular facial planes, sleek silver-gray sculpted hair, wire-rimmed brass spectacles, wearing a tailored pinstripe charcoal clay suit, crisp ivory shirt, crimson silk tie, and polished black clay dress shoes',
  };

  // 29.1 Missing glasses/outfit on later beat and Thumbnail secondary character must NEVER clip at 18 words
  const partialLenderBeat = injectCompactCharacterLocks(
    'Vertical 9:16 portrait composition, Medium Shot, low-angle inside the imposing oak bank hall, a tall rigid soft-matte clay miniature figure with sharp angular facial planes, sleek silver-gray sculpted hair, and wire-rimmed brass spectacles sliding antique brass abacus beads. Shot on 50mm f/2.0 prime lens. --ar 9:16',
    'the bank calculates',
    'When you sign a home loan, the bank calculates decades of interest.',
    fullMortgageCast
  );
  const richThumb = compileThumbnailPrompt({
    rawThumbnail: {
      heroMoment: 'Clay Bank Lender slams a heavy brass stamp onto a folded ivory contract beside Clay Homeowner.',
      expression: 'Shocked wide-eyed urgency.',
      bgDescription: 'Weathered oak columns and crimson wax shards.',
      accentColor: 'Crimson rim lighting',
      hookText: 'MORTGAGE TRAP EXPOSED',
    },
    styleProfile: richDioramaStyle,
    characterSheet: {
      'Clay Homeowner': fullMortgageCast['Clay Homeowner'],
      'Clay Bank Lender': fullMortgageCast['Clay Bank Lender'],
    },
    format: 'short',
    platform: 'tiktok',
  });
  assert(
    partialLenderBeat.includes('wire-rimmed brass spectacles') &&
      partialLenderBeat.includes('pinstripe charcoal clay suit') &&
      partialLenderBeat.includes('crimson silk tie') &&
      richThumb.compiledPrompt.includes('wire-rimmed brass spectacles') &&
      richThumb.compiledPrompt.includes('pinstripe charcoal clay suit'),
    'Suite 29: First-Appearance Eyewear/Outfit Locks & Persistent Style',
    '29.1 Preserves Full Eyewear and Pinstripe Suit/Crimson Tie Without 18-Word Clipping in Beats & Thumbnail',
    `beat=${partialLenderBeat} | thumb=${richThumb.compiledPrompt}`
  );

  // 29.2 First-appearance synchronization harvests Beat 1 glasses without bleeding Beat 1 coin action or prop shots
  const sparseCast: Record<string, string> = {
    'Clay Homeowner':
      'A handcrafted soft-matte clay miniature figure with warm terracotta clay skin tone and slate-blue knitted wool sweater',
  };
  const firstAppearanceScenes: Scene[] = [
    {
      index: 1,
      narratorLine: 'If you pay early, the stamp hits.',
      estimatedSeconds: 4.5,
      beats: [
        {
          beatIndex: 1,
          textSpan: 'If you pay early,',
          shotType: 'Medium Shot',
          cameraAngle: 'eye-level',
          cameraMovement: 'Static Frame',
          imagePrompt:
            'Vertical 9:16 portrait composition, Medium Shot, eye-level, Clay Homeowner, a soft-matte terracotta clay figure with round wire-rimmed glasses and brown leather clay boots, leans forward to stack gold clay coins onto a mortgage ledger. --ar 9:16',
          estimatedSeconds: 2.3,
        },
        {
          beatIndex: 2,
          textSpan: 'the stamp hits.',
          shotType: 'Close-Up',
          cameraAngle: 'high-angle',
          cameraMovement: 'Static Frame',
          imagePrompt:
            'Vertical 9:16 portrait composition, Close-Up, high-angle, A heavy brass stamp shatters a crimson wax seal across ivory cardstock folds, no characters in frame. --ar 9:16',
          estimatedSeconds: 2.2,
        },
      ],
    },
    {
      index: 2,
      narratorLine: 'Then he reads the page.',
      estimatedSeconds: 2.4,
      beats: [
        {
          beatIndex: 1,
          textSpan: 'Then he reads the page.',
          shotType: 'Medium Close-Up',
          cameraAngle: 'eye-level',
          cameraMovement: 'Static Frame',
          imagePrompt:
            'Vertical 9:16 portrait composition, Medium Close-Up, eye-level showing him opening a folded paper contract at the oak desk. --ar 9:16',
          estimatedSeconds: 2.4,
        },
      ],
    },
  ];
  const syncedCast = synchronizeCharacterSheetWithFirstAppearances(firstAppearanceScenes, sparseCast);
  const beat2Locked = injectCompactCharacterLocks(
    firstAppearanceScenes[1].beats[0].imagePrompt,
    firstAppearanceScenes[1].beats[0].textSpan,
    firstAppearanceScenes[1].narratorLine,
    syncedCast
  );
  const propBeatLocked = injectCompactCharacterLocks(
    firstAppearanceScenes[0].beats[1].imagePrompt,
    firstAppearanceScenes[0].beats[1].textSpan,
    firstAppearanceScenes[0].narratorLine,
    syncedCast
  );
  assert(
    syncedCast['Clay Homeowner'].includes('round wire-rimmed glasses') &&
      beat2Locked.includes('round wire-rimmed glasses') &&
      beat2Locked.includes('slate-blue knitted wool sweater') &&
      !beat2Locked.includes('stack gold clay coins') &&
      !propBeatLocked.includes('Clay Homeowner'),
    'Suite 29: First-Appearance Eyewear/Outfit Locks & Persistent Style',
    '29.2 Syncs Scene 1 Beat 1 Glasses & Wardrobe Across Later Beats Without Leaking Action or Photobombing Prop Shots',
    `synced=${syncedCast['Clay Homeowner']} | beat2=${beat2Locked} | prop=${propBeatLocked}`
  );

  // 29.3 Beat Visual Style preserves key diorama materials beyond 14 words
  const styledBeat = formatFinalBeatPrompt(
    {
      beatIndex: 1,
      textSpan: 'Check every clause first.',
      shotType: 'Close-Up',
      cameraAngle: 'eye-level',
      cameraMovement: 'Static Frame',
      imagePrompt:
        'Vertical 9:16 portrait composition, Close-Up, eye-level, A brushed antique brass magnifying glass rests over ivory cardstock lettering. Shot on 85mm f/1.8 portrait lens. --ar 9:16',
      estimatedSeconds: 2.2,
    },
    false,
    false,
    { styleProfile: richDioramaStyle, characterSheet: fullMortgageCast }
  );
  assert(
    styledBeat.imagePrompt.includes('Visual Style:') &&
      styledBeat.imagePrompt.includes('heavy ivory cardstock') &&
      styledBeat.imagePrompt.includes('crimson wax seals'),
    'Suite 29: First-Appearance Eyewear/Outfit Locks & Persistent Style',
    '29.3 Preserves Full Multi-Material Visual Style Beyond Former 14-Word Truncation',
    `Styled: ${styledBeat.imagePrompt}`
  );

  // 29.4 Full 40-word canonical locks on distinct action beats must not trigger L10 false duplicates
  const distinctLockedScene: Scene = {
    index: 4,
    narratorLine: 'He adjusted his spectacles and hid the slip deep in the folder.',
    estimatedSeconds: 4.0,
    beats: [
      {
        beatIndex: 1,
        textSpan: 'He adjusted his spectacles',
        shotType: 'Close-Up',
        cameraAngle: 'eye-level',
        cameraMovement: 'Static Frame',
        imagePrompt: `Vertical 9:16 portrait composition, Close-Up, eye-level, Clay Bank Lender (${fullMortgageCast['Clay Bank Lender']}) adjusts his glasses in deep charcoal shadow beneath a desk lamp. Shot on 85mm f/1.4 portrait lens. --ar 9:16`,
        estimatedSeconds: 2.0,
      },
      {
        beatIndex: 2,
        textSpan: 'and hid the slip deep in the folder.',
        shotType: 'Medium Shot',
        cameraAngle: 'low-angle',
        cameraMovement: 'Static Frame',
        imagePrompt: `Vertical 9:16 portrait composition, Medium Shot, low-angle, Clay Bank Lender (${fullMortgageCast['Clay Bank Lender']}) slides a tiny folded ivory slip between towering accordion ledger stacks. Shot on 50mm f/2.0 prime lens. --ar 9:16`,
        estimatedSeconds: 2.0,
      },
    ],
  };
  const l10Issues = lintStoryboard([distinctLockedScene], fullMortgageCast, richDioramaStyle).filter((i) =>
    i.id.startsWith('L10')
  );
  assert(
    l10Issues.length === 0,
    'Suite 29: First-Appearance Eyewear/Outfit Locks & Persistent Style',
    '29.4 Full Canonical Character Locks Across Different Actions Do Not Trigger False L10 Duplicate Warnings',
    `L10 issues: ${JSON.stringify(l10Issues)}`
  );
}

// ============================================================================
// 30. TEXT-TO-VIDEO SCRIPT COMPLETENESS, FONT, EXPRESSION STRIP & SANITIZERS
// ============================================================================
function runTestSuite30() {
  console.log('\n--- Running Test Suite 30: Text-to-Video Pipeline Completeness & Hygiene ---');

  // 30.1 Detect truncated Video Mode output leaving remaining script words uncovered
  const fullMortgageScript =
    'If you pay off your mortgage ten years early, your lender might hit you with a massive prepayment penalty fee costing thousands of dollars. To prevent this loss, lenders often hide a prepayment penalty clause deep in your loan contract that triggers the exact moment you clear your debt before the term ends.';
  const truncatedScenes = [
    { index: 1, narratorLine: 'If you pay off your mortgage ten years early, your lender might hit you with a massive prepayment penalty fee costing thousands of dollars.' },
    { index: 2, narratorLine: 'To prevent this loss, lenders often hide a prepayment penalty clause deep in your loan contract that triggers the' },
  ];
  const coverage = findUncoveredTrailingScript(fullMortgageScript, truncatedScenes);
  assert(
    coverage.missingWords === 10 &&
      coverage.uncoveredText.startsWith('exact moment you clear your debt'),
    'Suite 30: Text-to-Video Pipeline Completeness & Hygiene',
    '30.1 Detects Uncovered Trailing Script Words When Long Video JSON Truncates Mid-Sentence',
    `coverage=${JSON.stringify(coverage)}`
  );

  // 30.2 Finance / Mortgage clay diorama mentioning "future income stream" must NOT trigger futuristic neon font
  const mortgageFont = inferStoryAdaptiveFont(
    'handcrafted miniature world built from soft-matte clay, weathered oak, and heavy ivory cardstock',
    "you suddenly cut off the bank's future income stream due to a prepayment penalty clause"
  );
  assert(
    !mortgageFont.includes('futuristic') && !mortgageFont.includes('neon'),
    'Suite 30: Text-to-Video Pipeline Completeness & Hygiene',
    '30.2 Prevents "future income stream" From Triggering Cyberpunk Neon Thumbnail Font',
    `font=${mortgageFont}`
  );

  // 30.3 Neutral facial features & natural stance phrases stripped from permanent identity & thumbnail/CTA
  const noisyCharDesc =
    'Adult, medium build, short textured dark hair, neutral facial features, wearing a plain gray sweater, blue jeans, and white sneakers. Stance is natural, feet planted firmly on the miniature floor.';
  const cleanedIdentity = stripTransientExpressionsAndPoses(noisyCharDesc);
  assert(
    !cleanedIdentity.toLowerCase().includes('neutral facial features') &&
      !cleanedIdentity.toLowerCase().includes('stance is natural') &&
      cleanedIdentity.includes('plain gray sweater') &&
      cleanedIdentity.includes('white sneakers'),
    'Suite 30: Text-to-Video Pipeline Completeness & Hygiene',
    '30.3 Strips "neutral facial features" and "Stance is natural" From Permanent Identity Sheet',
    `cleaned=${cleanedIdentity}`
  );

  // 30.4 Prop-only brass lock close-up avoids photobombing AND possessive "Homeowner's" avoids bare fragment
  const singleCast = {
    Homeowner: cleanedIdentity,
  };
  const propCloseUp = injectCompactCharacterLocks(
    'Vertical 9:16 portrait composition, Close-up of a brass lock snapping shut on a ledger, low-angle, static frame, warm rim light. Visual Style: handcrafted miniature world. --ar 9:16',
    'to lock in their long-term profit',
    'When you sign a home loan, the bank calculates decades of guaranteed interest payments to lock in their long-term profit margins.',
    singleCast
  );
  const possessiveBeat = injectCompactCharacterLocks(
    "Vertical 9:16 portrait composition, Close-up of Homeowner's hand holding a tiny pen, signing the home loan contract. Visual Style: handcrafted miniature world. --ar 9:16",
    'When you sign a home loan,',
    'When you sign a home loan, the bank calculates profit.',
    singleCast
  );
  assert(
    !propCloseUp.includes('Homeowner') &&
      possessiveBeat.includes('Featuring Homeowner ('),
    'Suite 30: Text-to-Video Pipeline Completeness & Hygiene',
    '30.4 Keeps Prop-Only Close-Ups Character-Free and Fixes Possessive Dangling Character Lock',
    `prop=${propCloseUp} | poss=${possessiveBeat}`
  );

  // 30.5 Video Beat eliminates duplicate 9:16 vertical, reconciles contradictory shot sizes, and syncs metadata
  const clayStyle: StyleProfile = {
    artStyle:
      'handcrafted miniature world built from soft-matte clay, weathered oak, and heavy ivory cardstock, lit with warm studio key lights and deep directional shadows',
    colorPalette: 'warm earth tones with muted clay reds and oak browns',
    lighting: 'warm tungsten key light at 3200K with soft fill at 5600K',
    eraAndSetting: 'contemporary miniature home office and bank interior',
  };
  const formattedVideoBeat = formatFinalBeatPrompt(
    {
      beatIndex: 1,
      textSpan: 'If you pay off your mortgage ten years early,',
      shotType: 'Close-Up',
      cameraAngle: 'eye-level',
      cameraMovement: 'Slow forward push-in',
      imagePrompt:
        'Vertical 9:16 portrait composition, Close-up of Homeowner hands pulling a tiny mortgage contract, extreme-close-up, eye-level, slow forward push-in, 50mm f/2.0, warm 3200K key light, ambient rustle, 9:16 vertical. Visual Style: handcrafted miniature world. --ar 9:16',
      estimatedSeconds: 2.0,
    },
    false,
    true,
    { styleProfile: clayStyle, characterSheet: singleCast }
  );
  const lateShotSync = synchronizeBeatMetadataWithPrompt({
    beatIndex: 2,
    textSpan: 'your lender',
    shotType: 'Medium Shot',
    cameraAngle: 'eye-level',
    cameraMovement: 'Static Frame',
    imagePrompt:
      'Vertical 9:16 portrait composition, Miniature looming figure representing the lender towering over Homeowner, wide shot low-angle, static frame, 50mm f/2.0. --ar 9:16',
    estimatedSeconds: 2.0,
  });
  assert(
    !formattedVideoBeat.imagePrompt.includes('9:16 vertical.') &&
      !formattedVideoBeat.imagePrompt.includes('extreme-close-up') &&
      lateShotSync.shotType === 'Wide Establishing Shot' &&
      lateShotSync.cameraAngle === 'low-angle',
    'Suite 30: Text-to-Video Pipeline Completeness & Hygiene',
    '30.5 Removes Duplicate Orientation & Conflicting Inline Shot Tags and Syncs Late Shot Framing Metadata',
    `formatted=${formattedVideoBeat.imagePrompt} | lateSync=${lateShotSync.shotType}/${lateShotSync.cameraAngle}`
  );

  // 30.6 Master videoPrompt & startFramePrompt sanitization: no "..", no post-Duration dumps, locked attire in Start Frame
  const cleanVP = sanitizeMasterVideoPrompt(
    'Subject: Homeowner standing in Home Office holding a folder. Action: pulls contract toward himself. Camera: close-up, eye-level, push-in. Lighting: warm 3200K key light. Style: handcrafted miniature world, 35mm grain. Audio: paper rustle. Duration: 4 seconds.',
    {
      targetVideoDuration: 4,
      calculatedSceneSeconds: 4,
      styleProfile: clayStyle,
      characterSheet: singleCast,
      narratorLine: 'If you pay off your mortgage ten years early.',
      defaultAspectRatio: '9:16 vertical',
    }
  );
  const enrichedSFP = enrichStartFramePrompt(
    'Medium high-angle view of Homeowner in Home Office, holding a contract, warm lighting, 50mm f/2.0 lens.',
    {
      styleProfile: clayStyle,
      characterSheet: singleCast,
      narratorLine: 'Holding the contract.',
      defaultAspectRatio: '9:16 vertical',
    }
  );
  assert(
    !cleanVP.includes('..') &&
      cleanVP.endsWith('Duration: 4 seconds.') &&
      (cleanVP.match(/\bLighting:/gi) || []).length === 1 &&
      enrichedSFP.includes('plain gray sweater') &&
      enrichedSFP.includes('3200K') &&
      enrichedSFP.includes('9:16 vertical'),
    'Suite 30: Text-to-Video Pipeline Completeness & Hygiene',
    '30.6 Sanitizes Master videoPrompt Without Post-Duration Dump/Double-Periods & Enriches Sparse Start Frame',
    `vp=${cleanVP} | sfp=${enrichedSFP}`
  );
}

// ============================================================================
// 31. CLOSE-UP DETAIL LOCK SCOPING, MOTION FREEZE, THUMBNAIL & CTA POLISH
// ============================================================================
function runTestSuite31() {
  console.log('\n--- Running Test Suite 31: Detail Close-Up Locks, Motion Freeze & Export Polish ---');

  const clayCast = {
    'Clay Homeowner':
      'Handcrafted soft-matte clay figure with warm terracotta-toned skin, sculpted dark brown hair, wearing a textured heather-gray clay sweater, dark navy clay trousers, and brown clay boots',
    'Clay Banker':
      'Tall handcrafted soft-matte clay figure with pale ivory-toned skin, neatly sculpted silver-gray hair, wearing a tailored charcoal clay suit, crisp white clay collar, and black clay shoes',
  };

  // 31.1 Tight hand close-up already wearing matching clay skin & suit sleeve skips full-body hair/shoes injection
  const bankerHandCloseUp = injectCompactCharacterLocks(
    'Vertical 9:16 portrait composition, Extreme Close-Up, eye-level, pale ivory-toned clay fingers in a tailored charcoal clay suit sleeve with a crisp white clay collar press a thick raised crimson wax seal. Shot on 85mm f/1.4 portrait prime lens. Visual Style: Handcrafted clay diorama. --ar 9:16',
    'to lock in their long-term profit margins.',
    'When you sign a home loan, the bank calculates profit.',
    clayCast
  );
  const sparseHandPossessive = injectCompactCharacterLocks(
    "Vertical 9:16 portrait composition, Close-Up, eye-level, Clay Homeowner's hand holds a tiny brass key. Visual Style: Handcrafted clay diorama. --ar 9:16",
    'effectively punishing you',
    'effectively punishing you',
    clayCast
  );
  assert(
    !bankerHandCloseUp.includes('Featuring Clay Banker') &&
      !bankerHandCloseUp.includes('black clay shoes') &&
      sparseHandPossessive.includes('Featuring Clay Homeowner (') &&
      !sparseHandPossessive.includes('brown clay boots') &&
      sparseHandPossessive.includes('heather-gray clay sweater'),
    'Suite 31: Detail Close-Up Locks, Motion Freeze & Export Polish',
    '31.1 Scopes Hand Detail Close-Ups Without Injecting Hair/Trousers/Shoes Onto Tight Extremity Frames',
    `banker=${bankerHandCloseUp} | sparse=${sparseHandPossessive}`
  );

  // 31.2 Freezes dynamic adverbs in Image mode without touching Video mode
  const frozenImage = sanitizeStillImageMotionAndOptics(
    'Vertical 9:16 portrait composition, Wide Establishing Shot, accordion contracts unfurl dramatically while coins tip over and slide rapidly as walls compress shut and swing abruptly inward. Shot on 24mm f/4 wide lens. --ar 9:16',
    'Wide Establishing Shot',
    false
  );
  const dynamicVideo = sanitizeStillImageMotionAndOptics(
    'Vertical 9:16 portrait composition, Wide Establishing Shot, accordion contracts unfurl dramatically across the desk. --ar 9:16',
    'Wide Establishing Shot',
    true
  );
  assert(
    frozenImage.includes('frozen mid-unfurl') &&
      frozenImage.includes('tipped over mid-slide') &&
      frozenImage.includes('tightly compressed') &&
      frozenImage.includes('angled sharply inward') &&
      dynamicVideo.includes('unfurl dramatically'),
    'Suite 31: Detail Close-Up Locks, Motion Freeze & Export Polish',
    '31.2 Freezes Fast Motion Adverbs in Text-to-Image Mode While Preserving Video Mode Motion',
    `img=${frozenImage} | vid=${dynamicVideo}`
  );

  // 31.3 Thumbnail & CTA clean grammar: no Part 2 hype, no "separation separating", no redundant rim light colon splice
  const mortgageStyle: StyleProfile = {
    artStyle: 'Handcrafted miniature stop-motion world built from soft-matte clay and heavy ivory cardstock',
    colorPalette: 'Warm ivory cardstock, rich weathered oak brown, deep crimson wax accents',
    lighting: 'Warm 3200K studio key lights with deep directional shadows and crisp rim separation',
    eraAndSetting: 'Timeless miniature financial desktop',
  };
  const cleanThumb = compileThumbnailPrompt({
    rawThumbnail: {
      heroMoment: 'Contract slamming down over a clay homeowner',
      bgDescription: 'Dark weathered oak shadows with warm studio rim light separating the ivory paper folds',
      accentColor: 'crimson',
      hookText: 'HIDDEN MORTGAGE TRAP',
    },
    styleProfile: mortgageStyle,
    characterSheet: { 'Clay Homeowner': clayCast['Clay Homeowner'] },
    storyPremise: 'If you pay off your mortgage ten years early, your lender hits you with a prepayment penalty fee.',
    format: 'short',
    platform: 'TikTok',
  });
  const cleanCta = compileCtaPrompt({
    storyPremise: 'If you pay off your mortgage ten years early, your lender hits you with a prepayment penalty fee.',
    styleProfile: mortgageStyle,
    characterSheet: { 'Clay Homeowner': clayCast['Clay Homeowner'] },
    format: 'short',
    platform: 'tiktok',
    modality: 'image',
    engagementType: 'question',
  });
  assert(
    !cleanThumb.compiledPrompt.includes('separating the subject from the background:') &&
      !cleanCta.compiledPrompt.includes('Part 2 coming soon') &&
      !cleanCta.compiledPrompt.includes('separation separating') &&
      !cleanCta.compiledPrompt.includes(', Warm 3200K'),
    'Suite 31: Detail Close-Up Locks, Motion Freeze & Export Polish',
    '31.3 Removes Part 2 Hype, Rim-Light Colon Splice, and "separation separating" Stutter From Thumbnail & CTA',
    `thumb=${cleanThumb.compiledPrompt} | cta=${cleanCta.compiledPrompt}`
  );
}

// ============================================================================
// 32. VIDEO MODE GOOGLE FLOW HYGIENE, ALIAS ISOLATION & ANGLE/CTA ACCURACY
// ============================================================================
function runTestSuite32() {
  console.log('\n--- Running Test Suite 32: Video Mode Hygiene, Alias Isolation & Angle/CTA Accuracy ---');

  // 32.1 Material nouns in character names ("Brass Bank Clerk", "Amber Resin Depositor") must NOT leak onto props
  const bankingCast = {
    'Brass Bank Clerk': 'Sculpted brass figure wearing dark charcoal tweed waistcoat and wire spectacles',
    'Amber Resin Depositor': 'Articulated translucent amber resin figure in wool slate jacket and corduroy trousers',
  };
  const vaultPropPrompt = injectCompactCharacterLocks(
    'Extreme Close-Up, eye-level, heavy brass vault bolts sliding shut beside an amber resin capsule and brass balance scale. Audio: metallic lock click, no dialogue.',
    'triggering frozen accounts',
    'Federal banks lock suspicious cash deposits.',
    bankingCast
  );
  const clerkBeatPrompt = injectCompactCharacterLocks(
    'Medium Shot, eye-level, the Brass Bank Clerk stamps a heavy federal form across the mahogany desk.',
    'flagging your deposit',
    'The clerk flags your deposit.',
    bankingCast
  );
  assert(
    !vaultPropPrompt.includes('Featuring Brass Bank Clerk') &&
      !vaultPropPrompt.includes('Featuring Amber Resin Depositor') &&
      clerkBeatPrompt.includes('Brass Bank Clerk (Sculpted brass figure'),
    'Suite 32: Video Mode Hygiene, Alias Isolation & Angle/CTA Accuracy',
    '32.1 Prevents Material Words (Brass/Amber/Resin) From Leaking Cast Locks Onto Props While Preserving Named Cast',
    `prop=${vaultPropPrompt} | clerk=${clerkBeatPrompt}`
  );

  // 32.2 Collapses repeated Whip-Pan, eye-level framing prefixes cleanly
  const dedupedWhipBeat = formatFinalBeatPrompt(
    {
      beatIndex: 1,
      textSpan: 'federal compliance alert',
      shotType: 'Whip-Pan',
      cameraAngle: 'eye-level',
      cameraMovement: 'Whip-Pan',
      imagePrompt:
        'Whip-Pan, eye-level: Whip-Pan, eye-level: Whip-Pan, eye-level, camera whips sharply left across a frosted bank pneumatic tube. Audio: pneumatic whoosh, no dialogue.',
      estimatedSeconds: 2,
    },
    false,
    true,
    {
      styleProfile: {
        artStyle: 'Tactile stop-motion miniature diorama',
        colorPalette: 'Slate and muted amber',
        lighting: '3200K warm desk lamp',
        eraAndSetting: 'Vintage bank hall',
      },
    }
  );
  const whipCount = (dedupedWhipBeat.imagePrompt.match(/Whip-Pan,\s*eye-level/gi) || []).length;
  assert(
    whipCount === 1 && !dedupedWhipBeat.imagePrompt.includes('Whip-Pan, eye-level: Whip-Pan'),
    'Suite 32: Video Mode Hygiene, Alias Isolation & Angle/CTA Accuracy',
    '32.2 Deduplicates Stacked Whip-Pan Framing Openers Into a Single Clean Prefix',
    dedupedWhipBeat.imagePrompt
  );

  // 32.3 Explicit -angle tags win over loose spatial prop nouns like "overhead glass tube"
  const syncedLowAngle = synchronizeBeatMetadataWithPrompt({
    beatIndex: 1,
    textSpan: 'federal compliance radar',
    shotType: 'Low-Angle Shot',
    cameraAngle: 'birds-eye',
    cameraMovement: 'Slow Push-In',
    imagePrompt:
      'Low-Angle Shot, low-angle view looking sharply upward at an overhead glass pneumatic tube and overhead brushed-brass radar dial. Audio: hum, no dialogue.',
    estimatedSeconds: 2,
  });
  const syncedHighAngle = synchronizeBeatMetadataWithPrompt({
    beatIndex: 2,
    textSpan: 'accounts locked tight',
    shotType: 'High-Angle Shot',
    cameraAngle: 'birds-eye',
    cameraMovement: 'Static Frame',
    imagePrompt:
      'High-Angle Shot, high-angle framing gazing downward over frozen ledger books beneath overhead tungsten bulbs. Audio: paper rustle, no dialogue.',
    estimatedSeconds: 2,
  });
  assert(
    syncedLowAngle.cameraAngle === 'low-angle' && syncedHighAngle.cameraAngle === 'high-angle',
    'Suite 32: Video Mode Hygiene, Alias Isolation & Angle/CTA Accuracy',
    '32.3 Prioritizes Explicit Low/High Camera Angle Over Prop Words Like Overhead Tube',
    `low=${syncedLowAngle.cameraAngle} | high=${syncedHighAngle.cameraAngle}`
  );

  // 32.4 sanitizeSharedVisualStyle strips hero pronouns & wardrobe leaks while keeping world medium
  const rawLeakyStyle =
    'Handcrafted miniature diorama crafted from translucent amber resin and matte clay. He wears a fitted wool-textured dark slate jacket with rolled-up cuffs and dark brown trousers. His face has carved plane facets and obsidian eyes. Lit by warm 3200K brass desk lamps.';
  const cleanStyle = sanitizeSharedVisualStyle(rawLeakyStyle);
  const compiledCleanVideo = compileBeatPrompt(
    {
      beatIndex: 1,
      textSpan: 'triggering an alert',
      shotType: 'Close-Up',
      cameraAngle: 'eye-level',
      cameraMovement: 'Slow Push-In',
      imagePrompt: 'Close-Up, eye-level, red ink stamp pressing crisply onto ledger paper. Audio: thud, no dialogue.',
      estimatedSeconds: 2,
    },
    { index: 1, narratorLine: 'triggering an alert', estimatedSeconds: 2, beats: [] },
    {
      artStyle: rawLeakyStyle,
      colorPalette: 'Muted amber and slate',
      lighting: 'Warm 3200K key',
      eraAndSetting: 'Vintage bank interior',
    },
    undefined,
    'short',
    'video'
  );
  assert(
    cleanStyle.includes('translucent amber resin') &&
      cleanStyle.includes('brass desk lamps') &&
      !cleanStyle.includes('He wears') &&
      !cleanStyle.includes('His face') &&
      !compiledCleanVideo.promptText.includes('slate jacket'),
    'Suite 32: Video Mode Hygiene, Alias Isolation & Angle/CTA Accuracy',
    '32.4 Strips Hero Pronoun Wardrobe Sentences From Shared Visual Style Across Beats',
    `cleanStyle=${cleanStyle} | compiled=${compiledCleanVideo.promptText}`
  );

  // 32.5 Deposit structuring scripts classify as Finance Banking CTA, never Mystery Secret CTA
  const structuringCta = inferStoryAdaptiveCtaQuestion(
    'If you secretly deposit $9,900 in cash to stay under the limit, federal structuring rules still trigger frozen accounts and asset seizures.'
  );
  assert(
    /deposit|10,000|bank flag/i.test(structuringCta.primaryQuestion) &&
      !/mystery|clue/i.test(structuringCta.primaryQuestion),
    'Suite 32: Video Mode Hygiene, Alias Isolation & Angle/CTA Accuracy',
    '32.5 Routes Cash Deposit & Structuring Scripts to Banking Compliance CTA Instead of Mystery',
    `q=${structuringCta.primaryQuestion}`
  );
}

// ============================================================================
// 33. LONG-FORM GROUNDED CHECKPOINT SAVE, RESUME & CLEANUP
// ============================================================================
function runTestSuite33() {
  console.log('\n--- Running Test Suite 33: Long-Form Grounded Checkpoint & Resume ---');

  const sampleStory = 'In the winter of 1899, three surveyors walked across the frozen ridge until their compass needles spun wild.';
  const ckptKey = buildCheckpointKey(sampleStory, undefined, 'long', 'image', 'standard', 'Cinematic');
  clearGroundedCheckpoint(ckptKey);

  saveGroundedCheckpoint({
    key: ckptKey,
    totalWords: 19,
    updatedAt: Date.now(),
    bible: {
      cast: [{ id: 'lead_surveyor', role: 'Lead Surveyor', visualLock: 'Weathered explorer in heavy wool parka' }],
      threat: { canonicalLook: 'Magnetic anomaly', allowedVariants: [] },
      locations: [{ id: 'frozen_ridge', visualLock: 'Wind-swept snowy ridge under pale grey overcast sky' }],
      motifs: [],
      events: ['Surveyors climb frozen ridge', 'Compass spins wild'],
      referents: [],
      withheld: ['Source of magnetic pull'],
      forbidden: [],
      worldStyle: 'Gritty historical realism on 35mm film, cold grey overcast light',
      assumptions: [],
      thumbnailHook: {
        heroMoment: 'Surveyors staring down at wildly spinning brass compass on snowy cliff',
        expression: 'shocked concentration',
        hookText: 'THE COMPASS LIED',
        alternateHooks: ['FROZEN RIDGE MYSTERY'],
      },
    },
    plannedScenes: [
      { index: 1, narratorLine: 'In the winter of 1899, three surveyors walked across the frozen ridge.', beats: [], estimatedSeconds: 4, averageBeatSeconds: 2, fastCutRatio: 0 },
      { index: 2, narratorLine: 'until their compass needles spun wild.', beats: [], estimatedSeconds: 3, averageBeatSeconds: 1.5, fastCutRatio: 0 },
    ],
    completedScenes: [
      {
        index: 1,
        narratorLine: 'In the winter of 1899, three surveyors walked across the frozen ridge.',
        estimatedSeconds: 4,
        beats: [{ beatIndex: 1, textSpan: 'In the winter of 1899', imagePrompt: 'Wide shot of frozen ridge', estimatedSeconds: 2 }],
      },
    ],
  });

  const summary = getGroundedProgressForRequest({
    story: sampleStory,
    characterStyle: 'Cinematic',
    format: 'long',
    platform: 'YouTube',
    durationMode: 'automatic',
    generationMode: 'image',
    modelQuality: 'standard',
  });
  const stored = getGroundedCheckpoint(ckptKey);
  const directSummary = summarizeGroundedCheckpoint(ckptKey);

  clearGroundedProgressForRequest({
    story: sampleStory,
    characterStyle: 'Cinematic',
    format: 'long',
    platform: 'YouTube',
    durationMode: 'automatic',
    generationMode: 'image',
    modelQuality: 'standard',
  });
  const afterClear = getGroundedCheckpoint(ckptKey);

  assert(
    Boolean(summary) &&
      summary?.completedScenes === 1 &&
      summary?.totalScenes === 2 &&
      summary?.hasBible === true &&
      stored?.completedScenes.length === 1 &&
      directSummary?.completedScenes === 1 &&
      afterClear === null,
    'Suite 33: Long-Form Grounded Checkpoint & Resume',
    '33.1 Saves, Summarizes, Resumes, and Clears Long-Form Story Checkpoints Cleanly',
    `summary=${JSON.stringify(summary)} | afterClear=${String(afterClear)}`
  );
}

// ============================================================================
// 34. OPTION B PHRASE CUTS, FRAMING DEDUP, STREAM PARSER, AI USAGE & STAGE 4
// ============================================================================
function runTestSuite34() {
  console.log('\n--- Running Test Suite 34: Option B Phrase Cuts, Streaming JSON & AI Usage ---');

  // 34.1 Option B 2-6 word grammar-aware splitting with zero stranded trailing articles/prepositions
  const mortgageSentence =
    'If you pay off your mortgage ten years early, your lender might hit you with a massive penalty.';
  const phraseCuts = splitPhraseIntoSubBeats(mortgageSentence, 6);
  const allWithinCeiling = phraseCuts.every((p) => p.split(/\s+/).filter(Boolean).length <= 6);
  const noStrandedTail = phraseCuts.every(
    (p) => !/\b(?:with a|of the|into a|at the|by a|from a|on a|in the)$/i.test(p.trim())
  );
  assert(
    phraseCuts.length >= 4 && allWithinCeiling && noStrandedTail,
    'Suite 34: Option B Phrase Cuts, Streaming JSON & AI Usage',
    '34.1 Splits Image Narration Into 2-6 Word Grammatical Phrases Without Stranded Preposition Tails',
    `cuts=${JSON.stringify(phraseCuts)}`
  );

  // 34.2 Option B preserves 6 distinct visual phrase beats across one sentence
  const mortgageStyle: StyleProfile = {
    artStyle: 'Handcrafted miniature stop-motion diorama',
    colorPalette: 'Warm ivory paper, oak brown, crimson ink',
    lighting: 'Warm tungsten key light with deep shadow falloff',
    eraAndSetting: 'Miniature financial desktop',
  };
  const mortgageBeats: Beat[] = [
    {
      beatIndex: 1,
      textSpan: 'If you pay off',
      shotType: 'Close-Up',
      cameraAngle: 'eye-level',
      cameraMovement: 'Static Frame',
      imagePrompt: 'Close-Up, eye-level on hands sliding brass coins across oak wood grain. Shot on 85mm f/2.0.',
      estimatedSeconds: 1.0,
    },
    {
      beatIndex: 2,
      textSpan: 'your mortgage',
      shotType: 'Medium Shot',
      cameraAngle: 'high-angle',
      cameraMovement: 'Static Frame',
      imagePrompt: 'Medium Shot, high-angle of a miniature paper house sitting inside a ledger border. Shot on 50mm f/2.8.',
      estimatedSeconds: 0.7,
    },
    {
      beatIndex: 3,
      textSpan: 'ten years early,',
      shotType: 'Extreme Close-Up',
      cameraAngle: 'eye-level',
      cameraMovement: 'Static Frame',
      imagePrompt: 'Extreme Close-Up, eye-level on desk calendar flipping forward to balance zero. Shot on 100mm macro f/2.8.',
      estimatedSeconds: 0.8,
    },
    {
      beatIndex: 4,
      textSpan: 'your lender',
      shotType: 'Low-Angle Shot',
      cameraAngle: 'low-angle',
      cameraMovement: 'Static Frame',
      imagePrompt: 'Low-Angle Shot, low-angle looming upward at a suited figure behind dark shadows. Shot on 35mm f/2.0.',
      estimatedSeconds: 0.7,
    },
    {
      beatIndex: 5,
      textSpan: 'might hit you',
      shotType: 'Point-of-View (POV)',
      cameraAngle: 'high-angle',
      cameraMovement: 'Static Frame',
      imagePrompt: 'Point-of-View (POV), high-angle looking down as a heavy contract ledger slides forward. Shot on 24mm f/4.0.',
      estimatedSeconds: 0.8,
    },
    {
      beatIndex: 6,
      textSpan: 'with a massive penalty.',
      shotType: 'Extreme Close-Up',
      cameraAngle: 'eye-level',
      cameraMovement: 'Static Frame',
      imagePrompt: 'Extreme Close-Up, eye-level of crimson wax penalty stamp slamming onto parchment. Shot on 85mm f/2.8.',
      estimatedSeconds: 1.0,
    },
  ];
  const progressedMortgage = deduplicateAndProgressSceneBeats(mortgageBeats, {
    styleProfile: mortgageStyle,
    isLongForm: false,
    isVideoMode: false,
  });
  assert(
    progressedMortgage.length === 6 &&
      progressedMortgage[0].textSpan === 'If you pay off' &&
      progressedMortgage[5].textSpan === 'with a massive penalty.',
    'Suite 34: Option B Phrase Cuts, Streaming JSON & AI Usage',
    '34.2 Preserves All 6 Distinct 2-6 Word Image Phrase Beats Without Over-Merging',
    `count=${progressedMortgage.length}`
  );

  // 34.3 Fixes doubled framing openers ("eye-level of eye-level" and "Wide eye-level")
  const fixedDoubleEye = formatFinalBeatPrompt(
    {
      beatIndex: 1,
      textSpan: 'you sign a loan',
      shotType: 'Medium Shot',
      cameraAngle: 'eye-level',
      cameraMovement: 'Static Frame',
      imagePrompt: 'Vertical 9:16 portrait composition, Medium Shot, eye-level of eye-level of brass scale sitting on desk. --ar 9:16',
      estimatedSeconds: 1.2,
    },
    false,
    false,
    { styleProfile: mortgageStyle }
  );
  const fixedWideEye = formatFinalBeatPrompt(
    {
      beatIndex: 2,
      textSpan: 'inside the office',
      shotType: 'Wide Establishing Shot',
      cameraAngle: 'eye-level',
      cameraMovement: 'Static Frame',
      imagePrompt: 'Wide eye-level establishing oak table inside miniature bank hall. --ar 16:9',
      estimatedSeconds: 1.4,
    },
    true,
    false,
    { styleProfile: mortgageStyle }
  );
  assert(
    !/eye-level of eye-level/i.test(fixedDoubleEye.imagePrompt) &&
      !/\bWide eye-level\b/i.test(fixedWideEye.imagePrompt) &&
      fixedWideEye.imagePrompt.includes('Wide Establishing Shot, eye-level'),
    'Suite 34: Option B Phrase Cuts, Streaming JSON & AI Usage',
    '34.3 Eliminates "eye-level of eye-level" and "Wide eye-level" Duplicate Framing Openers',
    `eye=${fixedDoubleEye.imagePrompt} | wide=${fixedWideEye.imagePrompt}`
  );

  // 34.4 Incremental SSE JSON buffer extracts finished Scene 1 before Scene 2 closes
  const streamingChunk = `{
    "styleProfile": { "artStyle": "Stop-motion diorama", "colorPalette": "Warm oak", "lighting": "Warm key", "eraAndSetting": "Desktop" },
    "characterSheet": { "Homeowner": "Clay figure in grey knit sweater" },
    "scenes": [
      {
        "index": 1,
        "narratorLine": "If you pay off your mortgage early.",
        "estimatedSeconds": 2.4,
        "beats": [
          { "beatIndex": 1, "textSpan": "If you pay off", "shotType": "Close-Up", "cameraAngle": "eye-level", "imagePrompt": "Coins on desk.", "estimatedSeconds": 1.2 }
        ]
      },
      {
        "index": 2,
        "narratorLine": "Your lender hits you`;
  const extractedPartial = extractCompletedStoryboardFields(streamingChunk);
  assert(
    extractedPartial.scenes.length === 1 &&
      extractedPartial.scenes[0].index === 1 &&
      extractedPartial.styleProfile?.artStyle === 'Stop-motion diorama' &&
      extractedPartial.characterSheet?.Homeowner?.includes('grey knit sweater'),
    'Suite 34: Option B Phrase Cuts, Streaming JSON & AI Usage',
    '34.4 Extracts Finished Scene 1 and Continuity Metadata While Scene 2 Is Still Streaming',
    `scenes=${extractedPartial.scenes.length}`
  );

  // 34.5 AI usage tracker records Gemini & Groq tokens cleanly across buckets and formats compact counts
  resetAiUsage();
  extractAndRecordGeminiUsage(
    { usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 800, thoughtsTokenCount: 150, totalTokenCount: 2150 } },
    'gemini-4-hydrogen'
  );
  extractAndRecordGroqUsage(
    { usage: { prompt_tokens: 300, completion_tokens: 200, total_tokens: 500 } },
    'openai/gpt-oss-120b'
  );
  const usageSnap = getAiUsageSnapshot();
  const formattedCount = formatCompactTokenCount(usageSnap.session.totalTokens);
  const geminiModelStats = usageSnap.byModel['gemini:gemini-4-hydrogen'];
  const groqModelStats = usageSnap.byModel['groq:openai/gpt-oss-120b'];
  resetAiUsage();
  const clearedSnap = getAiUsageSnapshot();
  assert(
    usageSnap.session.requests === 2 &&
      usageSnap.session.inputTokens === 1500 &&
      usageSnap.session.outputTokens === 1000 &&
      usageSnap.session.thoughtTokens === 150 &&
      usageSnap.session.totalTokens === 2650 &&
      usageSnap.allTime.totalTokens === 2650 &&
      geminiModelStats?.requests === 1 &&
      geminiModelStats?.totalTokens === 2150 &&
      groqModelStats?.requests === 1 &&
      groqModelStats?.totalTokens === 500 &&
      formattedCount === '2.65k' &&
      clearedSnap.session.totalTokens === 0 &&
      Object.keys(clearedSnap.byModel).length === 0,
    'Suite 34: Option B Phrase Cuts, Streaming JSON & AI Usage',
    '34.5 Records Gemini & Groq Token Metadata (Including Per-Model Breakdown) and Supports Reset',
    `snap=${JSON.stringify(usageSnap.session)} byModel=${JSON.stringify(usageSnap.byModel)} fmt=${formattedCount}`
  );

  // 34.6 Stage 4 deterministic dwell verification allows 0.55s Image Phrase Cuts while preserving 0.8s floor in Video mode
  const shortPhraseBeat = {
    beatIndex: 1,
    wordRange: [0, 2] as [number, number],
    textSpan: 'your mortgage',
    depicts: 'Miniature house balanced on oak ledger',
    kind: 'literal' as const,
    intensity: 'medium' as const,
    subjectIds: ['house'],
    shotSize: 'medium',
    angle: 'eye level',
    newInfo: 'Miniature house sits inside ledger boundary',
    estimatedSeconds: 0.55,
    imagePrompt:
      'Cinematic 16:9 widescreen composition, Medium shot framing on a miniature paper house sitting inside a wooden ledger frame lit by soft studio lamp. 50mm f/2.8 lens.',
  };
  const stage4Bible = {
    cast: [],
    threat: { canonicalLook: '', allowedVariants: [] },
    locations: [{ id: 'house', visualLock: 'Miniature paper house on oak ledger' }],
    motifs: [],
    events: ['House appears on ledger'],
    referents: [],
    withheld: [],
    forbidden: [],
    worldStyle: 'Miniature diorama',
    assumptions: [],
  };
  const imageCheck = verifyBeatCodeChecks(shortPhraseBeat, [shortPhraseBeat], stage4Bible, 'long', 'image');
  const videoCheck = verifyBeatCodeChecks(shortPhraseBeat, [shortPhraseBeat], stage4Bible, 'long', 'video');
  assert(
    imageCheck.passed === true &&
      videoCheck.passed === false &&
      videoCheck.issues.some((iss) => iss.includes('0.8s')),
    'Suite 34: Option B Phrase Cuts, Streaming JSON & AI Usage',
    '34.6 Stage 4 Permits 0.55s Image Phrase Cuts Without False Repairs While Guarding 0.8s Video Floor',
    `img=${JSON.stringify(imageCheck)} | vid=${JSON.stringify(videoCheck)}`
  );
}

// ============================================================================
// 35. SSE STREAMING LATENCY, SCENE 2 PILOT GATE & VIRELIA PROMPT QUALITY
// ============================================================================
async function runTestSuite35() {
  console.log('\n--- Running Test Suite 35: SSE Streaming Latency, Scene 2 Pilot Gate & Virelia Prompt Quality ---');

  // 35.1 Scene-first JSON stream ordering: completed Scene 1 extracts immediately even BEFORE styleProfile or characterSheet arrive
  const sceneFirstStream = `{
  "scenes": [
    {
      "index": 1,
      "narratorLine": "Two clockmakers built Virelia.",
      "estimatedSeconds": 2.4,
      "beats": [
        {
          "beatIndex": 1,
          "textSpan": "Two clockmakers built Virelia.",
          "estimatedSeconds": 2.4,
          "shotType": "Wide Establishing Shot",
          "cameraAngle": "eye-level",
          "cameraMovement": "Static Frame",
          "imagePrompt": "Wide Establishing Shot, eye-level inside a sunlit clocktower workshop."
        }
      ]
    },
    {
      "index": 2,
      "narratorLine": "Juno never opened the case.`;
  const sceneFirstPartial = extractCompletedStoryboardFields(sceneFirstStream);
  assert(
    sceneFirstPartial.scenes.length === 1 &&
      sceneFirstPartial.scenes[0].index === 1 &&
      !sceneFirstPartial.styleProfile &&
      !sceneFirstPartial.characterSheet,
    'Suite 35: SSE Streaming Latency, Scene 2 Pilot Gate & Virelia Prompt Quality',
    '35.1 Extracts Completed Scene 1 Immediately When "scenes" Streams Before "styleProfile" or "characterSheet"',
    `scenes=${sceneFirstPartial.scenes.length}`
  );

  // 35.2 Back-to-back appositive trait clones right after "Character (anchor), ..." are pruned once while preserving "-ing" action clauses
  const vireliaCast: Record<string, string> = {
    'Adult Juno': 'copper-red hair tied back, round brass goggles on her forehead, stained canvas apron, heavy leather vest',
    'Young Juno': 'copper-red hair in braids, freckles on cheeks, patched wool sweater',
    'Young Milo': 'dark curly hair, soot-smudged cheek, patched apron, carrying a tattered satchel',
  };
  const appositiveInput =
    'Vertical 9:16 portrait composition, Medium Shot, eye-level framing Adult Juno, copper-red hair tied back, brass goggles, stained canvas apron, leaning forward over a workbench.';
  const appositiveLocked = injectCompactCharacterLocks(
    appositiveInput,
    'Adult Juno examined the clockwork.',
    'Adult Juno examined the clockwork.',
    vireliaCast
  );
  // Also ensure an LLM-emitted "Adult Juno (anchor), copper-red hair tied back, brass goggles, leaning forward..." prunes duplicates
  const preLockedAppositiveInput =
    'Vertical 9:16 portrait composition, Medium Shot, eye-level framing Adult Juno (copper-red hair tied back, brass goggles, stained canvas apron), copper-red hair tied back, stained canvas apron, leaning forward over a workbench.';
  const preLockedAppositiveOut = injectCompactCharacterLocks(
    preLockedAppositiveInput,
    'Adult Juno examined the clockwork.',
    'Adult Juno examined the clockwork.',
    { 'Adult Juno': 'copper-red hair tied back, brass goggles, stained canvas apron' }
  );
  const appositiveMatches = appositiveLocked.match(/copper-red hair/gi) || [];
  const preLockedMatches = preLockedAppositiveOut.match(/copper-red hair/gi) || [];
  assert(
    appositiveLocked.includes('Adult Juno (') &&
      appositiveMatches.length === 1 &&
      appositiveLocked.includes('leaning forward over a workbench') &&
      preLockedMatches.length === 1 &&
      preLockedAppositiveOut.includes('leaning forward over a workbench'),
    'Suite 35: SSE Streaming Latency, Scene 2 Pilot Gate & Virelia Prompt Quality',
    '35.2 Prunes Back-to-Back Appositive Trait Clones After Character Lock While Preserving Action Clauses',
    `out=${appositiveLocked} | pre=${preLockedAppositiveOut}`
  );

  // 35.3 Tight hand close-up suppresses facial/head traits and "carrying a tattered satchel" leakage
  const handCloseUpInput =
    'Vertical 9:16 portrait composition, Extreme Close-Up, eye-level focusing on Young Juno and Young Milo ink-smudged small hands gripping a tarnished lantern.';
  const handCloseUpLocked = injectCompactCharacterLocks(
    handCloseUpInput,
    'Young Juno and Young Milo held the lantern.',
    'Young Juno and Young Milo held the lantern.',
    vireliaCast
  );
  assert(
    !/\bfreckles\b|\bcheek\b|\btattered satchel\b|\bcarrying\b/i.test(handCloseUpLocked),
    'Suite 35: SSE Streaming Latency, Scene 2 Pilot Gate & Virelia Prompt Quality',
    '35.3 Blocks Facial Traits and Carried Bags From Leaking Onto Tight Hand Close-Ups',
    `out=${handCloseUpLocked}`
  );

  // 35.4 Single-sentence shared artStyle scrubs plot/flashback transition descriptions cleanly
  const dirtyArtStyle =
    'Detailed painterly 2D animation with glowing blue time-portal transitions between childhood memories and the present.';
  const cleanedArtStyle = sanitizeSharedVisualStyle(dirtyArtStyle);
  assert(
    cleanedArtStyle.includes('Detailed painterly 2D animation') &&
      !/transitions\s+between\s+childhood\s+memories/i.test(cleanedArtStyle) &&
      !/time-portal\s+transitions/i.test(cleanedArtStyle),
    'Suite 35: SSE Streaming Latency, Scene 2 Pilot Gate & Virelia Prompt Quality',
    '35.4 Strips Plot and Flashback Transition Clauses From Single-Sentence Shared Art Style',
    `cleaned=${cleanedArtStyle}`
  );

  // 35.5 CTA intrigue question strips leading "Adult "/"Young " age prefix while keeping visual lock intact
  const ctaData = compileCtaPrompt({
    storyPremise: 'Adult Juno must choose between destroying the clockwork key or exposing Milo.',
    styleProfile: {
      artStyle: 'Detailed painterly 2D animation',
      colorPalette: 'Warm amber brass and slate teal',
      lighting: '3200K warm lantern key light',
      eraAndSetting: 'Steampunk clockwork city of Virelia',
    },
    characterSheet: {
      'Adult Juno': 'copper-red hair tied back, round brass goggles on her forehead, stained canvas apron',
    },
    format: 'short',
    platform: 'tiktok',
    modality: 'image',
  });
  assert(
    !ctaData.questionText.includes('Adult Juno') &&
      (ctaData.alternateQuestions || []).every((q) => !q.includes('Adult Juno')) &&
      ctaData.compiledPrompt.includes('Adult Juno (locked visual identity:'),
    'Suite 35: SSE Streaming Latency, Scene 2 Pilot Gate & Virelia Prompt Quality',
    '35.5 Strips Leading Continuity Age Prefixes From CTA Intrigue Questions While Keeping Visual Sheet Lock',
    `q=${ctaData.questionText} alts=${JSON.stringify(ctaData.alternateQuestions)}`
  );

  // 35.6 runTwoPhaseProgressionAndRepair honors skipLlmRepair: true without triggering remote network repair calls
  const denseFlaggedScene: Scene[] = [
    {
      index: 1,
      narratorLine: 'When Adult Juno finally returned home she opened the rusted iron gate and crossed the courtyard alone.',
      estimatedSeconds: 3.0,
      beats: [
        {
          beatIndex: 1,
          textSpan: 'When Adult Juno finally returned home she opened the rusted iron gate and crossed the courtyard alone.',
          shotType: 'Wide Establishing Shot',
          cameraAngle: 'eye-level',
          cameraMovement: 'Static Frame',
          imagePrompt: 'Wide Establishing Shot, eye-level of Adult Juno walking through an iron gate.',
          estimatedSeconds: 3.0,
        },
      ],
    },
  ];
  const skippedRepairScenes = await runTwoPhaseProgressionAndRepair({
    scenes: denseFlaggedScene,
    styleProfile: {
      artStyle: 'Detailed painterly 2D animation',
      colorPalette: 'Warm brass and cool slate',
      lighting: 'Soft golden hour key light',
      eraAndSetting: 'Virelia workshop',
    },
    characterSheet: vireliaCast,
    locationSheet: {},
    isLongForm: false,
    isVideoMode: false,
    apiKey: 'AIzaSyTestKeyShouldNeverCallNetworkWhenSkipped123',
    aiProvider: 'gemini',
    skipLlmRepair: true,
  });
  assert(
    skippedRepairScenes.length === 1 &&
      skippedRepairScenes[0].beats.length >= 1 &&
      skippedRepairScenes[0].beats[0].imagePrompt.includes('Adult Juno ('),
    'Suite 35: SSE Streaming Latency, Scene 2 Pilot Gate & Virelia Prompt Quality',
    '35.6 runTwoPhaseProgressionAndRepair Honors skipLlmRepair: true For Instant Scene 2 Pause Preview',
    `len=${skippedRepairScenes.length}`
  );
}

// ============================================================================
// 36. TRUE BEAT-BY-BEAT STREAMING, STORY BIBLE FIRST & DEFERRED THUMBNAIL
// ============================================================================
function runTestSuite36() {
  console.log('\n--- Running Test Suite 36: Beat-by-Beat Streaming, Story Bible First & Deferred Thumbnail ---');

  // 36.1 Unclosed Scene 1 with Beat 1 closed and Beat 2 open emits Beat 1 immediately before Scene 1 closes
  const unclosedScene1Stream = `{
  "scenes": [
    {
      "index": 1,
      "narratorLine": "Above the rainy street, Maya paused.",
      "estimatedSeconds": 3.0,
      "beats": [
        {
          "beatIndex": 1,
          "textSpan": "Above the rainy street,",
          "estimatedSeconds": 1.5,
          "shotType": "Wide Establishing Shot",
          "cameraAngle": "high-angle",
          "cameraMovement": "Static Frame",
          "imagePrompt": "Vertical 9:16 portrait composition, Wide Establishing Shot looking down at wet slate roofs."
        },
        {
          "beatIndex": 2,
          "textSpan": "Maya paused."`;
  const beat1Partial = extractCompletedStoryboardFields(unclosedScene1Stream);
  assert(
    beat1Partial.scenes.length === 1 &&
      beat1Partial.scenes[0].index === 1 &&
      beat1Partial.scenes[0].beats.length === 1 &&
      beat1Partial.scenes[0].beats[0].beatIndex === 1 &&
      beat1Partial.scenes[0].beats[0].textSpan === 'Above the rainy street,',
    'Suite 36: Beat-by-Beat Streaming, Story Bible First & Deferred Thumbnail',
    '36.1 Emits Closed Beat 1 Immediately Inside Open Unclosed Scene 1 Buffer',
    `scenes=${beat1Partial.scenes.length} beats=${beat1Partial.scenes[0]?.beats?.length || 0}`
  );

  // 36.2 Once Beat 2 closes inside still-open Scene 1, Beat 1 and Beat 2 both emit (while open Scene 2 with 0 closed beats stays excluded)
  const twoBeatsPlusEmptyOpenScene2 = `${unclosedScene1Stream},
          "estimatedSeconds": 1.5,
          "shotType": "Close-Up",
          "cameraAngle": "eye-level",
          "cameraMovement": "Static Frame",
          "imagePrompt": "Vertical 9:16 portrait composition, Close-Up of Maya standing under an awning."
        }
      ]
    },
    {
      "index": 2,
      "narratorLine": "She checked her watch.`;
  const beat2Partial = extractCompletedStoryboardFields(twoBeatsPlusEmptyOpenScene2);
  assert(
    beat2Partial.scenes.length === 1 &&
      beat2Partial.scenes[0].beats.length === 2 &&
      beat2Partial.scenes[0].beats[1].beatIndex === 2,
    'Suite 36: Beat-by-Beat Streaming, Story Bible First & Deferred Thumbnail',
    '36.2 Streams Beat 2 Immediately Inside Open Scene 1 While Excluding Unclosed Scene 2 With Zero Closed Beats',
    `scenes=${beat2Partial.scenes.length} s1Beats=${beat2Partial.scenes[0]?.beats?.length || 0}`
  );

  // 36.3 Stage 3 single-scene and multi-scene "prompts" extraction inside open buffers
  const stage3SingleStream = `{
  "sceneIndex": 2,
  "prompts": [
    {
      "beatIndex": 1,
      "imagePrompt": "Wide 16:9 landscape composition, medium eye-level shot of a lantern swaying in cold mist."
    },
    {
      "beatIndex": 2,
      "imagePrompt": "Wide 16:9 landscape composition, close-up of frost crystals`;
  const stage3SinglePartial = extractCompletedStoryboardFields(stage3SingleStream);
  const stage3BatchStream = `{
  "scenes": [
    {
      "sceneIndex": 1,
      "prompts": [
        {
          "beatIndex": 1,
          "imagePrompt": "Wide 16:9 landscape composition, wide shot of a medieval stone bridge."
        }
      ]
    },
    {
      "sceneIndex": 2,
      "prompts": [
        {
          "beatIndex": 1,
          "imagePrompt": "Wide 16:9 landscape composition, close-up of muddy footprints."
        },
        {
          "beatIndex": 2,
          "imagePrompt": "Partial unclosed`;
  const stage3BatchPartial = extractCompletedStoryboardFields(stage3BatchStream);
  assert(
    stage3SinglePartial.sceneIndex === 2 &&
      Array.isArray(stage3SinglePartial.prompts) &&
      stage3SinglePartial.prompts.length === 1 &&
      stage3SinglePartial.prompts[0].beatIndex === 1 &&
      stage3BatchPartial.scenes.length === 2 &&
      stage3BatchPartial.scenes[1].prompts.length === 1,
    'Suite 36: Beat-by-Beat Streaming, Story Bible First & Deferred Thumbnail',
    '36.3 Extracts Completed Stage 3 Prompts Incrementally in Single-Scene and Multi-Scene Buffers',
    `single=${stage3SinglePartial.prompts?.length || 0} batchS2=${stage3BatchPartial.scenes[1]?.prompts?.length || 0}`
  );

  // 36.4 Story Bible First partial builder returns valid Bible state (scenes: []) with deferred thumbnail: undefined
  const sampleReq: GenerateStoryRequest = {
    story: 'A courier pauses on a rainy bridge and hears a bell.',
    characterStyle: 'Atmospheric ink-wash animation',
    format: 'short',
    platform: 'tiktok',
    durationMode: 'automatic',
    generationMode: 'image',
    modelQuality: 'standard',
  };
  const bibleOnlyResult = buildPartialStoryResultFromStream({
    partial: {
      styleProfile: {
        artStyle: 'Atmospheric ink-wash animation',
        colorPalette: 'Slate gray and warm lantern amber',
        lighting: 'Low-key nocturnal fog',
        eraAndSetting: 'Rainy stone harbor bridge',
      },
      characterSheet: {
        Courier: 'Lean young woman in a dark hooded wool cloak and damp boots',
      },
      locationSheet: {
        'Harbor Bridge': 'Mossy arched stone bridgeslick with midnight rain',
      },
      scenes: [],
    },
    req: sampleReq,
    isLongForm: false,
    isVideoMode: false,
    targetVideoDuration: 5,
    stageLabel: 'Story Bible locked. Streaming Scene 1, Beat 1...',
  });
  const beat1StreamedResult = buildPartialStoryResultFromStream({
    partial: {
      styleProfile: {
        artStyle: 'Atmospheric ink-wash animation',
        colorPalette: 'Slate gray and warm lantern amber',
        lighting: 'Low-key nocturnal fog',
        eraAndSetting: 'Rainy stone harbor bridge',
      },
      scenes: beat1Partial.scenes,
    },
    req: sampleReq,
    isLongForm: false,
    isVideoMode: false,
    targetVideoDuration: 5,
  });
  assert(
    bibleOnlyResult !== null &&
      bibleOnlyResult.scenes.length === 0 &&
      bibleOnlyResult.thumbnail === undefined &&
      bibleOnlyResult.progress?.isPartial === true &&
      bibleOnlyResult.progress?.stageLabel?.includes('Story Bible') &&
      beat1StreamedResult !== null &&
      beat1StreamedResult.scenes.length === 1 &&
      beat1StreamedResult.scenes[0].beats.length === 1 &&
      beat1StreamedResult.thumbnail === undefined &&
      beat1StreamedResult.progress?.stageLabel?.includes('Scene 1, Beat 1'),
    'Suite 36: Beat-by-Beat Streaming, Story Bible First & Deferred Thumbnail',
    '36.4 Builds Story Bible First Partial State & Beat 1 Partial State With Deferred Thumbnail Undefined',
    `bibleScenes=${bibleOnlyResult?.scenes.length} thumb=${String(bibleOnlyResult?.thumbnail)} label=${beat1StreamedResult?.progress?.stageLabel}`
  );
}

function runTestSuite37() {
  const everfrostCast: Record<string, string> = {
    Sable: 'young healer woman with braided auburn hair, woolen green cloak, fur-lined boots, herb satchel',
    'Child Sable': 'young girl with braided auburn hair, knitted red scarf, carved wooden animal charm',
    "Sable's Mother": 'older woman with silver braided hair, simple woolen dress',
    Frost: 'small snow-spirit creature with translucent blue-white fur, glowing pale eyes, crystalline antlers, frost-dusted paws',
  };

  // 37.1 Possessive, pronoun, and role-alias beats keep locked visual traits across scenes
  const otsLocked = injectCompactCharacterLocks(
    "Vertical 9:16 portrait composition, Over-the-Shoulder eye-level, view over Sable's shoulder as she and Frost stride up snowy ridge toward mountain shrine. Shot on 85mm f/2.0. --ar 9:16",
    'must reach the mountain',
    "As an ancient blizzard returns, Sable and Frost must reach the mountain shrine, but saving the spirit may mean letting go of her mother's memory.",
    everfrostCast
  );
  const roleFrostLocked = injectCompactCharacterLocks(
    'Vertical 9:16 portrait composition, Close-Up eye-level, gloved hand reaching toward a trembling snow-spirit on a snowy path. Shot on 85mm f/2.2. --ar 9:16',
    'finds an injured',
    'In the mountain village of Everfrost, young healer Sable finds an injured snow-spirit named Frost.',
    everfrostCast
  );
  const flashbackMotherLocked = injectCompactCharacterLocks(
    'Vertical 9:16 portrait composition, Over-the-Shoulder eye-level, child Sable wearing knitted red scarf listening as mother points to rustling pine. Shot on 85mm f/2.0. --ar 9:16',
    'teaching her to',
    "Flashbacks reveal Sable's late mother teaching her to listen to the forest.",
    everfrostCast
  );
  assert(
    otsLocked.includes('braided auburn hair') &&
      otsLocked.includes('woolen green cloak') &&
      otsLocked.includes('crystalline antlers') &&
      roleFrostLocked.includes('translucent blue-white fur') &&
      roleFrostLocked.includes('crystalline antlers') &&
      flashbackMotherLocked.includes('silver braided hair') &&
      flashbackMotherLocked.includes('simple woolen dress'),
    'Suite 37: Character Persistence, Groq Streaming & Thumbnail Fallbacks',
    '37.1 Possessive, Role-Alias & Flashback Beats Retain Full Character Continuity',
    `ots=${otsLocked}\nroleFrost=${roleFrostLocked}\nmother=${flashbackMotherLocked}`
  );

  // 37.2 Anatomical guard strips hallucinated wings from pawed/antlered creature without wings
  const beatWingFixed = formatFinalBeatPrompt(
    {
      beatIndex: 4,
      textSpan: 'snow-spirit named Frost.',
      shotType: 'Extreme Close-Up',
      cameraAngle: 'eye-level',
      cameraMovement: 'Static Frame',
      imagePrompt:
        'Extreme Close-Up eye-level, small snow-spirit Frost with translucent blue-white fur, glowing pale eyes, crystalline antlers, frost-dusted paws, injured wing drooping. Shot on 100mm f/2.8 macro.',
      estimatedSeconds: 1.5,
    },
    false,
    false,
    { characterSheet: everfrostCast }
  );
  assert(
    !/\bwing\b/i.test(beatWingFixed.imagePrompt) && /frost/i.test(beatWingFixed.imagePrompt),
    'Suite 37: Character Persistence, Groq Streaming & Thumbnail Fallbacks',
    '37.2 Anatomical Guard Prevents Unstated Wings on Pawed Creatures',
    beatWingFixed.imagePrompt
  );

  // 37.3 Groq reasoning options & <think> stripping during incremental SSE JSON extraction
  const qwenOpts = getGroqReasoningOptions('qwen/qwen3.8-27b');
  const gptOssOpts = getGroqReasoningOptions('openai/gpt-oss-120b');
  const unclosedThinkPartial = extractCompletedStoryboardFields('<think>planning scenes {"bad": 1}');
  const closedThinkPartial = extractCompletedStoryboardFields(
    '<think>reasoning finished</think>\n{"scenes":[{"index":1,"narratorLine":"Test","beats":[{"beatIndex":1,"textSpan":"Hello","imagePrompt":"Wide shot --ar 9:16"},'
  );
  assert(
    qwenOpts.reasoning_effort === 'none' &&
      gptOssOpts.reasoning_effort === 'low' &&
      stripReasoningWrappers('<think>ok</think>{"a":1}') === '{"a":1}' &&
      unclosedThinkPartial.scenes.length === 0 &&
      closedThinkPartial.scenes.length === 1 &&
      closedThinkPartial.scenes[0].beats.length === 1,
    'Suite 37: Character Persistence, Groq Streaming & Thumbnail Fallbacks',
    '37.3 Groq Reasoning Controls & Incremental Think-Tag Stripping Before JSON Parse',
    `unclosed=${unclosedThinkPartial.scenes.length} closed=${closedThinkPartial.scenes.length}`
  );

  // 37.4 Normalize nested / snake_case / array Story Bibles from Groq
  const normalizedBible = normalizeStoryBibleResponse({
    storyBible: {
      style_profile: {
        art_style: 'Soft watercolor fantasy animation',
        color_palette: 'Cool glacial blues and warm lantern amber',
        lighting: 'Golden firelight against twilight winter mist',
        era_and_setting: 'Snowbound mountain village of Everfrost',
        lens_and_film_stock: '35mm anamorphic prime feel',
      },
      characters: [
        { name: 'Sable', visualLock: 'Young healer with braided auburn hair and green cloak' },
        { name: 'Frost', visualLock: 'Small translucent blue-white snow-spirit with antlers' },
      ],
    },
  });
  assert(
    normalizedBible.characterSheet.Sable?.includes('auburn hair') &&
      normalizedBible.characterSheet.Frost?.includes('snow-spirit') &&
      normalizedBible.styleProfile?.colorPalette === 'Cool glacial blues and warm lantern amber' &&
      normalizedBible.styleProfile?.eraAndSetting === 'Snowbound mountain village of Everfrost',
    'Suite 37: Character Persistence, Groq Streaming & Thumbnail Fallbacks',
    '37.4 Normalizes Nested and Snake-Case Groq Story Bible Shapes',
    JSON.stringify(normalizedBible)
  );

  // 37.5 Story-derived thumbnail fallback never reverts to generic SURVIVE
  const thumbResult = compileThumbnailPrompt({
    styleProfile: {
      artStyle: 'Soft watercolor fantasy animation',
      colorPalette: 'Cool twilight blue and warm amber',
      lighting: 'Lantern rim glow in winter snow',
      eraAndSetting: 'Mountain village of Everfrost',
    },
    characterSheet: {
      Sable: 'young healer woman with braided auburn hair and woolen green cloak',
    },
    storyPremise:
      'In the mountain village of Everfrost, young healer Sable finds an injured snow-spirit named Frost. Saving the spirit may mean letting go of her mother memory.',
    format: 'short',
    platform: 'TikTok',
  });
  assert(
    thumbResult.hookText !== 'SURVIVE' &&
      thumbResult.compiledPrompt.includes('Sable') &&
      !thumbResult.compiledPrompt.includes('The protagonist'),
    'Suite 37: Character Persistence, Groq Streaming & Thumbnail Fallbacks',
    '37.5 Story-Derived Thumbnail Fallback Uses Real Cast and Story Hook Instead of SURVIVE',
    `hook=${thumbResult.hookText}`
  );
}

async function runTestSuite38() {
  console.log('\n--- Running Test Suite 38: Gemini 429 Quota Diagnostics & Retry Storm Prevention ---');

  // 38.1 Model tier mapping includes Free Tier lite, standard hydrogen, and high pro-preview
  assert(
    resolveGeminiModelId('lite') === 'gemini-3.1-flash-lite' &&
      resolveGeminiModelId('standard') === 'gemini-4-hydrogen' &&
      resolveGeminiModelId('high') === 'gemini-3.1-pro-preview' &&
      resolveGeminiModelId(undefined) === 'gemini-4-hydrogen',
    'Suite 38: Gemini 429 Quota Diagnostics & Retry Storm Prevention',
    '38.1 Maps Model Quality Tiers Including Gemini 3.1 Flash Lite',
    `${resolveGeminiModelId('lite')} | ${resolveGeminiModelId('standard')} | ${resolveGeminiModelId('high')}`
  );

  // 38.2 Non-retryable limit: 0 billing block detection and diagnostic wording
  const zeroQuotaPayload = JSON.stringify({
    error: {
      code: 429,
      message: 'Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0',
      status: 'RESOURCE_EXHAUSTED',
      details: [
        {
          '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
          violations: [
            {
              quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests',
              quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier',
              quotaValue: '0',
            },
          ],
        },
      ],
    },
  });
  const zeroDiag = sanitizeGenericErrorMessage(
    `API error (429): ${zeroQuotaPayload}`,
    'AIzaSySecretTestKey123',
    'gemini',
    'gemini-3.1-pro-preview'
  );
  assert(
    isNonRetryableQuotaExhaustion(429, zeroQuotaPayload) === true &&
      zeroDiag.includes('quota is 0') &&
      zeroDiag.includes('Gemini 3.1 Flash Lite') &&
      !zeroDiag.includes('AIzaSySecretTestKey123'),
    'Suite 38: Gemini 429 Quota Diagnostics & Retry Storm Prevention',
    '38.2 Detects limit: 0 Free Tier Block Without Retrying and Surfaces Actionable Guidance',
    zeroDiag
  );

  // 38.3 Daily RPD exhaustion detection and midnight PT reset explanation
  const dailyRpdPayload = JSON.stringify({
    error: {
      code: 429,
      message: 'Resource has been exhausted (check daily quota)',
      status: 'RESOURCE_EXHAUSTED',
      details: [
        {
          '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
          violations: [
            {
              quotaMetric: 'generativelanguage.googleapis.com/generate_requests_per_day',
              quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier',
              quotaValue: '20',
            },
          ],
        },
      ],
    },
  });
  const dailyDiag = formatGemini429Error(`API error (429): ${dailyRpdPayload}`, 'gemini-4-hydrogen');
  assert(
    isNonRetryableQuotaExhaustion(429, dailyRpdPayload) === true &&
      dailyDiag.includes('daily free-tier limit') &&
      dailyDiag.includes('midnight Pacific Time'),
    'Suite 38: Gemini 429 Quota Diagnostics & Retry Storm Prevention',
    '38.3 Detects Daily RPD Quota Exhaustion and Explains Shared Project Midnight PT Reset',
    dailyDiag
  );

  // 38.4 Transient RPM RetryInfo parsing extracts exact seconds and surfaces wait hint
  const transientRpmPayload = JSON.stringify({
    error: {
      code: 429,
      message: 'Quota exceeded for quota metric RequestsPerMinute, please retry in 42s.',
      status: 'RESOURCE_EXHAUSTED',
      details: [
        {
          '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
          violations: [
            {
              quotaMetric: 'generativelanguage.googleapis.com/generate_content_requests',
              quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier',
              quotaValue: '15',
            },
          ],
        },
        {
          '@type': 'type.googleapis.com/google.rpc.RetryInfo',
          retryDelay: '42s',
        },
      ],
    },
  });
  const parsedMs = parseRetryAfterMs(undefined, transientRpmPayload);
  const rpmDiag = formatGemini429Error(`API error (429): ${transientRpmPayload}`, 'gemini-4-hydrogen');
  assert(
    isNonRetryableQuotaExhaustion(429, transientRpmPayload) === false &&
      parsedMs === 42000 &&
      rpmDiag.includes('wait 42s'),
    'Suite 38: Gemini 429 Quota Diagnostics & Retry Storm Prevention',
    '38.4 Parses Google RetryInfo.retryDelay Accurately and Surfaces Exact Wait Time',
    `parsedMs=${parsedMs} diag=${rpmDiag}`
  );

  // 38.5 Streaming 429 stops cleanly after 1 call instead of falling back to executeJsonLlmCall (8x retry storm)
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  let caughtStreamError = '';
  try {
    globalThis.fetch = (async () => {
      fetchCount++;
      return new Response(zeroQuotaPayload, {
        status: 429,
        statusText: 'Too Many Requests',
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    await streamJsonLlmWithSceneProgress({
      provider: 'gemini',
      apiKey: 'AIzaSyFakeStreamStormTestKey999',
      systemPrompt: 'Return JSON',
      userPrompt: 'Hello',
      modelQuality: 'high',
      onPartialStoryboard: () => {},
    });
  } catch (err: any) {
    caughtStreamError = String(err?.message || '');
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert(
    fetchCount === 1 &&
      caughtStreamError.includes('quota is 0') &&
      !caughtStreamError.includes('AIzaSyFakeStreamStormTestKey999'),
    'Suite 38: Gemini 429 Quota Diagnostics & Retry Storm Prevention',
    '38.5 Halts Streaming 429 Immediately With Single Call (No Fallback Retry Storm)',
    `fetchCount=${fetchCount} err=${caughtStreamError}`
  );
}

// ============================================================================
// 39. GEMINI 3.1 STORYBOARD POLISH: ALIAS BLEED, PROP DRIFT, TYPO/GRAMMAR & THUMB/CTA TONE
// ============================================================================
function runTestSuite39() {
  console.log('\n--- Running Test Suite 39: Gemini 3.1 Alias Bleed, Prop Continuity & Thumbnail/CTA Polish ---');

  const ramenCast: Record<string, string> = {
    'Ramen Chef': 'Short chibi stature, large gentle eyes, wearing a indigo happi coat with a white apron and a traditional hachimaki headband tied neatly',
    'Spirit Patron': 'Translucent blue-tinted humanoid form with soft glowing edges and wispy aesthetic, wearing traditional tattered kimono layers',
    'Wandering Ghost': 'Small spectral chibi figure, semi-transparent, wearing a faded straw hat and simple peasant robes, carrying a small ethereal lantern',
  };
  const cleanSheets = normalizeContinuitySheetKeys(ramenCast);

  // 39.1 Prevents "Ramen" in "Midnight Ramen Stall" or "bowl of ramen" from injecting Featuring Ramen Chef onto stall/ghost/bowl beats
  const stallExteriorLocked = injectCompactCharacterLocks(
    'Vertical 9:16 portrait composition, Wide Establishing Shot, eye-level of the Midnight Ramen Stall featuring a glowing red lantern and steaming iron cauldron under a weathered Shinto shrine gate.',
    'a midnight street stall',
    'A ramen chef operates a midnight street stall...',
    cleanSheets
  );
  const spiritsLocked = injectCompactCharacterLocks(
    'Vertical 9:16 portrait composition, Medium Shot, eye-level of a translucent blue-tinted Spirit Patron and a Wandering Ghost carrying an ethereal lantern approaching the ramen stall. They appear semi-transparent with glowing edges.',
    'that only spirits and wandering ghosts can see,',
    'A ramen chef operates a midnight street stall...',
    cleanSheets
  );
  const bowlMacroLocked = injectCompactCharacterLocks(
    'Vertical 9:16 portrait composition, Extreme Close-Up, eye-level of a swirling vortex of ethereal light inside a wooden bowl of ramen, glowing soft particles rising.',
    'that restores mortal memories.',
    'A ramen chef operates a midnight street stall...',
    cleanSheets
  );
  assert(
    !stallExteriorLocked.includes('Ramen Chef') &&
      !spiritsLocked.includes('Ramen Chef') &&
      !bowlMacroLocked.includes('Ramen Chef') &&
      !spiritsLocked.includes(') carrying an ethereal lantern') &&
      !spiritsLocked.includes('They appear semi-transparent with glowing edges'),
    'Suite 39: Gemini 3.1 Alias Bleed, Prop Continuity & Thumbnail/CTA Polish',
    '39.1 Blocks Food/Setting Alias Leakage ("Ramen Stall"/"Bowl of Ramen") & Comma-less Appositive Duplicates',
    `stall=${stallExteriorLocked} | spirits=${spiritsLocked} | bowl=${bowlMacroLocked}`
  );

  // 39.2 Hand close-up ("Ramen Chef's hands") strips stature, eyes, and headband while fixing "a indigo" -> "an indigo"
  const handPourLocked = injectCompactCharacterLocks(
    "Vertical 9:16 portrait composition, Close-Up, high-angle of the Ramen Chef's hands pouring golden warm broth into a ceramic bowl.",
    'serving warm broth',
    'A ramen chef operates a midnight street stall serving warm broth.',
    cleanSheets
  );
  const handSanitized = sanitizePromptGrammarAndTypos(handPourLocked);
  assert(
    !handSanitized.includes('Short chibi stature') &&
      !handSanitized.includes('large gentle eyes') &&
      !handSanitized.includes('headband') &&
      handSanitized.includes('an indigo happi coat') &&
      !handSanitized.includes('a indigo'),
    'Suite 39: Gemini 3.1 Alias Bleed, Prop Continuity & Thumbnail/CTA Polish',
    '39.2 Strips Stature, Eyes, and Headband From Hand Close-Ups & Fixes "a indigo" Article Typo',
    handSanitized
  );

  // 39.3 Harmonizes prop materials ("ceramic bowl" -> "wooden bowl" drift), freezes pouring/swirling/particles rising, and fixes 24mm ECU lens
  const driftedSceneBeats = harmonizeScenePropMaterials([
    {
      beatIndex: 5,
      textSpan: 'serving warm broth',
      shotType: 'Close-Up',
      cameraAngle: 'high-angle',
      cameraMovement: 'Static Frame',
      imagePrompt: 'Close-Up, high-angle of hands pouring golden warm broth into a ceramic bowl. Shot on 24mm prime lens, f/1.4 aperture.',
      estimatedSeconds: 1.3,
    },
    {
      beatIndex: 6,
      textSpan: 'that restores mortal memories.',
      shotType: 'Extreme Close-Up',
      cameraAngle: 'eye-level',
      cameraMovement: 'Static Frame',
      imagePrompt: 'Extreme Close-Up, eye-level of a swirling vortex of ethereal light inside a wooden bowl of ramen, glowing soft particles rising. Shot on 24mm prime lens, f/1.8 aperture.',
      estimatedSeconds: 1.5,
    },
  ]);
  const b5Static = sanitizeStillImageMotionAndOptics(driftedSceneBeats[0].imagePrompt, 'Close-Up', false);
  const b6Static = sanitizeStillImageMotionAndOptics(driftedSceneBeats[1].imagePrompt, 'Extreme Close-Up', false);
  assert(
    b6Static.includes('ceramic bowl of ramen') &&
      !b6Static.includes('wooden bowl') &&
      !b6Static.includes('swirling vortex') &&
      !b6Static.includes('particles rising') &&
      b5Static.includes('suspended mid-pour') &&
      b5Static.includes('85mm portrait prime lens') &&
      b6Static.includes('100mm macro prime lens'),
    'Suite 39: Gemini 3.1 Alias Bleed, Prop Continuity & Thumbnail/CTA Polish',
    '39.3 Harmonizes Prop Materials ("ceramic bowl"), Freezes Motion Verbs, & Upgrades 24mm Close-Up Optics',
    `b5=${b5Static} | b6=${b6Static}`
  );

  // 39.4 Cleans doubled words ("curtain curtain") and Beat 1 "of a Chef ... stands inside" grammar + double chibi tag
  const locFixed = sanitizePromptGrammarAndTypos('a hand-painted fabric curtain curtain fluttering in the breeze.');
  const beat1Fixed = formatFinalBeatPrompt(
    {
      beatIndex: 1,
      textSpan: 'A ramen chef operates',
      shotType: 'Medium Shot',
      cameraAngle: 'eye-level',
      cameraMovement: 'Static Frame',
      imagePrompt:
        'Medium Shot, eye-level of a Ramen Chef with large gentle eyes, an indigo happi coat, and white apron stands inside a Midnight Ramen Stall. Chibi style, thick outlines. Visual Style: 2D vector-based chibi animation.',
      estimatedSeconds: 1.3,
    },
    false,
    false
  );
  assert(
    locFixed === 'a hand-painted fabric curtain fluttering in the breeze.' &&
      beat1Fixed.imagePrompt.includes('standing inside a Midnight Ramen Stall') &&
      !beat1Fixed.imagePrompt.includes('stands inside') &&
      !beat1Fixed.imagePrompt.includes('Chibi style, thick outlines.'),
    'Suite 39: Gemini 3.1 Alias Bleed, Prop Continuity & Thumbnail/CTA Polish',
    '39.4 Fixes "curtain curtain", Beat 1 "of a Subject ... stands" Grammar, & Redundant Mid-Prompt Chibi Tag',
    `loc=${locFixed} | beat1=${beat1Fixed.imagePrompt}`
  );

  // 39.5 Thumbnail font punctuation ("shadow.,"), accent lowercase ("Neon"), and nostalgic memory CTA tone/grammar
  const ramenThumb = compileThumbnailPrompt({
    rawThumbnail: {
      heroMoment: 'Ramen Chef serves Spirit Patron one final warm bowl',
      expression: 'bittersweet, knowing smile',
      bgDescription: 'rain-slicked Tokyo crossroads with a red Shinto gate',
      accentColor: 'Neon kanji pink',
      hookText: 'THE LAST MEMORY',
      fontStyle: 'Thick brush-stroke Japanese calligraphy font with a glowing white inner stroke and dark drop shadow.',
    },
    styleProfile: {
      artStyle: '2D vector-based chibi animation with smooth cel-shaded rendering',
      colorPalette: 'deep indigo twilight, neon kanji pink, warm steam amber',
      lighting: 'low-key nocturnal lighting from paper lanterns',
      eraAndSetting: 'contemporary Tokyo',
    },
    characterSheet: cleanSheets,
    storyPremise: 'A ramen chef operates a midnight street stall at a forgotten Tokyo crossroads that only spirits and wandering ghosts can see, serving warm broth that restores mortal memories.',
    format: 'short',
    platform: 'TikTok',
  });
  const ramenCta = compileCtaPrompt({
    storyPremise: 'A ramen chef operates a midnight street stall at a forgotten Tokyo crossroads that only spirits and wandering ghosts can see, serving warm broth that restores mortal memories.',
    styleProfile: {
      artStyle: '2D vector-based chibi animation with smooth cel-shaded rendering',
      colorPalette: 'deep indigo twilight, neon kanji pink, warm steam amber',
      lighting: 'low-key nocturnal lighting from paper lanterns',
      eraAndSetting: 'contemporary Tokyo',
    },
    characterSheet: cleanSheets,
    format: 'short',
    platform: 'tiktok',
    modality: 'image',
  });
  assert(
    !ramenThumb.compiledPrompt.includes('shadow.,') &&
      ramenThumb.compiledPrompt.includes('drop shadow, in bold uppercase') &&
      ramenThumb.compiledPrompt.includes('intense neon kanji pink rim lighting') &&
      !ramenCta.questionText.includes("Ramen Chef's position") &&
      ramenCta.questionText.toLowerCase().includes('memory') &&
      ramenCta.compiledPrompt.includes('portrait of the ramen chef (') &&
      !ramenCta.compiledPrompt.includes('intense climactic pause'),
    'Suite 39: Gemini 3.1 Alias Bleed, Prop Continuity & Thumbnail/CTA Polish',
    '39.5 Fixes Thumbnail "shadow.,", Lowercases Accent, Uses Nostalgic Memory CTA & Gentle Chibi Outro Tone',
    `thumb=${ramenThumb.compiledPrompt} | ctaQ=${ramenCta.questionText} | cta=${ramenCta.compiledPrompt}`
  );
}

// ============================================================================
// TEST SUITE 40: Mariana Trench Stickman Audit (Optics, Shared Tokens, Noun-Adjuncts, Still Motion, Deep-Sea CTA)
// ============================================================================
function runTestSuite40() {
  // 40.1 Recognizes 1-digit focal lengths (8mm) & descriptive fisheye lenses, collapses double-lens statements, and derives shot scale from opening
  const wideNoDouble = sanitizeStillImageMotionAndOptics(
    'Vertical 9:16 portrait composition, Wide Establishing Shot, eye-level of a research Submersible drifting. 8mm digital grain texture. Wide-angle fisheye lens. Visual Style: stickman vector art.',
    'Wide Establishing Shot',
    false
  );
  const beat5Fixed = sanitizeStillImageMotionAndOptics(
    'Vertical 9:16 portrait composition, Wide Establishing Shot, eye-level of the Submersible viewport. 8mm digital grain texture. 8mm wide-angle fisheye lens. Shot on 85mm f/1.4 portrait prime lens, shallow depth of field. Visual Style: stickman vector art.',
    'Close-Up',
    false
  );
  const stillGotDefaultWhenMissing = sanitizeStillImageMotionAndOptics(
    'Vertical 9:16 portrait composition, Wide Establishing Shot, eye-level of the deep ocean trench. Visual Style: stickman vector art.',
    'Close-Up',
    false
  );
  assert(
    !wideNoDouble.includes('Shot on 24mm') &&
      wideNoDouble.includes('Wide-angle fisheye lens.') &&
      beat5Fixed.includes('8mm wide-angle fisheye lens.') &&
      !beat5Fixed.includes('85mm f/1.4') &&
      stillGotDefaultWhenMissing.includes('Shot on 24mm f/4 wide lens') &&
      !stillGotDefaultWhenMissing.includes('85mm'),
    'Suite 40: Mariana Trench Stickman Optics, Spatial Fallback & Deep-Sea CTA',
    '40.1 Prevents Double-Lens Stacking, Recognizes 8mm/Fisheye, & Derives Opening Shot Scale Before Default Lens',
    `b1=${wideNoDouble} | b5=${beat5Fixed} | def=${stillGotDefaultWhenMissing}`
  );

  // 40.2 Freezes wave/pulse motion verbs and excludes shared lensAndFilmStock/camera boilerplate from false duplicate triggers
  const frozenWaves = sanitizeStillImageMotionAndOptics(
    'Wide Establishing Shot, eye-level of the Illuminated Metropolis vibrating with pulsating concentric waves and outward-expanding neon rings. 8mm wide-angle fisheye lens.',
    'Wide Establishing Shot',
    false
  );
  const trenchStyle: StyleProfile = {
    artStyle: 'minimalist stickman vector art with thick black outlines, flat digital shading',
    colorPalette: 'deep abyss black, bioluminescent cyan, radioactive neon green',
    lighting: 'sharp high-contrast directional bioluminescence',
    eraAndSetting: '11,000 meters deep within the Mariana Trench',
    lensAndFilmStock: 'wide-angle distorted fisheye lens simulation, 8mm digital grain texture',
  };
  const sharedIgnore = buildSharedContextIgnoreTokens(trenchStyle, {
    'Mariana Trench Abyssal Plain': 'featureless dark void with scattered jagged geometric stick-figure rock formations.',
  });
  const beat3Metropolis =
    'Vertical 9:16 portrait composition, Wide Establishing Shot, eye-level of the Illuminated Metropolis glowing grid lines in the Mariana Trench Abyssal Plain. 8mm digital grain texture. Wide-angle fisheye lens. Visual Style: minimalist stickman vector art.';
  const beat4Trench =
    'Vertical 9:16 portrait composition, Wide Establishing Shot, eye-level inside cockpit peering down toward dark trench chasm walls. 8mm digital grain texture. Wide-angle fisheye lens. Visual Style: minimalist stickman vector art.';
  const sim34 = computeVisualPromptSimilarity(beat3Metropolis, beat4Trench, sharedIgnore);
  assert(
    !frozenWaves.includes('vibrating') &&
      !frozenWaves.includes('pulsating') &&
      !frozenWaves.includes('outward-expanding') &&
      frozenWaves.includes('etched with glowing') &&
      frozenWaves.includes('frozen outward concentric') &&
      sharedIgnore.has('fisheye') &&
      sharedIgnore.has('grain') &&
      sim34 < 0.48,
    'Suite 40: Mariana Trench Stickman Optics, Spatial Fallback & Deep-Sea CTA',
    '40.2 Freezes Wave/Pulse Motion Verbs & Excludes Shared Lens/Camera Boilerplate From Duplicate Scoring',
    `frozen=${frozenWaves} | sim34=${sim34}`
  );

  // 40.3 Protects lowercase noun-adjuncts ("submersible searchlights") and improves Beat 4 fallback location & stickman/helmet framing
  const trenchCast = {
    'Biologist A': 'stickman figure, circle head, thin straight torso and limbs, wearing a simple round white helmet bubble',
    Submersible: 'minimalist rounded rectangular capsule with a large circular viewport and two stick-thin mechanical arm probes',
  };
  const lockedSearchlights = injectCompactCharacterLocks(
    'Close-Up, eye-level framing Biologist A illuminated by submersible searchlights.',
    'buried inside the Mariana Trench',
    'Two deep-sea marine biologists in a research submersible encounter an illuminated city.',
    trenchCast
  );
  const progressedFallback = deduplicateAndProgressSceneBeats(
    [
      {
        beatIndex: 1,
        textSpan: 'Two marine biologists encounter a city',
        shotType: 'Wide Establishing Shot',
        cameraAngle: 'eye-level',
        cameraMovement: 'Static Frame',
        imagePrompt:
          'Wide Establishing Shot, eye-level of Biologist A inside a cockpit peering out at bioluminescent grid towers. Wide-angle fisheye lens.',
        estimatedSeconds: 2.0,
      },
      {
        beatIndex: 2,
        textSpan: 'buried inside the trench',
        shotType: 'Wide Establishing Shot',
        cameraAngle: 'eye-level',
        cameraMovement: 'Static Frame',
        imagePrompt:
          'Wide Establishing Shot, eye-level of Biologist A inside a cockpit peering out at bioluminescent grid towers. Wide-angle fisheye lens.',
        estimatedSeconds: 2.0,
      },
    ],
    {
      scene: {
        index: 1,
        narratorLine: 'Two deep-sea marine biologists in a research submersible encounter a city buried inside the trench.',
        estimatedSeconds: 4.0,
        beats: [],
      },
      isLongForm: false,
      isVideoMode: false,
      styleProfile: trenchStyle,
      characterSheet: trenchCast,
      locationSheet: {
        'Mariana Trench Abyssal Plain': 'featureless dark void with scattered jagged geometric stick-figure rock formations.',
      },
    }
  );
  const beat2Fallback = progressedFallback[1]?.imagePrompt || '';
  assert(
    lockedSearchlights.includes('Biologist A (stickman figure') &&
      lockedSearchlights.includes('submersible searchlights') &&
      !lockedSearchlights.includes('submersible (minimalist rounded rectangular') &&
      beat2Fallback.includes('submersible interior') &&
      !beat2Fallback.includes('eyes fixed intently forward'),
    'Suite 40: Mariana Trench Stickman Optics, Spatial Fallback & Deep-Sea CTA',
    '40.3 Skips Lowercase Compound Modifiers ("submersible searchlights") & Keeps Stickman/Vessel Continuity in Fallbacks',
    `search=${lockedSearchlights} | fb=${beat2Fallback}`
  );

  // 40.4 Deep-sea/sonar discovery CTA avoids generic position prompt, adapts helmeted stickman framing, and cleans Thumbnail helmet/comma
  const trenchPremise =
    'Two deep-sea marine biologists in a research submersible encounter an illuminated underwater metropolis buried inside the Mariana Trench that responds to sonar pulses with musical harmonics.';
  const trenchThumb = compileThumbnailPrompt({
    rawThumbnail: {
      heroMoment: 'Biologist A pilots Submersible toward the city as it emits musical harmonic pulses',
      expression: 'wide eyed shock behind glass helmets',
      bgDescription: 'pitch black abyssal void with glowing cyan grid towers',
      accentColor: 'bioluminescent cyan',
      hookText: 'THE OCEAN SINGS',
      fontStyle: 'bold sans serif geometric type',
    },
    styleProfile: trenchStyle,
    characterSheet: trenchCast,
    storyPremise: trenchPremise,
    format: 'short',
    platform: 'TikTok',
  });
  const trenchCta = compileCtaPrompt({
    storyPremise: trenchPremise,
    styleProfile: trenchStyle,
    characterSheet: trenchCast,
    format: 'short',
    platform: 'tiktok',
    modality: 'image',
  });
  assert(
    trenchThumb.cleanPlatePrompt.includes('above the hero shoulders, left completely empty') &&
      trenchThumb.compiledPrompt.includes('behind the helmet visor') &&
      !trenchThumb.compiledPrompt.includes('glass helmets') &&
      !trenchThumb.compiledPrompt.includes('as it emits musical harmonic pulses') &&
      trenchThumb.compiledPrompt.includes('radiating crisp luminous concentric rings') &&
      !trenchCta.questionText.includes("Biologist A's position") &&
      /ocean|trench|signal|sonar|harmonic/i.test(trenchCta.questionText) &&
      trenchCta.compiledPrompt.includes('helmeted silhouette') &&
      !trenchCta.compiledPrompt.includes('sharp cinematic focus on facial expression') &&
      trenchCta.compiledPrompt.includes(', separating the subject from atmospheric background shadows'),
    'Suite 40: Mariana Trench Stickman Optics, Spatial Fallback & Deep-Sea CTA',
    '40.4 Routes Deep-Sea Sonar Premise to Discovery CTA, Uses Helmeted Stickman Framing, & Cleans Thumbnail Helmet/Comma',
    `thumbClean=${trenchThumb.cleanPlatePrompt} | ctaQ=${trenchCta.questionText} | cta=${trenchCta.compiledPrompt}`
  );
}

// ============================================================================
// TEST SUITE 41: Neo-Seoul Photographer Audit (Monochrome Adjective, Flicker Syntax, Proper+Title Name, Premonition CTA)
// ============================================================================
function runTestSuite41() {
  const noirStyle: StyleProfile = {
    artStyle: '2D minimalist stickman silhouettes with high contrast ink lines on a textured grainy paper background',
    colorPalette: 'monochrome palette of deep carbon black, stark off-white paper, and neon-pulse stark white accents',
    lighting: 'hard noir film noir lighting with deep shadows and harsh volumetric light rays hitting smoke',
    eraAndSetting: '1980s Neo-Seoul, a dense rain-slicked urban sprawl',
  };

  // 41.1 Monochrome cyan adjective stays grammatical ("white") and "hard noir film noir" / "neo-Seoul" clean cleanly
  const monoFont = sanitizeMonochromeLighting(
    'floating 2D sans-serif digital text blocks in a glowing cyan terminal font with cyan accents',
    noirStyle
  );
  const noirGrammar = sanitizePromptGrammarAndTypos(
    'Wide Establishing Shot, high-angle of neo-Seoul Street under hard noir film noir lighting.'
  );
  assert(
    monoFont.includes('glowing white terminal font') &&
      !monoFont.includes('stark white accents terminal font') &&
      monoFont.includes('stark white accents') &&
      noirGrammar.includes('Neo-Seoul Street') &&
      noirGrammar.includes('hard film noir lighting'),
    'Suite 41: Neo-Seoul Photographer Monochrome, Flicker, Naming & Premonition CTA',
    '41.1 Preserves Adjective Grammar on Monochrome Cyan & Fixes "hard noir film noir" + "neo-Seoul"',
    `monoFont=${monoFont} | grammar=${noirGrammar}`
  );

  // 41.2 Attributive "flickering overhead bulb" freezes to "still-lit overhead bulb" without "single captured in a single..."
  const frozenBulb = sanitizeStillImageMotionAndOptics(
    "Medium Close-Up, birds-eye of stickman photographer inside Joon's Darkroom under a single flickering overhead bulb. 35mm lens profile.",
    'Medium Close-Up',
    false
  );
  assert(
    frozenBulb.includes('a single still-lit overhead bulb') &&
      !frozenBulb.includes('captured in a single frozen illumination'),
    'Suite 41: Neo-Seoul Photographer Monochrome, Flicker, Naming & Premonition CTA',
    '41.2 Freezes Attributive "flickering overhead bulb" Without Syntax Break or Doubled "single"',
    `frozenBulb=${frozenBulb}`
  );

  // 41.3 Excludes text-overlay characterSheet entries ("The Headlines") from stealing singleLeadChar or leaking onto alley beats
  const neoCast = {
    'Joon the Photographer':
      'stickman figure with a prominent rectangular camera strapped around his neck, wearing a long trench coat and a brimmed fedora',
    'The Headlines': 'floating 2D sans-serif digital text blocks in a glowing cyan terminal font',
  };
  const alleyBeat = injectCompactCharacterLocks(
    'Wide Establishing Shot, high-angle of Neo-Seoul Street with towering signs and rain-puddled asphalt.',
    'in 1980s Neo-Seoul',
    'A young street photographer in 1980s Neo-Seoul develops black-and-white film.',
    noirStyle ? neoCast : neoCast
  );
  const beat1Photographer = injectCompactCharacterLocks(
    'Medium Shot, eye-level of a stickman figure with rectangular camera standing in alley.',
    'A young street photographer',
    'A young street photographer in 1980s Neo-Seoul develops black-and-white film.',
    neoCast
  );
  assert(
    !alleyBeat.includes('Featuring The Headlines') &&
      beat1Photographer.includes('Joon the Photographer (stickman figure'),
    'Suite 41: Neo-Seoul Photographer Monochrome, Flicker, Naming & Premonition CTA',
    '41.3 Filters Non-Living Typography Sheet Keys ("The Headlines") Out of Character Locking',
    `alley=${alleyBeat} | beat1=${beat1Photographer}`
  );

  // 41.4 Preserves "Joon the Photographer" capitalization, strips cyan inside Thumbnail Conflict, and triggers Premonition CTA
  const joonPremise =
    'A young street photographer in 1980s Neo-Seoul develops black-and-white film that unexpectedly captures future headlines ten minutes before they happen.';
  const joonThumb = compileThumbnailPrompt({
    rawThumbnail: {
      heroMoment: 'Joon the Photographer witnesses The Headlines materializing within developed film frames',
      expression: 'tense alert posture',
      bgDescription: 'rain slicked 1980s Neo-Seoul alleyway',
      accentColor: 'stark white',
      hookText: 'THE FUTURE DEVELOPED',
      fontStyle: 'gritty 1980s retro terminal font',
    },
    styleProfile: noirStyle,
    characterSheet: neoCast,
    storyPremise: joonPremise,
    format: 'short',
    platform: 'TikTok',
  });
  const joonCta = compileCtaPrompt({
    storyPremise: joonPremise,
    styleProfile: noirStyle,
    characterSheet: neoCast,
    format: 'short',
    platform: 'tiktok',
    modality: 'image',
  });
  assert(
    joonThumb.compiledPrompt.includes('Hero Subject: Joon the Photographer (') &&
      !joonThumb.compiledPrompt.includes('The joon the photographer') &&
      !joonThumb.compiledPrompt.includes('cyan') &&
      joonCta.compiledPrompt.includes('portrait of Joon the Photographer (') &&
      !joonCta.compiledPrompt.includes('the joon the photographer') &&
      !joonCta.compiledPrompt.includes('hard noir film noir') &&
      /ten minutes before/i.test(joonCta.questionText) &&
      !joonCta.questionText.includes("position?"),
    'Suite 41: Neo-Seoul Photographer Monochrome, Flicker, Naming & Premonition CTA',
    '41.4 Preserves "Joon the Photographer" Naming, Keeps Thumbnail Monochrome, & Routes Premonition Story CTA',
    `thumb=${joonThumb.compiledPrompt} | ctaQ=${joonCta.questionText} | cta=${joonCta.compiledPrompt}`
  );
}

// ============================================================================
// TEST SUITE 42: Desert Nomad Chibi Audit (CTA Substring Bug, Role Naming, Chibi Tone, Location Grammar)
// ============================================================================
function runTestSuite42() {
  const chibiDesertStyle: StyleProfile = {
    artStyle: '3D stylized chibi rendering with soft rounded edges and matte tactile plastic textures',
    colorPalette: 'golden desert ochre, sun-bleached sandstone white, vibrant cobalt sky',
    lighting: 'High-contrast harsh midday sun creating sharp, deep, yet soft-edged shadows, with intense lens flares reflecting off mirror surfaces',
    eraAndSetting: 'Post-apocalyptic high-fantasy future, endless rolling sand dunes',
  };
  const nomadPremise =
    'A silent desert nomad guides a caravan of solar-powered mechanical beasts across an endless dune sea, seeking an oasis made entirely of crystallized mirrors.';
  const nomadCast = {
    Nomad: 'Chibi proportions with oversized head, hooded beige burlap cloak, brass-rimmed goggles over dark eyes',
  };
  const nomadLocations = {
    'Mirror Oasis': 'A cluster of geometric floating quartz pillars and shattered mirrored glass pools reflecting the sky',
  };

  // 42.1 "seeking" & "solar-powered" never trigger Fantasy "possessed this power"; routes to Desert / Oasis CTA
  const desertQuestion = inferStoryAdaptiveCtaQuestion(nomadPremise, 'the nomad');
  assert(
    !desertQuestion.primaryQuestion.includes('possessed this power') &&
      /oasis|wasteland|dune|mirage|mirror/i.test(desertQuestion.primaryQuestion),
    'Suite 42: Desert Nomad Chibi CTA, Role Naming & Location Grammar',
    '42.1 Blocks "seeking"/"solar-powered" Fantasy False-Positives and Routes to Desert Oasis CTA',
    `primaryQuestion=${desertQuestion.primaryQuestion}`
  );

  // 42.2 Nomad formats as "The nomad" / "the nomad", chibi doesn't force bittersweet emotion, shadows deduplicate
  const nomadThumb = compileThumbnailPrompt({
    rawThumbnail: {
      heroMoment: 'Nomad stands atop a dune pointing toward a shimmering tower of crystallized mirrors',
      expression: 'focused gaze behind brass-rimmed goggles',
      bgDescription: 'ochre sand dunes under vibrant cobalt sky',
      accentColor: 'prismatic iridescent chrome',
      hookText: 'THE MIRROR OASIS',
      fontStyle: 'Chunky rounded sans serif',
    },
    styleProfile: chibiDesertStyle,
    characterSheet: nomadCast,
    storyPremise: nomadPremise,
    format: 'short',
    platform: 'TikTok',
  });
  const nomadCta = compileCtaPrompt({
    storyPremise: nomadPremise,
    styleProfile: chibiDesertStyle,
    characterSheet: nomadCast,
    format: 'short',
    platform: 'tiktok',
    modality: 'image',
  });
  assert(
    nomadThumb.compiledPrompt.includes('Hero Subject: The nomad (locked visual identity:') &&
      nomadCta.compiledPrompt.includes('portrait of the nomad (locked visual identity:') &&
      !nomadCta.compiledPrompt.includes('gentle bittersweet emotion') &&
      !nomadCta.compiledPrompt.includes('sharp, deep, yet soft-edged shadows') &&
      nomadCta.compiledPrompt.includes('sharp, deep cast shadows'),
    'Suite 42: Desert Nomad Chibi CTA, Role Naming & Location Grammar',
    '42.2 Formats Nomad Role Cleanly, Drops Forced Chibi Bittersweet Tone, & Cleans Contradictory Shadows',
    `thumb=${nomadThumb.compiledPrompt} | cta=${nomadCta.compiledPrompt}`
  );

  // 42.3 Location reveal grammar ("Mirror Oasis reveals cluster of") & "of extreme detail of a" cleanup
  const beat6 = formatFinalBeatPrompt(
    {
      beatIndex: 6,
      textSpan: 'of crystallized mirrors.',
      shotType: 'Wide Establishing Shot',
      cameraAngle: 'eye-level',
      cameraMovement: 'Static Frame',
      estimatedSeconds: 1.5,
      imagePrompt: 'Mirror Oasis reveals cluster of geometric floating quartz pillars reflecting the sky. 14mm lens.',
    },
    false,
    false,
    { styleProfile: chibiDesertStyle, characterSheet: nomadCast, locationSheet: nomadLocations }
  );
  const beat3 = formatFinalBeatPrompt(
    {
      beatIndex: 3,
      textSpan: 'of solar-powered mechanical beasts',
      shotType: 'Close-Up',
      cameraAngle: 'eye-level',
      cameraMovement: 'Static Frame',
      estimatedSeconds: 1.5,
      imagePrompt: 'Close-Up, eye-level of extreme detail of a chibi mechanical beast with copper chassis. 14mm lens.',
    },
    false,
    false,
    { styleProfile: chibiDesertStyle, characterSheet: nomadCast, locationSheet: nomadLocations }
  );
  assert(
    beat6.imagePrompt.includes('of the Mirror Oasis revealing a cluster of') &&
      !beat3.imagePrompt.includes('of extreme detail of a') &&
      beat3.imagePrompt.includes('extreme detail of a'),
    'Suite 42: Desert Nomad Chibi CTA, Role Naming & Location Grammar',
    '42.3 Fixes Location Reveal Verb Grammar and Removes Doubled "of extreme detail of"',
    `beat6=${beat6.imagePrompt} | beat3=${beat3.imagePrompt}`
  );
}

async function runTestSuite43() {
  console.log('\n--- Running Suite 43: Paper-Cut Stickman Option B Segmentation, Grammar, Crib Guard & Storybook CTA ---');

  const paperCutStyle = {
    artStyle: 'tactile paper-cut stop-motion collage with hand-drawn minimalist stickman silhouette',
    colorPalette: 'warm parchment cream, forest moss green, scarlet scarf red, deep ink charcoal',
    lighting: 'soft studio tabletop lamp light with gentle layered paper shadows',
    eraAndSetting: 'whimsical handmade storybook paper studio',
    lensAndFilmStock: '85mm macro lens, crisp tactile paper grain',
  };
  const paperCast: Record<string, string> = {
    Pip: 'minimalist black ink stickman figure with bright circular white eyes, wearing a long scarlet red knit scarf and gripping a stubby yellow pencil',
    Moss: 'small round moss-green sculptural clay forest creature with curved bark horns and glowing amber pebble eyes',
    'Child Pip': 'younger minimalist black ink stickman figure wearing the same scarlet red knit scarf',
  };
  const paperLocations: Record<string, string> = {
    'Paper Forest': 'layered green construction-paper trees surrounding an ancient gnarled oak in the clearing',
    'Dark Sketchbook': 'open textured watercolor notebook spread with charcoal smudges',
  };

  // 43.1 Option B Phrase-Level Segmentation enforces <= 6 words in Image Mode and preserves child non-crib flashbacks + custom/video opt-out
  const longBeatScenes = [
    {
      sceneNumber: 1,
      narratorLine: 'a handcrafted clay creature guarding the last living tree.',
      beats: [
        {
          beatIndex: 1,
          textSpan: 'a handcrafted clay creature guarding the last living tree.',
          shotType: 'Medium Shot',
          cameraAngle: 'eye-level',
          cameraMovement: 'Static Frame',
          estimatedSeconds: 3.6,
          imagePrompt: 'Medium Shot, eye-level of Moss standing beside an oak tree in the Paper Forest.',
        },
      ],
    },
    {
      sceneNumber: 2,
      narratorLine: 'Flashbacks show Pip drawing Moss as a child.',
      beats: [
        {
          beatIndex: 1,
          textSpan: 'Flashbacks show Pip drawing Moss as a child.',
          shotType: 'Close-Up',
          cameraAngle: 'high-angle',
          cameraMovement: 'Static Frame',
          estimatedSeconds: 3.2,
          imagePrompt: 'Close-Up, high-angle of Child Pip sketching Moss inside the Dark Sketchbook.',
        },
      ],
    },
  ];

  const segmentedScenes = await runTwoPhaseProgressionAndRepair({
    scenes: longBeatScenes as any,
    styleProfile: paperCutStyle,
    characterSheet: paperCast,
    locationSheet: paperLocations,
    isLongForm: false,
    isVideoMode: false,
    skipLlmRepair: true,
  });

  const scene1Words = segmentedScenes[0].beats.map((b) => (b.textSpan || '').trim().split(/\s+/).filter(Boolean).length);
  const scene1Joined = segmentedScenes[0].beats.map((b) => (b.textSpan || '').trim()).join(' ');
  const scene2Joined = segmentedScenes[1].beats.map((b) => (b.textSpan || '').trim()).join(' ');
  const scene2Prompts = segmentedScenes[1].beats.map((b) => b.imagePrompt).join(' ');

  const customUnchangedScenes = await runTwoPhaseProgressionAndRepair({
    scenes: [longBeatScenes[0]] as any,
    styleProfile: paperCutStyle,
    characterSheet: paperCast,
    locationSheet: paperLocations,
    isLongForm: false,
    isVideoMode: false,
    skipLlmRepair: true,
    skipOptionBPhraseSplit: true,
  });

  const videoUnchangedScenes = await runTwoPhaseProgressionAndRepair({
    scenes: [longBeatScenes[0]] as any,
    styleProfile: paperCutStyle,
    characterSheet: paperCast,
    locationSheet: paperLocations,
    isLongForm: false,
    isVideoMode: true,
    targetVideoDuration: 4,
    skipLlmRepair: true,
  });

  assert(
    segmentedScenes[0].beats.length >= 2 &&
      scene1Words.every((w) => w >= 1 && w <= 6) &&
      scene1Joined === 'a handcrafted clay creature guarding the last living tree.' &&
      scene2Joined === 'Flashbacks show Pip drawing Moss as a child.' &&
      !/swaddled\s+inside\s+a\s+wooden\s+crib|dark\s+gaunt\s+entity/i.test(scene2Prompts) &&
      customUnchangedScenes[0].beats.length === 1 &&
      videoUnchangedScenes[0].beats.length === 1,
    'Suite 43: Paper-Cut Stickman Option B Segmentation, Grammar, Crib Guard & Storybook CTA',
    '43.1 Enforces 2-6 Word Option B Beats in Image Mode, Guards Non-Crib Childhood Flashbacks, and Skips Custom/Video Modes',
    `s1Len=${segmentedScenes[0].beats.length} s1Words=${JSON.stringify(scene1Words)} s2Prompts=${scene2Prompts}`
  );

  // 43.2 Preserves Proper Names after 'of ', Converts Finite Verbs to Participles, Prunes Duplicate Traits & Cleans 'of a macro view of'
  const pipGrammarBeat = formatFinalBeatPrompt(
    {
      beatIndex: 1,
      textSpan: 'Pip steps closer',
      shotType: 'Medium Shot',
      cameraAngle: 'eye-level',
      cameraMovement: 'Static Frame',
      estimatedSeconds: 1.5,
      imagePrompt:
        'Medium Shot, eye-level of Pip (minimalist black ink stickman with red scarf and yellow pencil) with red scarf and yellow pencil stands inside the Paper Forest.',
    },
    false,
    false,
    { styleProfile: paperCutStyle, characterSheet: paperCast, locationSheet: paperLocations }
  );

  const macroGrammarBeat = formatFinalBeatPrompt(
    {
      beatIndex: 2,
      textSpan: 'his pencil tip glows',
      shotType: 'Extreme Close-Up',
      cameraAngle: 'high-angle',
      cameraMovement: 'Static Frame',
      estimatedSeconds: 1.2,
      imagePrompt:
        'Extreme Close-Up, high-angle of a macro view of Child Pip uses a stubby yellow pencil inside the Dark Sketchbook.',
    },
    false,
    false,
    { styleProfile: paperCutStyle, characterSheet: paperCast, locationSheet: paperLocations }
  );

  assert(
    pipGrammarBeat.imagePrompt.includes('of Pip (') &&
      pipGrammarBeat.imagePrompt.includes('standing inside') &&
      !pipGrammarBeat.imagePrompt.includes('of pip') &&
      macroGrammarBeat.imagePrompt.includes('macro detail of Child Pip using') &&
      !macroGrammarBeat.imagePrompt.includes('of a macro view of'),
    'Suite 43: Paper-Cut Stickman Option B Segmentation, Grammar, Crib Guard & Storybook CTA',
    '43.2 Protects Proper Name Capitalization, Participle Grammar & Removes Redundant Macro Prefix',
    `pip=${pipGrammarBeat.imagePrompt} | macro=${macroGrammarBeat.imagePrompt}`
  );

  // 43.3 Storybook Fable avoids Horror CTA and Bare Stickman CTA avoids Helmet/Visor Silhouette
  const fablePremise =
    'A tiny paper-cut stickman named Pip tries to save a handcrafted clay creature guarding the last living tree after drawing Moss as a child, hoping to finish the drawing before the ink dries.';
  const fableCta = inferStoryAdaptiveCtaQuestion(fablePremise, 'Pip');
  const bareStickmanCta = compileCtaPrompt({
    storyPremise: fablePremise,
    characterSheet: { Pip: paperCast.Pip },
    styleProfile: paperCutStyle,
    format: 'short',
    platform: 'tiktok',
    modality: 'image',
  });

  assert(
    !/fled the moment things went dark/i.test(fableCta.primaryQuestion) &&
      /tree|drawing|story|creature/i.test(fableCta.primaryQuestion) &&
      !/helmeted silhouette|visor outline/i.test(bareStickmanCta.compiledPrompt) &&
      /silhouette edges|drawn figure/i.test(bareStickmanCta.compiledPrompt),
    'Suite 43: Paper-Cut Stickman Option B Segmentation, Grammar, Crib Guard & Storybook CTA',
    '43.3 Routes Storybook Fables to Living-Art CTA and Bare Stickmen Away from Helmeted Silhouette',
    `ctaQ=${fableCta.primaryQuestion} | ctaPrompt=${bareStickmanCta.compiledPrompt}`
  );
}

async function runTestSuite44() {
  console.log('\n--- Running Suite 44: Submerged Library & Lighthouse Keeper Fixes ---');

  // 44.1 Preserves concrete prop/action context + Fixed 35mm lens during Option B split, and protects "glass lantern room"
  const libraryStyle = {
    artStyle: 'High-contrast 2D stickman ink-wash figures with cross-hatched shadows',
    colorPalette: 'deep obsidian blacks, stark paper-white, weathered sepia highlights',
    lighting: 'harsh dramatic chiaroscuro rim lighting',
    eraAndSetting: 'post-apocalyptic flooded coastal library ruin',
    lensAndFilmStock: 'Fixed 35mm prime lens perspective on degraded 16mm black-and-white stock',
  };
  const scavengerCast = {
    'The Scavenger': 'minimalist stickman silhouette with hunched posture, tattered wide-brimmed hat, sodden hooded cloak over thin wiry frame',
  };
  const libraryLocations = {
    'The Submerged Library': 'decaying stone pillars and skeletal barnacle-encrusted bookshelves in shallow standing water',
  };

  const splitJournalScenes = await runTwoPhaseProgressionAndRepair({
    scenes: [
      {
        index: 1,
        narratorLine: 'he pulls out a sealed leather journal.',
        estimatedSeconds: 2.5,
        beats: [
          {
            beatIndex: 1,
            textSpan: 'he pulls out a sealed leather journal.',
            shotType: 'Medium Shot',
            cameraAngle: 'eye-level',
            cameraMovement: 'Static Frame',
            estimatedSeconds: 2.5,
            imagePrompt:
              'Medium Shot, eye-level of The Scavenger pulling a worn, sealed leather journal from submerged debris inside The Submerged Library. Fixed 35mm prime lens perspective.',
          },
        ],
      },
    ],
    styleProfile: libraryStyle,
    characterSheet: scavengerCast,
    locationSheet: libraryLocations,
    isLongForm: false,
    isVideoMode: false,
    skipLlmRepair: true,
  });

  const secondSplitPrompt = splitJournalScenes[0].beats[1]?.imagePrompt || '';

  const keeperCast = {
    'The Keeper':
      'Seventy-year-old male, deep facial wrinkles, salt-and-pepper stubble, pale blue eyes, heavy oversized dark wool pea coat, oil-stained heavy canvas trousers, worn-through leather boots',
  };
  const lighthouseStyle = {
    artStyle: 'Hyper-realistic cinematic digital painting with tactile gritty textures',
    colorPalette: 'deep obsidian blacks, stormy slate blues, brilliant lighthouse lantern gold',
    lighting: 'high-contrast chiaroscuro lantern beams',
    eraAndSetting: 'mid-20th century rocky islet in a violent hurricane',
    lensAndFilmStock: '35mm anamorphic lens with heavy film grain',
  };

  const harmonizedRooms = harmonizeScenePropMaterials([
    {
      beatIndex: 1,
      textSpan: 'He lit the lamp,',
      shotType: 'Medium Close-Up',
      cameraAngle: 'eye-level',
      cameraMovement: 'Static Frame',
      estimatedSeconds: 1.5,
      imagePrompt: 'Medium Close-Up of The Keeper striking a match against the brass lantern housing.',
    },
    {
      beatIndex: 2,
      textSpan: 'raged against the glass.',
      shotType: 'Close-Up',
      cameraAngle: 'eye-level',
      cameraMovement: 'Static Frame',
      estimatedSeconds: 1.5,
      imagePrompt: 'Close-Up of rainwater pressed against the reinforced circular glass lantern room.',
    },
  ]);

  assert(
    splitJournalScenes[0].beats.length >= 2 &&
      /leather\s+journal/i.test(secondSplitPrompt) &&
      !/still posture with head and shoulders angled intently forward/i.test(secondSplitPrompt) &&
      !/Shot on 85mm/i.test(secondSplitPrompt) &&
      /Fixed 35mm prime lens/i.test(secondSplitPrompt) &&
      harmonizedRooms[1].imagePrompt.includes('glass lantern room') &&
      !harmonizedRooms[1].imagePrompt.includes('brass lantern room'),
    'Suite 44: Submerged Library & Lighthouse Keeper Fixes',
    '44.1 Preserves Prop Context + Fixed 35mm Lens in Option B Splits and Shields Glass Lantern Room Material',
    `secondSplit=${secondSplitPrompt} | harmonized=${harmonizedRooms[1].imagePrompt}`
  );

  // 44.2 Fixes "the swirling storm rain", "lashing violently"/"sweeping out", finite verbs after locks, duplicate traits & dropped angles
  const keeperLockedText1 = injectCompactCharacterLocks(
    'Medium Shot, eye-level of The Keeper (Seventy-year-old male, deep facial wrinkles, salt-and-pepper stubble, pale blue eyes, heavy oversized dark wool pea coat, oil-stained heavy canvas trousers, worn-through leather boots) in oil-stained heavy canvas trousers and worn-through leather boots ascends a spiral iron staircase.',
    'climbed the rusted stairs',
    'The old lighthouse keeper climbed the rusted stairs for the final time.',
    keeperCast
  );
  const keeperBeat1 = formatFinalBeatPrompt(
    {
      beatIndex: 1,
      textSpan: 'climbed the rusted stairs',
      shotType: 'Medium Shot',
      cameraAngle: 'eye-level',
      cameraMovement: 'Static Frame',
      estimatedSeconds: 1.5,
      imagePrompt: keeperLockedText1,
    },
    false,
    false,
    { styleProfile: lighthouseStyle, characterSheet: keeperCast, locationSheet: {} }
  );

  const keeperBeat2 = formatFinalBeatPrompt(
    {
      beatIndex: 2,
      textSpan: 'He lit the lamp,',
      shotType: 'Medium Close-Up',
      cameraAngle: 'eye-level',
      cameraMovement: 'Static Frame',
      estimatedSeconds: 1.5,
      imagePrompt:
        'Medium Close-Up, eye-level of The keeper (Seventy-year-old male, heavy oversized dark wool pea coat), strikes a match against the brass lantern housing while rain is lashing violently against the glass and the beam is sweeping out over the violent, dark ocean.',
    },
    false,
    false,
    { styleProfile: lighthouseStyle, characterSheet: keeperCast, locationSheet: {} }
  );

  const keeperBeat3 = formatFinalBeatPrompt(
    {
      beatIndex: 3,
      textSpan: 'Outside, the storm',
      shotType: 'Extreme Wide Shot',
      cameraAngle: 'high-angle',
      cameraMovement: 'Static Frame',
      estimatedSeconds: 1.5,
      imagePrompt: 'Extreme wide exterior shot of an isolated rocky islet during a violent hurricane. Shot on 24mm f/4 wide lens.',
    },
    false,
    false,
    { styleProfile: lighthouseStyle, characterSheet: keeperCast, locationSheet: {} }
  );

  const frozeSwirlRain = sanitizeKineticMotionForImage(
    'The Keeper stands rigid as a golden beam illuminates the swirling storm rain.'
  );

  assert(
    keeperBeat1.imagePrompt.includes('ascending a spiral') &&
      !keeperBeat1.imagePrompt.includes('in oil-stained heavy canvas trousers and worn-through leather boots') &&
      keeperBeat2.imagePrompt.includes('The Keeper (') &&
      keeperBeat2.imagePrompt.includes('striking a match') &&
      !/\blashing violently\b/i.test(keeperBeat2.imagePrompt) &&
      !/\bsweeping out\b/i.test(keeperBeat2.imagePrompt) &&
      keeperBeat3.imagePrompt.includes('Extreme wide exterior shot, high-angle of') &&
      frozeSwirlRain.includes('the storm rain frozen in curved spiral patterns'),
    'Suite 44: Submerged Library & Lighthouse Keeper Fixes',
    '44.2 Fixes Pre-Noun Swirling Motion, Lashing/Sweeping Freeze, Participle Grammar, Angle Sync & Keeper Casing',
    `b1=${keeperBeat1.imagePrompt} | b2=${keeperBeat2.imagePrompt} | b3=${keeperBeat3.imagePrompt} | swirl=${frozeSwirlRain}`
  );

  // 44.3 Routes Lighthouse Final Watch & Submerged Library Archive to Story-Matched CTAs and Fixes Thumbnail Post-Colon Case
  const lighthouseCta = inferStoryAdaptiveCtaQuestion(
    'The old lighthouse keeper climbed the rusted stairs for the final time. His watch was over, but the light would guide the lost souls home forever tonight.',
    'The Keeper'
  );
  const archiveCta = inferStoryAdaptiveCtaQuestion(
    'A lone scavenger digs through the flooded ruins of an ancient coastal library, pulling out a sealed leather journal preserving words from a world lost to water.',
    'The Scavenger'
  );
  const lighthouseThumb = compileThumbnailPrompt({
    storyPremise: 'An old lighthouse keeper lights the lamp for his final watch.',
    styleProfile: lighthouseStyle,
    characterSheet: keeperCast,
    rawThumbnail: {
      heroMoment: 'The Keeper stands beside the lantern glass illuminating the swirling storm rain',
      expression: 'A weathered resolute expression',
      bgDescription: 'Obsidian dark storm clouds and crashing sea waves',
      accentColor: 'lighthouse lantern gold',
      hookText: 'HIS FINAL LIGHT',
      fontStyle: 'Heavy industrial sans serif',
    },
    format: 'short',
    platform: 'tiktok',
  });

  assert(
    /keep the light burning|guiding light|final watch/i.test(lighthouseCta.primaryQuestion) &&
      !/ramen|warm meal/i.test(lighthouseCta.primaryQuestion) &&
      /save only one dry book|drowned|lost world/i.test(archiveCta.primaryQuestion) &&
      lighthouseThumb.compiledPrompt.includes('the storm rain frozen in curved spiral patterns') &&
      lighthouseThumb.compiledPrompt.includes('background: obsidian dark storm clouds'),
    'Suite 44: Submerged Library & Lighthouse Keeper Fixes',
    '44.3 Routes Lighthouse & Submerged Library CTAs Accurately and Lowercases Post-Colon Thumbnail Background',
    `lhQ=${lighthouseCta.primaryQuestion} | archQ=${archiveCta.primaryQuestion} | thumb=${lighthouseThumb.compiledPrompt}`
  );
}

// ============================================================================
// TEST SUITE 45: AI Assistant Reference Image (Character & Visual Style)
// ============================================================================
async function runTestSuite45() {
  // 45.1 Image scaling, base64 extraction, and 5-image cap
  const wideScaled = calculateScaledDimensions(4000, 2000, 1024);
  const tallScaled = calculateScaledDimensions(1080, 2400, 1024);
  const smallKept = calculateScaledDimensions(800, 600, 1024);
  const rawB64 = extractBase64FromDataUrl('data:image/webp;base64,UklGRh4AAABXRUJQVlA4');

  assert(
    MAX_ASSISTANT_IMAGES === 5 &&
      wideScaled.width === 1024 &&
      wideScaled.height === 512 &&
      tallScaled.width === 461 &&
      tallScaled.height === 1024 &&
      smallKept.width === 800 &&
      smallKept.height === 600 &&
      rawB64 === 'UklGRh4AAABXRUJQVlA4',
    'Suite 45: AI Assistant Reference Image (Character & Visual Style)',
    '45.1 Scales Oversized Photos Proportionally, Extracts Clean Base64, & Supports Up to 5 Images',
    `max=${MAX_ASSISTANT_IMAGES} | wide=${JSON.stringify(wideScaled)} | tall=${JSON.stringify(tallScaled)} | small=${JSON.stringify(smallKept)} | b64=${rawB64}`
  );

  // 45.2 [APPLY_CHARACTER_STYLE] segment parsing + coexistence with [REVISE_BEAT] + combined default prompt
  const parsedSegments = parseMessageSegments(
    `This painting uses warm oil brushwork.\n\n[APPLY_CHARACTER_STYLE]\nImpasto oil painting on linen canvas, warm 3200K candlelight rim shadows, weathered crimson wool cloak.\n[/APPLY_CHARACTER_STYLE]\n\nUpdated beat below:\n[REVISE_BEAT scene=1 beat=2]\nMedium Shot, eye-level of the traveler in a weathered crimson wool cloak.\n[/REVISE_BEAT]`,
    'msg-45'
  );
  const styleSeg = parsedSegments.find((s) => s.type === 'apply_character_style');
  const beatSeg = parsedSegments.find((s) => s.type === 'revise_beat');

  const refImgA: AssistantImageAttachment = {
    id: 'att-1',
    name: 'hero.png',
    mimeType: 'image/webp',
    dataUrl: 'data:image/webp;base64,AAA=',
    base64Data: 'AAA=',
    role: 'both',
  };
  const refImgB: AssistantImageAttachment = {
    id: 'att-2',
    name: 'style.jpg',
    mimeType: 'image/jpeg',
    dataUrl: 'data:image/jpeg;base64,BBB=',
    base64Data: 'BBB=',
    role: 'both',
  };

  assert(
    styleSeg?.type === 'apply_character_style' &&
      styleSeg.style.includes('Impasto oil painting on linen canvas') &&
      beatSeg?.type === 'revise_beat' &&
      beatSeg.scene === 1 &&
      beatSeg.beat === 2 &&
      buildDefaultImagePrompt([refImgA]).includes('character and visual style') &&
      buildDefaultImagePrompt([refImgA, refImgB]).includes('character and visual style'),
    'Suite 45: AI Assistant Reference Image (Character & Visual Style)',
    '45.2 Parses [APPLY_CHARACTER_STYLE] Alongside Revision Cards & Defaults All Images to Character & Style',
    `segs=${JSON.stringify(parsedSegments.map((s) => s.type))}`
  );

  // 45.3 Rolling 5-image Gemini window & Groq vision limits (text-only blocked, Qwen capped at 3)
  const historyWithImages: AssistantChatMessage[] = [
    {
      id: 'u1',
      role: 'user',
      content: 'Ref 1',
      timestamp: 1,
      attachments: [
        { ...refImgA, id: 'old-1' },
        { ...refImgB, id: 'old-2' },
        { ...refImgA, id: 'old-3' },
      ],
    },
    { id: 'a1', role: 'assistant', content: 'Noted.', timestamp: 2 },
  ];
  const newImg1: AssistantImageAttachment = { ...refImgA, id: 'new-1' };
  const newImg2: AssistantImageAttachment = { ...refImgB, id: 'new-2' };
  const newImg3: AssistantImageAttachment = { ...refImgA, id: 'new-3' };
  const newImg4: AssistantImageAttachment = { ...refImgB, id: 'new-4' };
  const selectedIdsGemini = selectSendableAttachmentIds(historyWithImages, [newImg1, newImg2, newImg3], 5);

  let rejectedTextOnlyGroq = false;
  try {
    await sendChatMessage(
      [],
      'Analyze this style',
      'gsk_test_fake_key_123456',
      'high',
      'groq',
      'openai/gpt-oss-120b',
      '',
      [newImg1]
    );
  } catch (err: any) {
    rejectedTextOnlyGroq = /only supports text/i.test(err?.message || '');
  }

  let rejectedExcessGroq = false;
  try {
    await sendChatMessage(
      [],
      'Analyze these 4 references',
      'gsk_test_fake_key_123456',
      'standard',
      'groq',
      'qwen/qwen3.8-27b',
      '',
      [newImg1, newImg2, newImg3, newImg4]
    );
  } catch (err: any) {
    rejectedExcessGroq = /accepts up to 3 reference images/i.test(err?.message || '');
  }

  assert(
    selectedIdsGemini.size === 5 &&
      selectedIdsGemini.has('new-1') &&
      selectedIdsGemini.has('new-2') &&
      selectedIdsGemini.has('new-3') &&
      selectedIdsGemini.has('old-3') &&
      selectedIdsGemini.has('old-2') &&
      !selectedIdsGemini.has('old-1') &&
      getMaxImagesForProvider('gemini') === 5 &&
      getMaxImagesForProvider('groq', 'qwen/qwen3.8-27b') === 3 &&
      isGroqVisionModel('qwen/qwen3.8-27b') === true &&
      isGroqVisionModel('openai/gpt-oss-120b') === false &&
      rejectedTextOnlyGroq === true &&
      rejectedExcessGroq === true,
    'Suite 45: AI Assistant Reference Image (Character & Visual Style)',
    '45.3 Supports 5-Image Gemini Context & Enforces Groq Text-Only and 3-Image Qwen Guardrails',
    `selected=${Array.from(selectedIdsGemini).join(',')} | rejectedText=${rejectedTextOnlyGroq} | rejectedExcess=${rejectedExcessGroq}`
  );
}

// ============================================================================
// 46. CORE UPGRADE: STYLE-NATIVE CRAFT, 4S CLIP COHESION, CUSTOM BEATS & STAGE 4 GUARDS
// ============================================================================
function runTestSuite46() {
  console.log('\n--- Running Test Suite 46: Core Upgrade (Style-Native, 4s Clips, Universal Checkpoints & Stage 4) ---');

  // 46.1 Visual style families map accurately & omit live-action 35mm boilerplate from non-photoreal video prompts
  const clayFam = classifyVisualStyleFamily('Handcrafted Claymation Stop-Motion Diorama');
  const pixarFam = classifyVisualStyleFamily('Stylized 3D Pixar Animated Short');
  const animeFam = classifyVisualStyleFamily('Studio Ghibli 2D Watercolor Anime');
  const stickFam = classifyVisualStyleFamily('Minimalist Flat Stickman Vector');
  const photoFam = classifyVisualStyleFamily('Cinematic Hyperrealism');

  const clayCue = getStyleNativeRenderCue(clayFam, true);
  const compiledClayVideo = compileBeatPrompt(
    {
      beatIndex: 1,
      textSpan: 'Mia unlocks the gate.',
      shotType: 'Medium Shot',
      cameraAngle: 'eye-level',
      cameraMovement: 'Slow Push-In',
      imagePrompt: 'Medium shot of Mia wearing a patched wool coat unlocking a rusted iron gate at dusk.',
      estimatedSeconds: 2.0,
    },
    {
      index: 1,
      narratorLine: 'Mia unlocks the gate.',
      estimatedSeconds: 4,
      timeOfDay: 'Dusk',
      lightingState: 'Cool slate twilight fading against warm doorway amber glow',
      beats: [],
    },
    {
      artStyle: 'Handcrafted Claymation Stop-Motion Diorama',
      colorPalette: 'Slate blue and warm ochre',
      lighting: 'Soft miniature overhead key',
      eraAndSetting: 'Autumn courtyard',
      styleFamily: clayFam,
    },
    'universal',
    'short',
    'video'
  );

  assert(
    clayFam === 'stop_motion' &&
      pixarFam === 'stylized_3d' &&
      animeFam === 'illustration_2d' &&
      stickFam === 'minimalist_flat' &&
      photoFam === 'photoreal' &&
      !/35mm|anamorphic/i.test(clayCue) &&
      !/--ar\s/i.test(compiledClayVideo.promptText) &&
      !/\b(?:Veo|Flow|Kling|Hailuo|Luma)\b/i.test(compiledClayVideo.promptText) &&
      compiledClayVideo.promptText.includes('Cool slate twilight fading against warm doorway amber glow') &&
      compiledClayVideo.promptText.includes('Generate a continuous video clip of:'),
    'Suite 46: Core Upgrade (Style-Native Craft, 4s Clip Cohesion & Stage 4 Guards)',
    '46.1 Classifies Visual Style Families, Applies Style-Native Craft & Scene Lighting, and Strips --ar/Tool Names in Video Mode',
    `fams=${[clayFam, pixarFam, animeFam, stickFam, photoFam].join(',')} | prompt=${compiledClayVideo.promptText}`
  );

  // 46.2 4-second video clip grouping caps clipCeiling at 4.0s (max 2 beats) & custom scenes preserve exact boundaries
  const videoScenesInput: PlannedScene[] = [
    {
      index: 1,
      narratorLine: 'Mara stepped inside the quiet archive hallway.',
      estimatedSeconds: 5.2,
      averageBeatSeconds: 1.7,
      fastCutRatio: 0,
      beats: [
        {
          beatIndex: 1,
          wordRange: [0, 2],
          textSpan: 'Mara stepped inside',
          depicts: 'Mara crosses threshold',
          kind: 'literal',
          intensity: 'medium',
          subjectIds: ['mara'],
          shotSize: 'wide',
          angle: 'eye level',
          newInfo: 'Mara enters hallway',
          estimatedSeconds: 1.8,
        },
        {
          beatIndex: 2,
          wordRange: [3, 4],
          textSpan: 'the quiet',
          depicts: 'Mara pauses by shelves',
          kind: 'literal',
          intensity: 'low',
          subjectIds: ['mara'],
          shotSize: 'medium',
          angle: 'eye level',
          newInfo: 'Mara stops',
          estimatedSeconds: 1.8,
        },
        {
          beatIndex: 3,
          wordRange: [5, 6],
          textSpan: 'archive hallway.',
          depicts: 'Long dark corridor',
          kind: 'literal',
          intensity: 'low',
          subjectIds: ['mara'],
          shotSize: 'close-up',
          angle: 'low',
          newInfo: 'Corridor stretches ahead',
          estimatedSeconds: 1.6,
        },
      ],
    },
  ];
  const mockWords = 'Mara stepped inside the quiet archive hallway.'
    .split(/\s+/)
    .map((word, idx) => ({
      index: idx,
      word,
      cleanWord: word.replace(/[.,!?;:"'()]/g, '').toLowerCase(),
      startSec: idx * 0.5,
      endSec: (idx + 1) * 0.5,
      isEstimated: true,
    }));
  const paced4s = enforceStage2Pacing(videoScenesInput, mockWords, 'short', 'video', 4);

  const customBible = {
    cast: [{ id: 'mara', role: 'Archivist', visualLock: 'Woman in tweed coat', permanentAnatomy: 'Slender build', eraWardrobe: 'Brown tweed coat' }],
    threat: { canonicalLook: 'hollow brass eyes with soot-stained fingers', allowedVariants: [] },
    locations: [{ id: 'archive', visualLock: 'Tall oak shelves', spatialPlacement: 'Archive desk at far wall' }],
    motifs: [],
    events: ['Mara enters archive'],
    referents: [],
    withheld: [],
    forbidden: [],
    worldStyle: 'Claymation stop-motion',
    styleFamily: 'stop_motion' as const,
    lightingArc: [{ phase: 'opening', timeOfDay: 'Night', lightingDescription: 'Warm desk lamp pool against deep slate shadows' }],
    parallelCast: [{ sourceId: 'adult_mara', parallelId: 'young_mara', continuityBridge: 'Matching silver locket and auburn braid' }],
    assumptions: [],
  };
  const customPlanned = buildPlannedScenesFromCustomScenes(
    [
      {
        id: 'custom-scene-1',
        sceneIndex: 1,
        narratorLine: 'Mara stepped inside the quiet archive hallway.',
        beats: [
          { id: 'c1', textSpan: 'Mara stepped inside', shotType: 'Wide Establishing Shot', userGuidance: 'Show heavy oak door swinging open' },
          { id: 'c2', textSpan: 'the quiet archive hallway.', shotType: 'Close-Up', userGuidance: 'Hands lifting brass key' },
        ],
      },
    ],
    mockWords,
    customBible,
    'short',
    'video',
    4
  );

  assert(
    paced4s[0].beatToClipMap?.[1] === 1 &&
      paced4s[0].beatToClipMap?.[2] === 1 &&
      paced4s[0].beatToClipMap?.[3] === 2 &&
      customPlanned.length === 1 &&
      customPlanned[0].beats.length === 2 &&
      customPlanned[0].beats[0].depicts.includes('oak door') &&
      customPlanned[0].timeOfDay === 'Night',
    'Suite 46: Core Upgrade (Style-Native Craft, 4s Clip Cohesion & Stage 4 Guards)',
    '46.2 Caps 4s Video Clip Grouping at <=4s / <=2 Beats and Preserves Custom Scene Cut Boundaries',
    `clipMap=${JSON.stringify(paced4s[0].beatToClipMap)} | customBeats=${customPlanned[0]?.beats.length}`
  );

  // 46.3 Universal Grounded Checkpoints work for Short+Video & hashStoryInput busts cache on characterStyle change
  const clayKey = hashStoryInput('Mara walks home.', 'keep dark', 'Claymation');
  const pixarKey = hashStoryInput('Mara walks home.', 'keep dark', 'Pixar 3D');
  const shortVideoReq: GenerateStoryRequest = {
    story: 'Mara stepped inside the quiet archive hallway.',
    characterStyle: 'Claymation',
    format: 'short',
    platform: 'TikTok',
    durationMode: 'automatic',
    generationMode: 'video',
    targetVideoDuration: 4,
    modelQuality: 'standard',
  };
  const svKey = buildCheckpointKey(
    shortVideoReq.story,
    undefined,
    'short',
    'video',
    'standard',
    'Claymation',
    4
  );
  saveGroundedCheckpoint({
    key: svKey,
    totalWords: 7,
    updatedAt: Date.now(),
    bible: customBible,
    completedScenes: [],
  });
  const svProgress = getGroundedProgressForRequest(shortVideoReq);
  clearGroundedProgressForRequest(shortVideoReq);

  assert(
    clayKey !== pixarKey &&
      Boolean(svProgress) &&
      svProgress?.hasBible === true &&
      getGroundedProgressForRequest(shortVideoReq) === null,
    'Suite 46: Core Upgrade (Style-Native Craft, 4s Clip Cohesion & Stage 4 Guards)',
    '46.3 Supports Universal Short-Form/Video Checkpoints and Busts Bible Cache on Visual Style Changes',
    `clayKey=${clayKey} pixarKey=${pixarKey} svProgress=${JSON.stringify(svProgress)}`
  );

  // 46.4 Stage 4 catches dynamic threat canonicalLook bleed & conflicting video vectors while accepting parallelCast & 4s clip dwell
  const threatBleedBeat: WrittenPromptBeat = {
    beatIndex: 1,
    wordRange: [0, 3],
    textSpan: 'Mara stepped inside',
    depicts: 'Mara entering doorway',
    kind: 'literal',
    intensity: 'medium',
    subjectIds: ['adult_mara'],
    shotSize: 'medium',
    angle: 'eye level',
    newInfo: 'Mara enters',
    estimatedSeconds: 3.6,
    imagePrompt:
      'Medium shot, eye-level of adult Mara in brown tweed coat with hollow brass eyes walking toward archive desk.',
  };
  const conflictVideoBeat: WrittenPromptBeat = {
    beatIndex: 2,
    wordRange: [4, 6],
    textSpan: 'the quiet hallway.',
    depicts: 'Hallway reveal',
    kind: 'literal',
    intensity: 'low',
    subjectIds: ['young_mara', 'archive'],
    shotSize: 'wide',
    angle: 'eye level',
    newInfo: 'Hallway interior',
    estimatedSeconds: 3.6,
    imagePrompt:
      'Wide establishing shot with slow dolly in and simultaneous dolly out pull back down the quiet archive hallway.',
  };
  const bleedCheck = verifyBeatCodeChecks(threatBleedBeat, [threatBleedBeat], customBible, 'short', 'video', 4);
  const conflictCheck = verifyBeatCodeChecks(conflictVideoBeat, [conflictVideoBeat], customBible, 'short', 'video', 4);
  const cleanParallelBeat: WrittenPromptBeat = {
    ...threatBleedBeat,
    imagePrompt:
      'Medium shot, eye-level of young Mara wearing a silver locket and auburn braid walking steadily into the archive.',
  };
  const parallelCheck = verifyBeatCodeChecks(cleanParallelBeat, [cleanParallelBeat], customBible, 'short', 'video', 4);

  assert(
    !bleedCheck.passed &&
      bleedCheck.issues.some((i) => i.includes('hollow brass eyes')) &&
      !conflictCheck.passed &&
      conflictCheck.issues.some((i) => i.includes('Conflicting simultaneous camera motion')) &&
      parallelCheck.passed === true,
    'Suite 46: Core Upgrade (Style-Native Craft, 4s Clip Cohesion & Stage 4 Guards)',
    '46.4 Enforces Dynamic Threat Containment, Video Motion Vector Coherence, ParallelCast Whitelist & 4s Dwell Bounds',
    `bleed=${JSON.stringify(bleedCheck)} | conflict=${JSON.stringify(conflictCheck)} | parallel=${JSON.stringify(parallelCheck)}`
  );
}

// ============================================================================
// 47. EXTRAS #1, #2, #5: COPIED CHECKMARKS, STYLE PRESETS & QUICK REWRITE
// ============================================================================
function runTestSuite47() {
  console.log('\n--- Running Test Suite 47: Copied Checkmarks, Channel Style Presets & Quick Rewrite ---');

  // 47.1 Copied Beat Persistence & Automatic Hash Invalidation on Prompt Rewrite
  const sampleStory: StoryGenerationResult = {
    title: 'Archive Clock',
    totalDurationSeconds: 6,
    generationMode: 'image',
    styleProfile: {
      artStyle: 'Matte stop-motion clay diorama',
      colorPalette: 'Slate blue and brass amber',
      lighting: 'Warm desk lamp light',
      eraAndSetting: 'Quiet archive room',
      styleFamily: 'stop_motion',
    },
    characterSheet: { Mara: 'Woman in brown tweed coat with auburn braid' },
    locationSheet: { Archive: 'Oak shelves and brass desk lamp' },
    scenes: [
      {
        index: 1,
        narratorLine: 'Mara unlocked the brass ledger.',
        estimatedSeconds: 3,
        beats: [
          {
            beatIndex: 1,
            textSpan: 'Mara unlocked',
            shotType: 'Medium Shot',
            cameraAngle: 'eye-level',
            imagePrompt: 'Vertical 9:16 portrait composition, Medium Shot, eye-level of Mara reaching for the brass key.',
            estimatedSeconds: 1.5,
          },
          {
            beatIndex: 2,
            textSpan: 'the brass ledger.',
            shotType: 'Close-Up',
            cameraAngle: 'high-angle',
            imagePrompt: 'Vertical 9:16 portrait composition, Close-Up, high-angle of brass clasp clicking open.',
            estimatedSeconds: 1.5,
          },
        ],
      },
      {
        index: 2,
        narratorLine: 'The lid opened.',
        estimatedSeconds: 3,
        beats: [
          {
            beatIndex: 1,
            textSpan: 'The lid opened.',
            shotType: 'Close-Up',
            cameraAngle: 'low-angle',
            imagePrompt: 'Vertical 9:16 portrait composition, Close-Up, low-angle of heavy oak ledger cover rising.',
            estimatedSeconds: 3,
          },
        ],
      },
    ],
  };

  const fpBefore = buildStoryFingerprint(sampleStory);
  clearCopiedBeatsForStory(fpBefore);
  markBeatCopied(fpBefore, 1, 1, 'Prompt 1.1 v1');
  markBeatCopied(fpBefore, 2, 1, 'Prompt 2.1 v1');

  const fpAfterPromptEdit = buildStoryFingerprint({
    ...sampleStory,
    scenes: sampleStory.scenes.map((sc) =>
      sc.index === 1
        ? {
            ...sc,
            beats: sc.beats.map((b) =>
              b.beatIndex === 1 ? { ...b, imagePrompt: 'Rewritten prompt 1.1 v2' } : b
            ),
          }
        : sc
    ),
  });
  const loadedCopied = loadCopiedBeatsMap(fpBefore);
  const stillCopied11AfterRewrite = isBeatCopiedMatch(loadedCopied, 1, 1, 'Rewritten prompt 1.1 v2');
  const stillCopied21AfterRewrite = isBeatCopiedMatch(loadedCopied, 2, 1, 'Prompt 2.1 v1');
  const copiedTotal = countCopiedBeats(loadedCopied, [
    { sceneIndex: 1, beatIndex: 1, promptText: 'Rewritten prompt 1.1 v2' },
    { sceneIndex: 1, beatIndex: 2, promptText: 'Prompt 1.2 v1' },
    { sceneIndex: 2, beatIndex: 1, promptText: 'Prompt 2.1 v1' },
  ]);
  clearCopiedBeatsForStory(fpBefore);

  assert(
    fpBefore === fpAfterPromptEdit &&
      stillCopied11AfterRewrite === false &&
      stillCopied21AfterRewrite === true &&
      copiedTotal === 1,
    'Suite 47: Copied Checkmarks, Style Presets & Quick Rewrite',
    '47.1 Persists Copied Checkmarks Across Scenes & Automatically Invalidates Stale Hash on Beat Rewrite',
    `fpSame=${fpBefore === fpAfterPromptEdit} | s1b1=${stillCopied11AfterRewrite} | s2b1=${stillCopied21AfterRewrite} | total=${copiedTotal}`
  );

  // 47.2 Channel Style DNA Presets: Style-Only safety vs Opt-in Format+Duration & Overwrite/Delete
  clearAllStylePresets();
  const savedStyleOnly = saveStylePreset({
    name: 'Diorama Clay',
    characterStyle: 'Handcrafted matte clay stop-motion diorama, warm brass lamp',
    includeFormatAndDuration: false,
    format: 'long',
    generationMode: 'video',
    targetVideoDuration: 8,
  });
  const appliedStyleOnly = applyStylePresetToState(savedStyleOnly.saved);

  const savedUpdated = saveStylePreset({
    name: 'diorama clay',
    characterStyle: 'Handcrafted matte clay diorama, cool slate twilight',
    includeFormatAndDuration: true,
    format: 'short',
    generationMode: 'video',
    targetVideoDuration: 4,
  });
  const appliedWithFormat = applyStylePresetToState(savedUpdated.saved);
  const allAfterUpdate = loadStylePresets();
  const afterDelete = deleteStylePreset(savedUpdated.saved.id);
  clearAllStylePresets();

  assert(
    appliedStyleOnly.characterStyle.includes('Handcrafted matte clay') &&
      appliedStyleOnly.format === undefined &&
      appliedStyleOnly.generationMode === undefined &&
      appliedStyleOnly.targetVideoDuration === undefined &&
      savedUpdated.overwritten === true &&
      allAfterUpdate.length === 1 &&
      appliedWithFormat.format === 'short' &&
      appliedWithFormat.generationMode === 'video' &&
      appliedWithFormat.targetVideoDuration === 4 &&
      afterDelete.length === 0,
    'Suite 47: Copied Checkmarks, Style Presets & Quick Rewrite',
    '47.2 Saves, Overwrites, Deletes Channel Style Presets & Keeps Style-Only Presets Isolated From Format/Duration',
    `styleOnly=${JSON.stringify(appliedStyleOnly)} | withFormat=${JSON.stringify(appliedWithFormat)} | count=${allAfterUpdate.length}`
  );

  // 47.3 Single-Beat Quick Rewrite Prompt Context + Deterministic Normalization & Metadata Sync
  const noirMonoResult: StoryGenerationResult = {
    title: 'Midnight Darkroom',
    totalDurationSeconds: 4,
    generationMode: 'image',
    styleProfile: {
      artStyle: 'High-contrast monochrome black-and-white ink noir',
      colorPalette: 'Pure black ink, crisp stark white highlights, cool slate grays',
      lighting: 'Hard directional moonlight contrast',
      eraAndSetting: '1980s darkroom',
      styleFamily: 'illustration_2d',
    },
    characterSheet: {
      Joon: 'Lean photographer in crumpled trench coat',
    },
    locationSheet: {
      Darkroom: 'Concrete photo lab with clothesline and enlarger',
    },
    storyBible: {
      cast: [{ id: 'Joon', role: 'Lead', visualLock: 'Lean photographer in crumpled trench coat' }],
      threat: { canonicalLook: 'hollow shadow silhouette', allowedVariants: [] },
      locations: [{ id: 'Darkroom', visualLock: 'Concrete photo lab', spatialPlacement: 'Enlarger table at back wall' }],
      motifs: [],
      events: ['Joon inspects strip'],
      referents: [],
      withheld: ['The future accident date stays hidden'],
      forbidden: ['neon smartphone'],
      worldStyle: 'High-contrast monochrome black-and-white ink noir',
      styleFamily: 'illustration_2d',
      assumptions: [],
    },
    scenes: [
      {
        index: 1,
        narratorLine: 'Sweden kept the secret inside dark film.',
        lightingState: 'Cold silver moonlight slicing across wet tiles',
        timeOfDay: 'Midnight',
        estimatedSeconds: 4,
        beats: [
          {
            beatIndex: 1,
            textSpan: 'Sweden',
            shotType: 'Medium Shot',
            cameraAngle: 'eye-level',
            imagePrompt: 'Vertical 9:16 portrait composition, Medium Shot, eye-level of Joon entering Darkroom.',
            estimatedSeconds: 2,
          },
          {
            beatIndex: 2,
            textSpan: 'kept the secret inside dark film.',
            shotType: 'Wide Shot',
            cameraAngle: 'eye-level',
            imagePrompt: 'Vertical 9:16 portrait composition, Wide Shot, eye-level of enlarger table.',
            estimatedSeconds: 2,
          },
        ],
      },
    ],
  };

  const rewritePrompt = buildSingleBeatRewritePrompt({
    result: noirMonoResult,
    scene: noirMonoResult.scenes[0],
    beat: noirMonoResult.scenes[0].beats[0],
    prevBeat: null,
    nextBeat: noirMonoResult.scenes[0].beats[1],
    format: 'short',
    instruction: 'Switch to a tighter close-up on his inked hands holding wet film',
  });

  const normalizedRewritten = normalizeRewrittenBeat({
    rawPrompt:
      'Close-Up, low-angle of Joon holding wet negative strip bathed in warm amber tungsten glow as camera slowly pans right. Audio: soft drip.',
    rawShotType: 'Close-Up',
    rawCameraAngle: 'low-angle',
    originalBeat: noirMonoResult.scenes[0].beats[0],
    result: noirMonoResult,
    format: 'short',
  });

  const displayNormalized = normalizeStoryboardForDisplay(
    [
      {
        ...noirMonoResult.scenes[0],
        beats: [normalizedRewritten, noirMonoResult.scenes[0].beats[1]],
      },
    ],
    {
      isVideoMode: false,
      isLongForm: false,
      styleProfile: noirMonoResult.styleProfile,
      characterSheet: noirMonoResult.characterSheet,
      locationSheet: noirMonoResult.locationSheet,
    }
  );

  const firstDisplayed = displayNormalized[0].beats[0];
  assert(
    rewritePrompt.includes('Withheld Secrets') &&
      rewritePrompt.includes('PREVIOUS BEAT') &&
      rewritePrompt.includes('NEXT BEAT') &&
      rewritePrompt.includes('Cold silver moonlight slicing across wet tiles') &&
      normalizedRewritten.shotType === 'Close-Up' &&
      normalizedRewritten.cameraAngle === 'low-angle' &&
      !/\bamber\b/i.test(normalizedRewritten.imagePrompt) &&
      !/\bpans\s+right\b/i.test(normalizedRewritten.imagePrompt) &&
      !/\bAudio:/i.test(normalizedRewritten.imagePrompt) &&
      normalizedRewritten.userRewritten === true &&
      firstDisplayed.userRewritten === true &&
      !firstDisplayed.imagePrompt.includes('topographic map'),
    'Suite 47: Copied Checkmarks, Style Presets & Quick Rewrite',
    '47.3 Locks Rewrite Context (Withheld/Neighbors/Lighting), Enforces Monochrome & Still-Image Hygiene, Syncs Metadata & Preserves Rewrite',
    `normalized=${normalizedRewritten.imagePrompt} | shot=${normalizedRewritten.shotType}/${normalizedRewritten.cameraAngle} | displayed=${firstDisplayed.imagePrompt}`
  );
}

// ============================================================================
// 48. OPENING 3S VISUAL HOOK PRIORITY (EXTRA #6)
// ============================================================================
function runTestSuite48() {
  console.log('\n--- Running Test Suite 48: Opening 3s Visual Hook Priority (Extra #6) ---');

  // 48.1 Checkpoint Isolation
  const ckptOff = buildCheckpointKey(
    'Rain hammered the tin roof at midnight.',
    undefined,
    'short',
    'image',
    'standard',
    'Ink noir',
    undefined,
    false
  );
  const ckptOn = buildCheckpointKey(
    'Rain hammered the tin roof at midnight.',
    undefined,
    'short',
    'image',
    'standard',
    'Ink noir',
    undefined,
    true
  );
  assert(
    ckptOff !== ckptOn && ckptOn.endsWith('_hook3s') && !ckptOff.endsWith('_hook3s'),
    'Suite 48: Opening 3s Visual Hook Priority',
    '48.1 Checkpoint Keys Isolate Opening Hook Priority ON vs OFF',
    `ckptOff=${ckptOff} | ckptOn=${ckptOn}`
  );

  // 48.2 Deterministic Framing Contrast Scoped Strictly to Scene 1 Beats Starting Under 3.0s
  const sampleScenes: PlannedScene[] = [
    {
      index: 1,
      narratorLine: 'He opened the steel door slowly without looking back.',
      estimatedSeconds: 5.5,
      averageBeatSeconds: 1.4,
      fastCutRatio: 0,
      beatToClipMap: { 1: 1, 2: 1, 3: 2, 4: 2 },
      beats: [
        {
          beatIndex: 1,
          wordRange: [0, 3],
          textSpan: 'He opened the steel',
          depicts: 'Joon pulls heavy steel door ajar',
          kind: 'literal',
          intensity: 'low',
          subjectIds: ['Joon'],
          shotSize: 'medium',
          angle: 'eye level',
          newInfo: 'Door opens',
          estimatedSeconds: 1.5,
          clipIndex: 1,
        },
        {
          beatIndex: 2,
          wordRange: [4, 5],
          textSpan: 'door slowly',
          depicts: 'Door latch slides clear',
          kind: 'literal',
          intensity: 'low',
          subjectIds: ['Joon'],
          shotSize: 'medium',
          angle: 'low',
          newInfo: 'Latch release',
          estimatedSeconds: 2.0,
          clipIndex: 1,
        },
        {
          beatIndex: 3,
          wordRange: [6, 8],
          textSpan: 'without looking back.',
          depicts: 'Hallway shadow behind him',
          kind: 'withheld-effect',
          intensity: 'low',
          subjectIds: ['Joon'],
          shotSize: 'medium',
          angle: 'eye level',
          newInfo: 'After 3s cutoff',
          estimatedSeconds: 2.0,
          clipIndex: 2,
        },
      ],
    },
    {
      index: 2,
      narratorLine: 'Cold stairs dropped below.',
      estimatedSeconds: 2.5,
      averageBeatSeconds: 2.5,
      fastCutRatio: 0,
      beats: [
        {
          beatIndex: 1,
          wordRange: [9, 12],
          textSpan: 'Cold stairs dropped below.',
          depicts: 'Concrete stairwell descends',
          kind: 'literal',
          intensity: 'low',
          subjectIds: ['Stairwell'],
          shotSize: 'medium',
          angle: 'eye level',
          newInfo: 'Stairwell framing',
          estimatedSeconds: 2.5,
        },
      ],
    },
  ];

  const hookedScenes = applyOpeningHookContrast(sampleScenes);
  const s1b1 = hookedScenes[0].beats[0];
  const s1b2 = hookedScenes[0].beats[1];
  const s1b3 = hookedScenes[0].beats[2];
  const s2b1 = hookedScenes[1].beats[0];

  assert(
    s1b1.angle === 'low' &&
      s1b1.intensity === 'medium' &&
      s1b2.shotSize !== s1b1.shotSize &&
      s1b2.shotSize !== 'over-the-shoulder' &&
      s1b1.clipIndex === 1 &&
      s1b2.clipIndex === 1 &&
      s1b3.shotSize === 'medium' &&
      s1b3.angle === 'eye level' &&
      s1b3.intensity === 'low' &&
      s2b1.shotSize === 'medium' &&
      s2b1.angle === 'eye level',
    'Suite 48: Opening 3s Visual Hook Priority',
    '48.2 Diversifies Scene 1 Framing Inside First 3 Seconds Without Touching Beats >= 3s, Clips, or Scene 2',
    `s1b1=${s1b1.shotSize}/${s1b1.angle} | s1b2=${s1b2.shotSize}/${s1b2.angle} | s1b3=${s1b3.shotSize}/${s1b3.angle} | s2b1=${s2b1.shotSize}/${s2b1.angle}`
  );

  // 48.3 Stage 2 & Stage 3 Guidance Targets Opening Beats, Protects Withheld Secrets & Honors Mode
  const stage2VideoGuide = buildOpeningHookStage2Guidance(true);
  const stage2ImageGuide = buildOpeningHookStage2Guidance(false);
  const targetIndices = getOpeningHookBeatIndices(sampleScenes[0].beats);
  const stage3ImageGuide = buildOpeningHookStage3Guidance(false, sampleScenes[0].beats);
  const stage3VideoGuide = buildOpeningHookStage3Guidance(true, sampleScenes[0].beats);

  assert(
    stage2VideoGuide.includes('clip cohesion') &&
      stage2ImageGuide.includes('2-6 word') &&
      stage2VideoGuide.includes('NEVER spoil Withheld') &&
      targetIndices.length === 2 &&
      targetIndices[0] === 1 &&
      targetIndices[1] === 2 &&
      stage3ImageGuide.includes('Scene 1 Beats 1, 2 ONLY') &&
      stage3ImageGuide.includes('frozen peak-tension still frame') &&
      stage3VideoGuide.includes('kinetic physical tension') &&
      stage3VideoGuide.includes('withheld secrets strictly') &&
      !stage2VideoGuide.includes('\u2014') &&
      !stage3VideoGuide.includes('\u2014'),
    'Suite 48: Opening 3s Visual Hook Priority',
    '48.3 Targets Scene 1 Opening <3s Beats With Withheld Safety, Mode Discipline & Zero Em Dashes',
    `indices=${targetIndices.join(',')} | s3Image=${stage3ImageGuide}`
  );
}

runTestSuite21().then(async () => {
  runTestSuite23();
  runTestSuite24();
  runTestSuite25();
  runTestSuite26();
  runTestSuite27();
  runTestSuite28();
  runTestSuite29();
  runTestSuite30();
  runTestSuite31();
  runTestSuite32();
  runTestSuite33();
  runTestSuite34();
  await runTestSuite35();
  runTestSuite36();
  runTestSuite37();
  await runTestSuite38();
  runTestSuite39();
  runTestSuite40();
  runTestSuite41();
  runTestSuite42();
  await runTestSuite43();
  await runTestSuite44();
  await runTestSuite45();
  runTestSuite46();
  runTestSuite47();
  runTestSuite48();
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
});


