/**
 * Stage 1: Story Bible (Structured Gemini Call)
 * Generates an authoritative Story Bible over the entire narrative:
 * canonical cast, threat look, locations, recurring motifs, causal chain,
 * figurative referents, withheld elements, forbidden anachronisms,
 * world style, and explicit assumptions.
 */

import { StoryBible, AiProvider, GeminiModelQuality, VisualStyleFamily } from '../types';
import { getCachedStoryBible, setCachedStoryBible } from './bibleCache';
import { classifyVisualStyleFamily } from './promptCompiler';
import { executeGeminiSchemaCall, executeJsonLlmCall } from './unifiedAiService';

export const STORY_BIBLE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    cast: {
      type: 'ARRAY',
      description: 'Named or primary characters strictly grounded in story text, including all dual-era or parallel variants',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING', description: 'Unique identifier, e.g. traveler, father_thomas, boy, young_milo' },
          role: { type: 'STRING', description: 'Narrative role, e.g. Priest, lone messenger' },
          visualLock: { type: 'STRING', description: 'Concrete clothing, posture, and biometric features' },
          permanentAnatomy: {
            type: 'STRING',
            description: 'Immutable age, build, facial structure, hair texture/color, skin or surface material',
          },
          eraWardrobe: {
            type: 'STRING',
            description: 'Period-accurate clothing layers, accessories, and footwear locked for this character variant',
          },
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
          spatialPlacement: {
            type: 'STRING',
            description: '3D layout of doorways, furniture, or horizon landmarks relative to camera and characters',
          },
          stateTimeline: {
            type: 'ARRAY',
            description: 'How this location physically evolves across story phases (e.g. intact -> cracked -> flooded)',
            items: {
              type: 'OBJECT',
              properties: {
                phase: { type: 'STRING' },
                stateDescription: { type: 'STRING' },
              },
              required: ['phase', 'stateDescription'],
            },
          },
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
      description: 'Single medium only matching requested visual style, palette, natural light words, mood, max 40 words',
    },
    styleFamily: {
      type: 'STRING',
      enum: ['photoreal', 'stylized_3d', 'stop_motion', 'illustration_2d', 'minimalist_flat'],
      description: 'Native rendering family for the worldStyle',
    },
    spatialMap: {
      type: 'STRING',
      description: 'Concise layout connecting key locations, sightlines, and directional orientation in the world',
    },
    lightingArc: {
      type: 'ARRAY',
      description: 'Ordered progression of time-of-day and natural atmospheric lighting across story acts (zero Kelvin numbers)',
      items: {
        type: 'OBJECT',
        properties: {
          phase: { type: 'STRING', description: 'Story act or phase, e.g. Opening, Midpoint, Climax' },
          timeOfDay: { type: 'STRING', description: 'e.g. Dusk, Rainy midnight, Cold dawn' },
          lightingDescription: {
            type: 'STRING',
            description: 'Natural descriptive lighting words only (never Kelvin numbers), e.g. flickering tallow amber against slate shadows',
          },
        },
        required: ['phase', 'timeOfDay', 'lightingDescription'],
      },
    },
    parallelCast: {
      type: 'ARRAY',
      description: 'Links connecting dual-era, childhood flashback, or parallel versions of the same character',
      items: {
        type: 'OBJECT',
        properties: {
          sourceId: { type: 'STRING', description: 'Primary cast ID' },
          parallelId: { type: 'STRING', description: 'Alternate age/era cast ID (must ALSO appear in cast[])' },
          continuityBridge: {
            type: 'STRING',
            description: 'Shared immutable trait linking both versions (e.g. same crooked nose bridge and copper braid color)',
          },
        },
        required: ['sourceId', 'parallelId', 'continuityBridge'],
      },
    },
    assumptions: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'Explicit list of assumptions made where the story was silent',
    },
    thumbnailHook: {
      type: 'OBJECT',
      description: 'High-CTR YouTube cover thumbnail blueprint tailored specifically to this story',
      properties: {
        heroMoment: { type: 'STRING', description: 'One concise visual line showing the central peak conflict of this story' },
        expression: { type: 'STRING', description: 'Intense facial expression of the lead subject' },
        hookText: { type: 'STRING', description: 'Bold 2 to 4 word ALL CAPS curiosity headline grounded in THIS story' },
        alternateHooks: { type: 'ARRAY', items: { type: 'STRING' } },
      },
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

function normalizeStoryBibleResult(bible: StoryBible, characterStyle?: string): StoryBible {
  const inferredFamily: VisualStyleFamily = characterStyle?.trim()
    ? classifyVisualStyleFamily(characterStyle)
    : bible.styleFamily || classifyVisualStyleFamily(bible.worldStyle);

  const existingIds = new Set((bible.cast || []).map((c) => c.id.toLowerCase()));
  const normalizedCast = [...(bible.cast || [])];

  if (Array.isArray(bible.parallelCast)) {
    for (const pair of bible.parallelCast) {
      if (pair?.parallelId && !existingIds.has(pair.parallelId.toLowerCase())) {
        const source = normalizedCast.find((c) => c.id.toLowerCase() === (pair.sourceId || '').toLowerCase());
        normalizedCast.push({
          id: pair.parallelId,
          role: source ? `${source.role} (alternate phase)` : 'Alternate character variant',
          visualLock: pair.continuityBridge || source?.visualLock || 'Consistent facial features across timeline',
          permanentAnatomy: pair.continuityBridge || source?.permanentAnatomy,
        });
        existingIds.add(pair.parallelId.toLowerCase());
      }
    }
  }

  return {
    ...bible,
    cast: normalizedCast,
    styleFamily: inferredFamily,
  };
}

export async function stage1GenerateStoryBible(
  narration: string,
  authorNotes: string | undefined,
  apiKey: string,
  modelQuality: GeminiModelQuality = 'standard',
  userSignal?: AbortSignal,
  onStatusMessage?: (msg: string) => void,
  provider: AiProvider = 'gemini',
  groqModel?: string,
  characterStyle?: string
): Promise<StoryBible> {
  // Check session cache first (hash of narration + NOTES block + requested visual style)
  const cached = getCachedStoryBible(narration, authorNotes, characterStyle);
  if (cached) {
    if (onStatusMessage) {
      onStatusMessage('Reusing cached Story Bible for this narrative...');
    }
    return normalizeStoryBibleResult(cached, characterStyle);
  }

  const requestedStyleFamily = characterStyle?.trim()
    ? classifyVisualStyleFamily(characterStyle)
    : undefined;

  const styleDirective = characterStyle?.trim()
    ? `REQUESTED VISUAL STYLE (STRICT LOCK): "${characterStyle.trim()}" (Style family: ${requestedStyleFamily}). Honor this exact medium and texture across worldStyle and cast materials. Do NOT force live-action camera lenses onto stylized/clay/2D/minimalist styles.`
    : `VISUAL STYLE: Choose ONE cohesive medium fitting the story (photographic film look, stylized 3D, stop-motion, 2D illustration, or minimalist flat - never mix conflicting mediums).`;

  const prompt = `You are an expert film director and master story architect.
Analyze the following narrative and create an authoritative STORY BIBLE.

${authorNotes ? `AUTHOR NOTES (CANON):\n${authorNotes}\n` : ''}${styleDirective}

FULL STORY NARRATION:
"""
${narration}
"""

RULES FOR THE STORY BIBLE:
1. CAST: Extract EVERY named person, creature/spirit, parent/relative, AND distinct child/adult age variant mentioned in the text as separate entries. Fill "visualLock", "permanentAnatomy" (immutable age, build, facial geometry, hair, skin/surface material), and "eraWardrobe" (locked outfit layers and footwear). Never invent unstated wings or extra limbs. Where silent, choose the simplest story-consistent option and record it in "assumptions".
2. PARALLEL CAST: If a character appears across different ages, flashbacks, or parallel states, link them in "parallelCast" (sourceId, parallelId, continuityBridge) AND include BOTH IDs inside "cast".
3. THREAT: Define one canonical physical description for antagonists/creatures/monsters (or "none" if non-horror/explainer). Kept strictly separate from global art style.
4. LOCATIONS & SPATIAL MAP: Extract real environments with physical architecture, "spatialPlacement" (doorways, tables, left/right sightlines), and "stateTimeline" showing how each location physically changes over the story. Summarize overall geography in "spatialMap".
5. MOTIFS & REFERENTS: List recurring physical props in "motifs". For every figurative, hyperbolic, or abstract statement, map it in "referents" to the concrete story-world entity/object it depicts.
6. WITHHELD & FORBIDDEN: Identify mysteries the narration deliberately conceals in "withheld" (prompts must show only physical effects/reactions, never the hidden cause). List forbidden anachronisms or unstated invented tropes in "forbidden".
7. LIGHTING ARC: Define 2 to 4 sequential phases in "lightingArc" using strictly natural descriptive lighting words ("cold grey twilight", "flickering tallow candlelight", "soft overhead desk lamp"). ZERO Kelvin numbers (never 3200K/5600K) and ZERO em dashes.
8. WORLD STYLE & FAMILY: Set "worldStyle" to a single coherent medium matching the requested style, palette, natural light words, and mood (under 40 words), and set "styleFamily" accurately.
9. ASSUMPTIONS & THUMBNAIL HOOK: Record every gap-filling assumption. Populate "thumbnailHook" with a crisp, story-specific peak heroMoment, intense expression, 2-to-4 word ALL CAPS hookText (never generic like "THE UNTOLD STORY"), and 2 alternateHooks.

Output valid JSON matching the schema.`;

  let bible: StoryBible;

  if (provider === 'groq') {
    bible = await executeJsonLlmCall<StoryBible>({
      provider: 'groq',
      apiKey,
      systemPrompt: 'You are an expert film director and master story architect. Analyze the narrative and create an authoritative STORY BIBLE. Output valid JSON without em dashes.',
      userPrompt: prompt,
      modelQuality,
      groqModel,
      userSignal,
      onStatusMessage,
      temperature: 0.2,
    });
  } else {
    bible = (await executeGeminiSchemaCall<StoryBible>({
      apiKey,
      prompt,
      modelQuality,
      responseSchema: STORY_BIBLE_SCHEMA,
      temperature: 0.2,
      thinkingLevel: 'minimal',
      errorContext: 'Story Bible generation',
      userSignal,
      onRetryMessage: (attempt, _max, delayMs) => {
        if (onStatusMessage) {
          onStatusMessage(`Analyzing story architecture (Attempt ${attempt}/4, waiting ${Math.round(delayMs / 1000)}s)...`);
        }
      },
    })) as StoryBible;
  }

  const normalizedBible = normalizeStoryBibleResult(bible, characterStyle);
  setCachedStoryBible(narration, authorNotes, normalizedBible, characterStyle);
  return normalizedBible;
}

