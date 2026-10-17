/**
 * Stage 3: Prompt Writing (Per-Scene LLM Calls)
 * Transforms each planned beat into a self-contained, 50-to-100-word image prompt paragraph.
 * Formatted strictly for stateless diffusion models in 16:9 widescreen landscape.
 */

import { StoryBible, StoryFormat, GenerationMode, AiProvider } from '../types';
import { PlannedBeat } from './stage2BeatPlan';
import { fetchWithExponentialBackoff } from '../utils/retryFetch';
import { executeJsonLlmCall } from './unifiedAiService';

export interface WrittenPromptBeat extends PlannedBeat {
  imagePrompt: string;
  flaggedIssue?: string;
}

export interface WrittenScenePrompts {
  sceneIndex: number;
  beats: WrittenPromptBeat[];
}

export const SCENE_PROMPTS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    sceneIndex: { type: 'INTEGER' },
    prompts: {
      type: 'ARRAY',
      description: 'Array of self-contained image prompts matching beatIndex',
      items: {
        type: 'OBJECT',
        properties: {
          beatIndex: { type: 'INTEGER' },
          imagePrompt: {
            type: 'STRING',
            description:
              'Self-contained paragraph of 50 to 100 words in exact order: framing/angle, subject visual lock, action/gaze, setting, light, world style',
          },
        },
        required: ['beatIndex', 'imagePrompt'],
      },
    },
  },
  required: ['sceneIndex', 'prompts'],
};

export async function stage3WriteScenePrompts(
  sceneIndex: number,
  beats: PlannedBeat[],
  bible: StoryBible,
  prevDepicts: string[],
  format: StoryFormat = 'long',
  generationMode: GenerationMode = 'image',
  apiKey: string,
  modelQuality: 'standard' | 'high' = 'standard',
  userSignal?: AbortSignal,
  onStatusMessage?: (msg: string) => void,
  provider: AiProvider = 'gemini',
  groqModel?: string
): Promise<WrittenPromptBeat[]> {
  const modelName = modelQuality === 'high' ? 'gemini-3.1-pro-preview' : 'gemini-3.8-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  // Formulate prompt context
  const beatsSummary = beats.map((b) => {
    return `BEAT ${b.beatIndex}:
- Spoken Clause: "${b.textSpan}"
- What We See: ${b.depicts}
- Kind: ${b.kind} ${b.referentId ? `(Referent: ${b.referentId})` : ''}
- Subjects: ${b.subjectIds.join(', ')}
- Shot Size: ${b.shotSize}
- Camera Angle: ${b.angle}
- New Info: ${b.newInfo}`;
  }).join('\n\n');

  const castDescriptions = bible.cast
    .map((c) => `ID "${c.id}": ${c.visualLock}`)
    .join('\n');

  const locationDescriptions = bible.locations
    .map((l) => `Location "${l.id}": ${l.visualLock}`)
    .join('\n');

  const referentsSummary = bible.referents
    .map((r) => `"${r.phrase}" MUST DEPICT -> ${r.concreteEntity}: ${r.visualDepiction}`)
    .join('\n');

  const systemInstruction = `You are an expert Director of Photography and AI prompt artist.
Write production-ready, standalone image prompts for SCENE ${sceneIndex}.

STORY BIBLE ENTITIES:
Cast Visual Locks (DO NOT USE NAMES, USE THEIR PHYSICAL DESCRIPTIONS):
${castDescriptions}

Threat Canonical Look:
${bible.threat.canonicalLook}

Location Visual Locks:
${locationDescriptions}

Figurative Referents (RESOLVE THESE IMMEDIATELY):
${referentsSummary}

Withheld Mysteries (NEVER SHOW THE CAUSE):
${bible.withheld.join('; ')}

World Style:
${bible.worldStyle}

PREVIOUS SCENE CONTEXT (Last visible images):
${prevDepicts.length > 0 ? prevDepicts.map((d, i) => `- ${d}`).join('\n') : 'Opening of the story.'}

BEATS TO WRITE FOR SCENE ${sceneIndex}:
${beatsSummary}

CRITICAL RULES FOR WRITING EACH PROMPT (50 to 100 words per prompt):
1. ORDER OF PROSE:
   a. Framing and angle in natural words (${format === 'short' ? '"Vertical 9:16 portrait composition, low angle...", "Eye-level portrait framing..."' : '"Wide 16:9 landscape composition, low angle...", "Medium eye-level shot..."'}).
   b. The subject with full visual lock repeated (NEVER use character names like "Father Thomas" or pronouns like "he/she/it/they" - write the full physical description because image models are stateless).
   c. Kinetic action, facing direction, and gaze vector.
   d. Setting, environment, and background depth.
      ${format === 'short' ? 'PORTRAIT SAFE ZONES: Keep the bottom fifth and lateral sides clear of key subjects to leave safe space for mobile UI buttons, captions, and creator overlays. Position key heads and action in the upper-middle vertical third.' : 'LANDSCAPE FRAMING: Place primary subjects on a third with visible environmental negative space.'}
   e. Natural lighting in words ("cold grey twilight", "flickering tallow candlelight casting long shadows").
   f. The short world style summary once at the end.
   ${generationMode === 'video' ? 'g. KINETIC VIDEO DYNAMICS: Describe continuous physical motion and camera trajectory. Include synchronized ambient foley and sound cues.' : 'g. STRICT AUDIO ISOLATION: This is Text to Image. Strictly FORBID sound cues, foley, audio, or music words.'}
2. ABSOLUTE TEXT BAN & NO SPOKEN DIALOGUE:
   - NEVER quote or paraphrase the spoken narration.
   - NEVER include quotation marks ("").
   - NEVER include spoken dialogue or voiceover lines in video or image prompts.
   - NEVER mention text, words, letters, captions, subtitles, titles, signs, numbers, years, digits, or "on-screen". Mentioning them causes the generator to print subtitles!
3. NO STYLE BLEED:
   - Threat features (such as glowing or decaying elements) must appear ONLY in beats where the threat is an explicit subject. Never put threat features on villagers, gates, or priests.
   - Crowds must remain generic ("frightened 14th-century peasants").
4. NO FAKE PRECISION:
   - ZERO Kelvin numbers (no "3200K", no "5600K").
   - ZERO percentages (no "60% weight", no "30% fill").
   - ZERO degrees (no "15-degree tilt").
   - ZERO lens math (no "35mm f/1.8"). Use plain cinematic words ("shallow depth of field", "deep focus").
5. FIGURATIVE RESOLUTION:
   - If a beat is marked figurative (e.g. "the worst thing God could send them. They were wrong."), draw the concrete referent entity (e.g. the clawing hands of the risen dead breaking from the muddy trench), NOT the spoken figure of speech.
6. WITHHELD PROTECTION:
   - If a beat is marked withheld-effect, show ONLY the environmental consequence (frost spreading across flagstones, bell swinging empty in the belfry, faces turning in horror), NEVER the hidden source.

Output valid JSON matching SCENE_PROMPTS_SCHEMA.`;

  let parsed: any;

  if (provider === 'groq') {
    parsed = await executeJsonLlmCall<any>({
      provider: 'groq',
      apiKey,
      systemPrompt: 'You are a cinematic prompt engineer writing visual prompts. Output valid JSON.',
      userPrompt: systemInstruction,
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
      contents: [{ role: 'user', parts: [{ text: systemInstruction }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: SCENE_PROMPTS_SCHEMA,
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
            onStatusMessage(`Writing cinematic prompts for Scene ${sceneIndex} (Attempt ${attempt}/4, waiting ${Math.round(delayMs / 1000)}s)...`);
          }
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Scene ${sceneIndex} prompt writing failed: HTTP ${response.status}`);
    }

    const json = await response.json();
    const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error(`Empty response for Scene ${sceneIndex} prompt writing`);
    }

    parsed = JSON.parse(rawText);
  }
  const promptMap = new Map<number, string>();
  for (const item of parsed.prompts || []) {
    if (typeof item.beatIndex === 'number' && typeof item.imagePrompt === 'string') {
      promptMap.set(item.beatIndex, item.imagePrompt.trim());
    }
  }

  return beats.map((b) => {
    let generatedPrompt = promptMap.get(b.beatIndex) || '';
    if (!generatedPrompt) {
      // Fallback self-contained prompt
      const framing = `${b.shotSize} landscape framing, ${b.angle}`;
      generatedPrompt = `${framing}. Wide landscape composition capturing ${b.depicts}. ${bible.worldStyle}`.trim();
    }
    return {
      ...b,
      imagePrompt: generatedPrompt,
    };
  });
}
