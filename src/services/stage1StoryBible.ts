/**
 * Stage 1: Story Bible (Structured Gemini Call)
 * Generates an authoritative Story Bible over the entire narrative:
 * canonical cast, threat look, locations, recurring motifs, causal chain,
 * figurative referents, withheld elements, forbidden anachronisms,
 * world style, and explicit assumptions.
 */

import { StoryBible, AiProvider } from '../types';
import { fetchWithExponentialBackoff } from '../utils/retryFetch';
import { getCachedStoryBible, setCachedStoryBible } from './bibleCache';
import { executeJsonLlmCall } from './unifiedAiService';

export const STORY_BIBLE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    cast: {
      type: 'ARRAY',
      description: 'Named or primary characters strictly grounded in story text',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING', description: 'Unique identifier, e.g. traveler, father_thomas, boy' },
          role: { type: 'STRING', description: 'Narrative role, e.g. Priest, lone messenger' },
          visualLock: { type: 'STRING', description: 'Concrete clothing, posture, and biometric features' },
        },
        required: ['id', 'role', 'visualLock'],
      },
    },
    threat: {
      type: 'OBJECT',
      description: 'Antagonist, monster, or hostile presence look',
      properties: {
        canonicalLook: { type: 'STRING', description: 'Single consistent physical description' },
        allowedVariants: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: 'Permitted variations by narrative stage',
        },
      },
      required: ['canonicalLook', 'allowedVariants'],
    },
    locations: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING', description: 'Identifier, e.g. church_nave, churchyard_trench' },
          visualLock: { type: 'STRING', description: 'Distinct physical architecture, weather, and props' },
        },
        required: ['id', 'visualLock'],
      },
    },
    motifs: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          description: { type: 'STRING' },
        },
        required: ['id', 'description'],
      },
    },
    events: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'Ordered chronological causal chain of story events',
    },
    referents: {
      type: 'ARRAY',
      description: 'Concrete mappings for figurative or abstract phrases',
      items: {
        type: 'OBJECT',
        properties: {
          phrase: { type: 'STRING', description: 'The spoken figurative phrase' },
          concreteEntity: { type: 'STRING', description: 'The concrete story-world object it refers to' },
          visualDepiction: { type: 'STRING', description: 'Exact picture that visualizes this referent' },
        },
        required: ['phrase', 'concreteEntity', 'visualDepiction'],
      },
    },
    withheld: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'Elements the narration deliberately hides; prompts must show only effects/reactions, never the cause',
    },
    forbidden: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'Invented characters, unstated weapons, vortexes, and era anachronisms forbidden in prompts',
    },
    worldStyle: {
      type: 'STRING',
      description: 'Single medium only (3D animation OR photographic film look, never both), palette, light words, mood, max 40 words',
    },
    assumptions: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'Explicit list of assumptions made where the story was silent',
    },
  },
  required: [
    'cast',
    'threat',
    'locations',
    'motifs',
    'events',
    'referents',
    'withheld',
    'forbidden',
    'worldStyle',
    'assumptions',
  ],
};

export async function stage1GenerateStoryBible(
  narration: string,
  authorNotes: string | undefined,
  apiKey: string,
  modelQuality: 'standard' | 'high' = 'standard',
  userSignal?: AbortSignal,
  onStatusMessage?: (msg: string) => void,
  provider: AiProvider = 'gemini',
  groqModel?: string
): Promise<StoryBible> {
  // Check session cache first (hash of narration + NOTES block)
  const cached = getCachedStoryBible(narration, authorNotes);
  if (cached) {
    if (onStatusMessage) {
      onStatusMessage('Reusing cached Story Bible for this narrative...');
    }
    return cached;
  }

  const prompt = `You are an expert film director and master story architect.
Analyze the following narrative and create an authoritative STORY BIBLE.

${authorNotes ? `AUTHOR NOTES (CANON):\n${authorNotes}\n` : ''}
FULL STORY NARRATION:
"""
${narration}
"""

RULES FOR THE STORY BIBLE:
1. CAST: Extract only people explicitly mentioned in the text. Visual locks must use ONLY facts from the story. Where silent (clothing, age), choose the simplest, least-inventive historical option and record it in "assumptions".
2. THREAT: Define one canonical physical description for antagonists/creatures/monsters. Kept strictly separate from global art style.
3. LOCATIONS: Extract real environments with physical architecture and era-accurate details.
4. MOTIFS: Recurring physical items or props.
5. EVENTS: List the causal chain in chronological order.
6. REFERENTS: For every figurative, hyperbolic, or abstract statement (e.g. "the worst thing God could send them. They were wrong."), map it to the concrete story-world entity it points to (e.g. the risen dead clawing out of the trench) and describe how to visualize it.
7. WITHHELD: Identify mysteries the story deliberately conceals (e.g. what called the dead). State what must NOT be drawn; images must only depict physical reactions or atmospheric effects (frost creeping, bell swinging, faces turning), never the hidden cause.
8. FORBIDDEN: List forbidden anachronisms (e.g. 17th-century bottle glass or modern chalk crosses in 1348), plus invented monsters (e.g. 20-foot clawed shadows, black vortexes) not in the text.
9. WORLD STYLE: Exactly one medium (either photographic film look OR stylized 3D animation, never both). Include palette, natural lighting words ("flickering tallow candles", "cold grey daylight"), and mood. Under 40 words.
10. ASSUMPTIONS: Record every assumption you made to fill story gaps.

Output valid JSON matching the schema.`;

  let bible: StoryBible;

  if (provider === 'groq') {
    bible = await executeJsonLlmCall<StoryBible>({
      provider: 'groq',
      apiKey,
      systemPrompt: 'You are an expert film director and master story architect. Analyze the narrative and create an authoritative STORY BIBLE. Output valid JSON.',
      userPrompt: prompt,
      modelQuality,
      groqModel,
      userSignal,
      onStatusMessage,
      temperature: 0.2,
    });
  } else {
    const modelName = modelQuality === 'high' ? 'gemini-3.1-pro-preview' : 'gemini-3.8-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const payload = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: STORY_BIBLE_SCHEMA,
        temperature: 0.2,
      },
    };

    const response = await fetchWithExponentialBackoff(
      () =>
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: userSignal,
        }),
      {
        initialDelayMs: 2000,
        maxAttempts: 4,
        onRetry: (attempt, _max, delayMs) => {
          if (onStatusMessage) {
            onStatusMessage(`Analyzing story architecture (Attempt ${attempt}/4, waiting ${Math.round(delayMs / 1000)}s)...`);
          }
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Story Bible API error: HTTP ${response.status}`);
    }

    const json = await response.json();
    const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error('Empty response from Story Bible generator');
    }

    bible = JSON.parse(rawText) as StoryBible;
  }

  setCachedStoryBible(narration, authorNotes, bible);
  return bible;
}
