/**
 * Stage 4: Verification, Repair & Critic Pipeline
 * Runs 7 deterministic code checks on all generated beats,
 * repairs failing beats individually up to 2 times,
 * and performs an independent critic call per scene.
 */

import { StoryBible, AiProvider, GenerationMode, GeminiModelQuality } from '../types';
import { WrittenPromptBeat } from './stage3PromptWriter';
import { callGroqChatCompletion } from './groqClient';
import { executeGeminiSchemaCall } from './unifiedAiService';

export interface BeatCheckResult {
  passed: boolean;
  issues: string[];
}

export const BANNED_TEXT_WORDS = [
  'quote',
  'quotation',
  'subtitles',
  'subtitle',
  'caption',
  'captions',
  'on-screen',
  'onscreen',
  'typography',
  'signage',
  'lettering',
  'overlay text',
  'reading "',
  'words "',
  'text "',
];

/**
 * Creates 4-word shingles from a string for similarity testing
 */
export function getFourWordShingles(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  const shingles = new Set<string>();
  for (let i = 0; i <= words.length - 4; i++) {
    shingles.add(words.slice(i, i + 4).join(' '));
  }
  return shingles;
}

/**
 * Calculates Jaccard similarity between two sets of shingles
 */
export function calculateShingleOverlap(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const s of setA) {
    if (setB.has(s)) intersection++;
  }
  return intersection / Math.min(setA.size, setB.size);
}

/**
 * Check 1: Narration word coverage
 */
export function verifyWordCoverage(beats: WrittenPromptBeat[], totalWordCount: number): BeatCheckResult {
  const issues: string[] = [];
  if (beats.length === 0) {
    return { passed: false, issues: ['No beats provided for scene'] };
  }

  for (let i = 0; i < beats.length; i++) {
    const b = beats[i];
    if (i === 0 && b.wordRange[0] !== 0) {
      issues.push(`First beat does not start at word index 0 (starts at ${b.wordRange[0]})`);
    }
    if (i > 0) {
      const prev = beats[i - 1];
      if (b.wordRange[0] !== prev.wordRange[1] + 1) {
        issues.push(`Gap or overlap between Beat ${prev.beatIndex} (end: ${prev.wordRange[1]}) and Beat ${b.beatIndex} (start: ${b.wordRange[0]})`);
      }
    }
  }

  const lastBeat = beats[beats.length - 1];
  if (lastBeat.wordRange[1] !== totalWordCount - 1) {
    issues.push(`Final beat does not end at word index ${totalWordCount - 1} (ends at ${lastBeat.wordRange[1]})`);
  }

  return { passed: issues.length === 0, issues };
}

/**
 * Check 2: Quotation marks, 3-word n-gram narration overlap, and banned text keywords
 */
export function verifyTextLeaks(beat: WrittenPromptBeat): BeatCheckResult {
  const issues: string[] = [];
  const prompt = beat.imagePrompt || '';

  // Quotation marks check
  if (prompt.includes('"') || prompt.includes('“') || prompt.includes('”')) {
    issues.push(`Contains quotation marks in prompt text`);
  }

  // Banned text words check
  const lowerPrompt = prompt.toLowerCase();
  for (const banned of BANNED_TEXT_WORDS) {
    if (lowerPrompt.includes(banned)) {
      issues.push(`Contains banned text-inducing keyword: "${banned}"`);
    }
  }

  // 3-word run from spoken clause check
  const spokenWords = beat.textSpan
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);

  for (let i = 0; i <= spokenWords.length - 3; i++) {
    const trigram = spokenWords.slice(i, i + 3).join(' ');
    // Filter out common connective trigrams like "in the middle"
    const commonConnectives = new Set(['in the middle', 'at the edge', 'of the church', 'on the ground']);
    if (!commonConnectives.has(trigram) && lowerPrompt.includes(trigram)) {
      issues.push(`Contains 3-consecutive-word spoken narration leak: "${trigram}"`);
      break;
    }
  }

  // No raw digits in image prompt if present in overlay
  if (beat.overlayText) {
    const digitMatch = beat.overlayText.match(/\d+/g);
    if (digitMatch) {
      for (const d of digitMatch) {
        if (prompt.includes(d)) {
          issues.push(`Prompt mentions digit sequence "${d}" which belongs solely in overlayText`);
        }
      }
    }
  }

  return { passed: issues.length === 0, issues };
}

/**
 * Check 3: Subject presence and valid sentence openings
 */
export function verifySubjectAndGrammar(beat: WrittenPromptBeat, bible: StoryBible): BeatCheckResult {
  const issues: string[] = [];
  const prompt = (beat.imagePrompt || '').trim();

  if (!prompt) {
    return { passed: false, issues: ['Prompt is completely empty'] };
  }

  // Starts with lowercase check
  if (/^[a-z]/.test(prompt)) {
    issues.push('Prompt starts with a lowercase letter');
  }

  // Checks for bare pronoun or detached body part opening
  const badOpenings = [
    /^(?:his|her|their|its)\s+(?:bare\s+)?(?:feet|hands|shoulders|arms|face|eyes|fingers|back)\b/i,
    /^(?:shoulders|hands|feet|arms|face|eyes)\s+(?:slumped|reaching|twisted|frozen)\b/i,
    /^(?:he|she|they|it)\s+(?:stands|kneels|looks|walks|reaches)\b/i,
  ];

  for (const pattern of badOpenings) {
    if (pattern.test(prompt)) {
      issues.push('Prompt starts with a bare pronoun or detached body part instead of a grounded subject');
    }
  }

  return { passed: issues.length === 0, issues };
}

/**
 * Check 4: Near-duplicate check with scene beats
 */
export function verifyNearDuplicates(
  beat: WrittenPromptBeat,
  allSceneBeats: WrittenPromptBeat[]
): BeatCheckResult {
  const issues: string[] = [];
  const thisShingles = getFourWordShingles(beat.imagePrompt);

  for (const other of allSceneBeats) {
    if (other.beatIndex === beat.beatIndex) continue;
    const otherShingles = getFourWordShingles(other.imagePrompt);
    const overlap = calculateShingleOverlap(thisShingles, otherShingles);
    if (overlap >= 0.5) {
      issues.push(
        `High 4-word shingle similarity (${Math.round(overlap * 100)}%) with Beat ${other.beatIndex}`
      );
    }
  }

  return { passed: issues.length === 0, issues };
}

/**
 * Check 5: Entity Whitelist & Forbidden Anachronisms
 */
export function verifyForbiddenElements(beat: WrittenPromptBeat, bible: StoryBible): BeatCheckResult {
  const issues: string[] = [];
  const lowerPrompt = beat.imagePrompt.toLowerCase();

  // Forbidden terms from bible
  for (const forbidden of bible.forbidden) {
    const cleanForbidden = forbidden.toLowerCase().trim();
    if (cleanForbidden && lowerPrompt.includes(cleanForbidden)) {
      issues.push(`Contains forbidden element or anachronism: "${forbidden}"`);
    }
  }

  // Detect unstated common inventions
  const knownInventions = [
    '20-foot clawed shadow',
    'clawed shadow',
    'black vortex',
    'vortex of shadow',
    'demonic silhouette',
    'chalked plague cross',
    'bottle-glass',
  ];
  for (const inv of knownInventions) {
    if (lowerPrompt.includes(inv)) {
      issues.push(`Contains unstated invented trope: "${inv}"`);
    }
  }

  return { passed: issues.length === 0, issues };
}

function extractDynamicThreatKeywords(bible: StoryBible): string[] {
  const baseline = ['glowing amber eyes', 'cracked parchment skin', 'black ink veins', 'ink veins'];
  const canonical = (bible.threat?.canonicalLook || '').toLowerCase();
  if (!canonical) return baseline;

  const castText = (bible.cast || []).map((c) => c.visualLock.toLowerCase()).join(' | ');
  const dynamic = canonical
    .split(/[,;.]|\band\b|\bwith\b/i)
    .map((part) => part.trim().replace(/^a\s+|^an\s+|^the\s+/i, ''))
    .filter((part) => part.split(/\s+/).length >= 2 && part.length >= 8 && !castText.includes(part));

  return Array.from(new Set([...baseline, ...dynamic]));
}

/**
 * Check 6: Style Bleed & Threat Containment
 */
export function verifyStyleBleed(beat: WrittenPromptBeat, bible: StoryBible): BeatCheckResult {
  const issues: string[] = [];
  const lowerPrompt = beat.imagePrompt.toLowerCase();
  const hasThreatInSubjects = (beat.subjectIds || []).some((id) =>
    id.toLowerCase().includes('threat') || id.toLowerCase().includes('monster') || id.toLowerCase().includes('dead')
  );

  // Threat keywords extracted from threat canonicalLook plus baseline leak checks
  const threatKeywords = extractDynamicThreatKeywords(bible);
  for (const kw of threatKeywords) {
    if (lowerPrompt.includes(kw) && !hasThreatInSubjects) {
      issues.push(`Threat visual feature "${kw}" bled into a non-threat beat`);
    }
  }

  // Fake precision check
  if (/\b\d{3,4}\s*K\b/i.test(beat.imagePrompt)) {
    issues.push('Contains fake precision Kelvin lighting value');
  }
  if (/\b\d+%\s*(?:weight|fill|key)\b/i.test(beat.imagePrompt)) {
    issues.push('Contains fake precision percentage');
  }
  if (/\b\d+[- ]degree\b/i.test(beat.imagePrompt)) {
    issues.push('Contains fake precision degree angle');
  }

  return { passed: issues.length === 0, issues };
}

export function verifyShotLabelMatch(
  beat: WrittenPromptBeat,
  generationMode: GenerationMode = 'image'
): BeatCheckResult {
  const issues: string[] = [];
  const lowerPrompt = beat.imagePrompt.toLowerCase();
  const shotSize = (beat.shotSize || '').toLowerCase();

  // OTS requires at least two subjects
  if ((shotSize.includes('over-the-shoulder') || shotSize.includes('ots')) && (beat.subjectIds || []).length < 2) {
    issues.push('Over-the-shoulder (OTS) shot requires at least two people/subjects in metadata');
  }

  // Contradiction checks
  if (shotSize.includes('wide') && (lowerPrompt.includes('extreme close-up') || lowerPrompt.includes('tight facial detail'))) {
    issues.push('Shot label "wide" contradicts tight close-up language in prompt');
  }
  if ((shotSize.includes('close-up') || shotSize.includes('macro')) && lowerPrompt.includes('wide panoramic establishing')) {
    issues.push('Shot label "close-up" contradicts wide establishing language in prompt');
  }

  // Conflicting simultaneous camera vectors in Text-to-Video mode
  if (generationMode === 'video') {
    const hasPushIn = /\b(?:dolly in|push in|push-in)\b/.test(lowerPrompt);
    const hasPullOut = /\b(?:dolly out|pull back|pull-out)\b/.test(lowerPrompt);
    if (hasPushIn && hasPullOut) {
      issues.push('Conflicting simultaneous camera motion vectors (push-in and pull-out) in single video beat');
    }
    if (/\bpan left\b/.test(lowerPrompt) && /\bpan right\b/.test(lowerPrompt)) {
      issues.push('Conflicting simultaneous camera pan directions (pan left and pan right) in single video beat');
    }
    if (/\btilt up\b/.test(lowerPrompt) && /\btilt down\b/.test(lowerPrompt)) {
      issues.push('Conflicting simultaneous camera tilt directions (tilt up and tilt down) in single video beat');
    }
  }

  return { passed: issues.length === 0, issues };
}

export function verifyEntityWhitelist(beat: WrittenPromptBeat, bible: StoryBible): BeatCheckResult {
  const issues: string[] = [];
  const validIds = new Set<string>([
    ...bible.cast.map((c) => c.id.toLowerCase()),
    ...(bible.parallelCast || []).flatMap((pc) => [pc.sourceId.toLowerCase(), pc.parallelId.toLowerCase()]),
    ...bible.locations.map((l) => l.id.toLowerCase()),
    'threat',
    'monster',
    'villagers',
    'peasants',
    'crowd',
    'church',
    'scene',
  ]);

  for (const subId of beat.subjectIds || []) {
    const cleanId = subId.toLowerCase().trim();
    if (cleanId && !validIds.has(cleanId)) {
      issues.push(`Subject ID "${subId}" is not whitelisted in the Story Bible`);
    }
  }

  return { passed: issues.length === 0, issues };
}

/**
 * Runs all 7 deterministic code checks for a single beat
 */
export function verifyBeatCodeChecks(
  beat: WrittenPromptBeat,
  sceneBeats: WrittenPromptBeat[],
  bible: StoryBible,
  format: 'short' | 'long' = 'long',
  generationMode: GenerationMode = 'image',
  targetVideoDuration?: number
): BeatCheckResult {
  const issues: string[] = [];

  // Check 1: Text & subtitle leaks
  const textCheck = verifyTextLeaks(beat);
  if (!textCheck.passed) issues.push(...textCheck.issues);

  // Check 2: Grounded subject & valid grammar
  const subjectCheck = verifySubjectAndGrammar(beat, bible);
  if (!subjectCheck.passed) issues.push(...subjectCheck.issues);

  // Check 3: Near-duplicates
  const duplicateCheck = verifyNearDuplicates(beat, sceneBeats);
  if (!duplicateCheck.passed) issues.push(...duplicateCheck.issues);

  // Check 4: Forbidden tropes & anachronisms
  const forbiddenCheck = verifyForbiddenElements(beat, bible);
  if (!forbiddenCheck.passed) issues.push(...forbiddenCheck.issues);

  // Check 5: Style bleed & fake precision
  const styleCheck = verifyStyleBleed(beat, bible);
  if (!styleCheck.passed) issues.push(...styleCheck.issues);

  // Check 6: Shot-label match & video motion vector consistency
  const labelCheck = verifyShotLabelMatch(beat, generationMode);
  if (!labelCheck.passed) issues.push(...labelCheck.issues);

  // Check 7: Entity whitelist
  const entityCheck = verifyEntityWhitelist(beat, bible);
  if (!entityCheck.passed) issues.push(...entityCheck.issues);

  // Pacing boundaries (Image Phrase Cuts allow 2-word phrases down to 0.45s without triggering repairs)
  const minDwell = generationMode === 'video' ? 0.8 : 0.45;
  const maxDwell =
    generationMode === 'video'
      ? Math.max(format === 'short' ? 2.2 : 3.0, targetVideoDuration || 4.0)
      : format === 'short'
        ? 2.2
        : 3.0;
  if (beat.estimatedSeconds < minDwell || beat.estimatedSeconds > maxDwell) {
    issues.push(`Beat duration (~${beat.estimatedSeconds}s) violates dwell bounds (${minDwell}s - ${maxDwell}s)`);
  }

  return { passed: issues.length === 0, issues };
}

/**
 * Single-beat repair loop: regenerates a failing beat up to 2 rounds
 */
export async function repairFailingBeat(
  beat: WrittenPromptBeat,
  issues: string[],
  bible: StoryBible,
  apiKey: string,
  modelQuality: GeminiModelQuality = 'standard',
  provider: AiProvider = 'gemini',
  groqModel?: string,
  userSignal?: AbortSignal,
  generationMode: GenerationMode = 'image'
): Promise<WrittenPromptBeat> {
  const isVideoMode = generationMode === 'video';
  const modeRule = isVideoMode
    ? '7. Keep ONE smooth camera vector that settles cleanly (never stack push-in with pull-out) and end with brief ambient foley (no dialogue).'
    : '7. Keep this as a frozen still-frame moment with ZERO camera motion verbs and ZERO audio/sound cues.';

  const prompt = `You are a prompt doctor. Fix this single AI ${isVideoMode ? 'video' : 'image'} prompt which failed quality checks.

FAILING PROMPT:
"""${beat.imagePrompt}"""

DETECTED ISSUES:
${issues.map((iss) => `- ${iss}`).join('\n')}

BEAT REQUIREMENTS:
- What We See: ${beat.depicts}
- Shot Size: ${beat.shotSize}
- Camera Angle: ${beat.angle}
- Spoken Words: "${beat.textSpan}"
- Style: ${bible.worldStyle}

REPAIR RULES:
1. Write 45 to 80 words.
2. DO NOT quote or mention words, text, numbers, quotation marks, or captions.
3. Start cleanly with framing and a concrete subject from the story.
4. No bare pronouns or detached limbs at start.
5. No fake precision (no Kelvin, %, degrees).
6. Resolve any figurative metaphors to concrete story entities.
${modeRule}

Return ONLY the corrected prompt text as plain string with no markdown formatting.`;

  try {
    if (provider === 'groq') {
      const fixedText = await callGroqChatCompletion(
        apiKey,
        [{ role: 'user', content: prompt }],
        {
          model: groqModel || (modelQuality === 'high' ? 'openai/gpt-oss-120b' : 'qwen/qwen3.8-27b'),
          jsonMode: false,
          temperature: 0.1,
        }
      );
      if (fixedText && fixedText.trim()) {
        return {
          ...beat,
          imagePrompt: fixedText.trim().replace(/^["']|["']$/g, ''),
        };
      }
    } else {
      const fixedText = await executeGeminiSchemaCall<string>({
        apiKey,
        prompt,
        modelQuality,
        responseMimeType: 'text/plain',
        temperature: 0.1,
        thinkingLevel: 'minimal',
        errorContext: 'Beat repair',
        userSignal,
      });
      if (typeof fixedText === 'string' && fixedText.trim()) {
        return {
          ...beat,
          imagePrompt: fixedText.trim().replace(/^["']|["']$/g, ''),
        };
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw err;
    }
    // If repair call fails, return original
  }

  return beat;
}

/**
 * Independent Critic Pass per Scene
 */
export async function runSceneCritic(
  sceneIndex: number,
  narrationSlice: string,
  beats: WrittenPromptBeat[],
  bible: StoryBible,
  apiKey: string,
  modelQuality: GeminiModelQuality = 'standard',
  provider: AiProvider = 'gemini',
  groqModel?: string
): Promise<Map<number, string[]>> {
  const critiqueMap = new Map<number, string[]>();

  const prompt = `You are an independent script supervisor and critic.
Evaluate whether the following final image prompts accurately visualize the story without hallucinating or leaking text.

NARRATION FOR SCENE ${sceneIndex}:
"""${narrationSlice}"""

STORY BIBLE FACTS:
Referents: ${bible.referents.map((r) => `"${r.phrase}" -> ${r.concreteEntity}`).join('; ')}
Withheld: ${bible.withheld.join('; ')}
Forbidden: ${bible.forbidden.join('; ')}

PROMPTS TO CRITIQUE:
${beats.map((b) => `BEAT ${b.beatIndex}:
- Spoken: "${b.textSpan}"
- Depicts: ${b.depicts}
- Prompt: "${b.imagePrompt}"`).join('\n\n')}

For each beat, answer:
1. Does the picture show what the story actually means?
2. Are figurative metaphors resolved to concrete entities?
3. Does it reveal anything withheld?
4. Are any elements, creatures, or characters invented?

Output JSON format:
{
  "critiques": [
    { "beatIndex": 1, "passed": true, "issues": [] }
  ]
}`;

  try {
    let parsed: any = null;

    if (provider === 'groq') {
      const rawText = await callGroqChatCompletion(
        apiKey,
        [{ role: 'user', content: prompt }],
        {
          model: groqModel || (modelQuality === 'high' ? 'openai/gpt-oss-120b' : 'qwen/qwen3.8-27b'),
          jsonMode: true,
          temperature: 0.1,
        }
      );
      parsed = JSON.parse(rawText);
    } else {
      parsed = await executeGeminiSchemaCall<any>({
        apiKey,
        prompt,
        modelQuality,
        responseMimeType: 'application/json',
        temperature: 0.1,
        thinkingLevel: 'minimal',
        errorContext: `Scene ${sceneIndex} critic`,
      });
    }

    if (parsed) {
      for (const item of parsed.critiques || []) {
        if (!item.passed && Array.isArray(item.issues) && item.issues.length > 0) {
          critiqueMap.set(item.beatIndex, item.issues);
        }
      }
    }
  } catch {
    // Critic pass is non-blocking on network failure
  }

  return critiqueMap;
}

/**
 * Main Stage 4 entry point: verifies, repairs, and returns final verified beats
 */
export async function stage4VerifyAndRepairScene(
  sceneIndex: number,
  sceneNarration: string,
  beats: WrittenPromptBeat[],
  bible: StoryBible,
  format: 'short' | 'long' = 'long',
  apiKey: string,
  modelQuality: GeminiModelQuality = 'standard',
  userSignal?: AbortSignal,
  onStatusMessage?: (msg: string) => void,
  provider: AiProvider = 'gemini',
  groqModel?: string,
  options?: { runLlmCritic?: boolean; generationMode?: GenerationMode; targetVideoDuration?: number }
): Promise<WrittenPromptBeat[]> {
  const verifiedBeats: WrittenPromptBeat[] = [];
  const genMode = options?.generationMode || 'image';
  const targetVideoDuration = options?.targetVideoDuration;

  for (let i = 0; i < beats.length; i++) {
    if (userSignal?.aborted) {
      throw new DOMException('Cancelled by user', 'AbortError');
    }

    let currentBeat = beats[i];
    const initialCheck = verifyBeatCodeChecks(currentBeat, beats, bible, format, genMode, targetVideoDuration);

    if (!initialCheck.passed) {
      if (onStatusMessage) {
        onStatusMessage(`Repairing Beat ${currentBeat.beatIndex} in Scene ${sceneIndex}...`);
      }

      // Round 1 Repair
      let repaired = await repairFailingBeat(currentBeat, initialCheck.issues, bible, apiKey, modelQuality, provider, groqModel, userSignal, genMode);
      let secondCheck = verifyBeatCodeChecks(repaired, beats, bible, format, genMode, targetVideoDuration);

      // Round 2 Repair if still failing
      if (!secondCheck.passed) {
        repaired = await repairFailingBeat(repaired, secondCheck.issues, bible, apiKey, modelQuality, provider, groqModel, userSignal, genMode);
        secondCheck = verifyBeatCodeChecks(repaired, beats, bible, format, genMode, targetVideoDuration);
      }

      if (!secondCheck.passed) {
        // Flag in output instead of hiding
        repaired.flaggedIssue = secondCheck.issues.join('; ');
      }
      currentBeat = repaired;
    }

    verifiedBeats.push(currentBeat);
  }

  // Independent LLM critic pass is opt-in to keep long-form execution fast on free-tier quotas
  if (options?.runLlmCritic) {
    const criticIssues = await runSceneCritic(sceneIndex, sceneNarration, verifiedBeats, bible, apiKey, modelQuality, provider, groqModel);
    for (const b of verifiedBeats) {
      const issues = criticIssues.get(b.beatIndex);
      if (issues && issues.length > 0) {
        b.flaggedIssue = b.flaggedIssue ? `${b.flaggedIssue}; Critic: ${issues.join(', ')}` : `Critic: ${issues.join(', ')}`;
      }
    }
  }

  return verifiedBeats;
}
