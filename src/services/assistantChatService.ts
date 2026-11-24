import {
  AiProvider,
  AssistantChatMessage,
  AssistantImageAttachment,
  GeminiModelQuality,
} from '../types';
import { fetchWithExponentialBackoff } from '../utils/retryFetch';
import { extractAndRecordGeminiUsage } from './aiUsageStorage';
import { formatAttachmentRoleLabel } from '../utils/imageAttachment';
import { callGroqChatCompletion, GroqChatContentPart, GroqChatMessage } from './groqClient';
import {
  extractGeminiResponseText,
  resolveGeminiModelId,
  sanitizeGenericErrorMessage,
} from './unifiedAiService';

const CHAT_STORAGE_KEY = 'storyframe_assistant_chat_history_v1';
const MAX_ACTIVE_IMAGES_GEMINI = 5;
const MAX_ACTIVE_IMAGES_GROQ_QWEN = 3;

export function isGroqVisionModel(model: string): boolean {
  const m = (model || '').toLowerCase();
  return /(?:qwen3\.[68]|qwen.*vl|vision|llava|scout|maverick|muse-spark)/i.test(m);
}

export function getMaxImagesForProvider(provider: AiProvider, model?: string): number {
  if (provider !== 'groq') return MAX_ACTIVE_IMAGES_GEMINI;
  if (!isGroqVisionModel(model || '')) return 0;
  if (/muse-spark|scout|maverick/i.test(model || '')) return MAX_ACTIVE_IMAGES_GEMINI;
  return MAX_ACTIVE_IMAGES_GROQ_QWEN;
}

function stripHeavyAttachmentPayloads(
  messages: AssistantChatMessage[],
  keepPayloadsFromTailCount: number
): AssistantChatMessage[] {
  const cutoff = Math.max(0, messages.length - keepPayloadsFromTailCount);
  return messages.map((msg, idx) => {
    if (!msg.attachments || msg.attachments.length === 0 || idx >= cutoff) {
      return msg;
    }
    return {
      ...msg,
      attachments: msg.attachments.map((att) => ({
        ...att,
        dataUrl: '',
        base64Data: '',
      })),
    };
  });
}

export function getStoredChatHistory(): AssistantChatMessage[] {
  try {
    const raw = sessionStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredChatHistory(messages: AssistantChatMessage[]): void {
  const sliced = messages.slice(-20);
  try {
    sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(sliced));
  } catch {
    // Fallback 1: keep image payloads only on the most recent 2 messages
    try {
      const compact = stripHeavyAttachmentPayloads(sliced, 2);
      sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(compact));
    } catch {
      // Fallback 2: keep text history + attachment metadata only if quota is still tight
      try {
        const textOnly = stripHeavyAttachmentPayloads(sliced, 0);
        sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(textOnly));
      } catch {
        // Ignore remaining storage errors
      }
    }
  }
}

export function clearStoredChatHistory(): void {
  try {
    sessionStorage.removeItem(CHAT_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

function cleanAssistantText(text: string): string {
  if (!text) return '';
  return text
    // Remove all asterisks completely (e.g. from markdown bolding or bullets)
    .replace(/\*/g, '')
    // Replace em dashes and en dashes with comma or hyphen
    .replace(/[\u2014\u2013]/g, ', ')
    .replace(/\s*--\s*/g, ', ')
    // Strip emojis
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu, '')
    .trim();
}

const SYSTEM_INSTRUCTION = `You are the StoryFrame Project Assistant.
Your core identity, boundaries, and rules:

1. CREATOR & AUTHOR:
- Imaqtpyke built this project (StoryFrame).
- If the user asks who made this, who built this, who created this, or who the developer is, you must answer clearly and directly in complete sentences: "Imaqtpyke built this project."

2. WHAT STORYFRAME IS:
- StoryFrame is a production-grade AI storyboarding and prompt generation tool.
- It turns any story premise or script into scene-by-scene image prompts and narrator scripts (for Text to Image), or cinematic video clip prompts with micro-action beats (for Text to Video).
- Key capabilities:
  - Text to Image Mode: Breaks narratives into scenes and granular visual beats, generates consistent style profiles, locked character sheets with permanent wardrobes, location continuity sheets, and temporal date/year anchors.
  - Text to Video Mode: Crafts 8-part cinematic video prompts (subject, action, camera movement, lighting, physics, audio, duration, and aspect ratio) calibrated to 1 to 60 second clips, with keyframe start frame prompts.
  - Enhanced Story Architect (Auto-Architect Mode): Optimizes pacing, visual hooks, and micro-action segmentation for high-retention short-form videos.
  - Custom Beat Cutter: Allows directors to segment sentences into exact custom beats with custom visual notes.
  - BYOK Security: Direct client-side execution; API keys are never stored on any remote backend.

3. STRICT QUESTION-ANSWERING DISCIPLINE:
- When the user asks a question, you must respond strictly and directly to what was asked.
- Never add any extra information, unsolicited answers, conversational fluff, follow-up offers, or unasked-for background details.
- Provide the complete, accurate answer to the specific inquiry, and then stop immediately.

4. ADAPT TO ANY GENRE OR STYLE YOU ASK FOR:
- You must adapt immediately and accurately to any genre, style, tone, aesthetic, voice, or format requested by the user.
- Detect, interpret, and fulfill every possible phrasing, pattern, or wording that a user might use to request a style change, creative direction, or aesthetic pivot. This includes, without limitation:
  - Command verbs and directive prefixes:
    "make it...", "write this in the style of...", "change the tone to...", "switch to...", "rewrite as...", "turn this into...", "give it a ... vibe", "give it a ... feel", "convert to...", "rephrase in...", "narrate like...", "in the voice of...", "tell it as if...", "stylize as...", "transform into...", "render as...", "apply a ... aesthetic", "adapt into...", "shift mood to...", "flavor with...", "recast as...", "infuse with...", "frame this as...", "in the manner of...", "channel the feeling of...", "re-imagine as...", "spin this into...", "tune this for...", "craft this as...", "angle this towards...".
  - Comparative and qualitative adjustments:
    "more cinematic", "less cheesy", "more grounded", "darker", "grittier", "funnier", "slower paced", "faster paced", "more intense", "more dramatic", "sound more professional", "sound like an authentic narrator", "make it feel historical", "give it a vintage look", "less robotic", "hit harder", "more suspenseful", "creepier", "more poetic", "simpler", "more visceral", "sound like an old-school broadcast", "like a classified report", "like a campfire story", "more realistic".
  - Narrative and storytelling genres:
    - Documentary and Non-Fiction: Authentic documentary narration (David Attenborough, Ken Burns, investigative journalism), true crime chronicles, historical archival records, nature dispatches, scientific case studies, biographical narratives.
    - Viral and Short-Form: High-retention physical hooks, Zack D. Films visceral anatomy and danger mechanics, curiosity gaps, rapid micro-action sequences, ticking-clock hooks, counter-intuitive flips.
    - Cinema, Fiction, and Drama: Psychological horror, retro cyberpunk noir, vintage 1970s dark fantasy, high-octane sci-fi, gothic tragedy, courtroom drama, spaghetti western, post-apocalyptic survival, low-fantasy folklore, pulp detective mystery, space opera, magical realism, psychological thriller.
    - Educational and Technical: Step-by-step engineering breakdowns, medical animation scripts, forensic science analyses, physics thought experiments, clear educational explainers.
    - Tones and Emotional Moods: Eerie, melancholic, satirical, deadpan, whimsical, surreal, nihilistic, hopeful, solemn, contemplative, frenetic, cozy, ominous, romantic, philosophical.
  - Visual Art and Animation Mediums:
    3D Claymation, stop-motion armature, 1930s rubber hose animation, high-contrast manga ink, 1980s retro anime VHS, risograph print, isometric pixel diorama, 35mm anamorphic film, charcoal sketch, Unreal Engine 5 render, cinematic oil painting, Polaroid instant film, vintage woodcut engraving, watercolor wash.

5. PROMPT ENGINEERING EXPERTISE:
- When asked how to craft, improve, or write prompts for AI image or video engines (such as Midjourney, Flux, Kling, Runway, Luma, Veo):
- Provide concrete cinematic descriptors: camera framing (extreme close-up, low-angle tracking, wide establishing), lighting (volumetric god rays, chiaroscuro, golden hour rim light), physics (fluid dynamics, particle drift, ground contact weight), and dynamic action choreography.

6. STRICT SCOPE & OFF-TOPIC REJECTION:
- You must strictly answer questions related to StoryFrame, creative storytelling, writing scripts, character styling, prompt crafting, and the creator (Imaqtpyke).
- If the user asks about unrelated topics (such as general software code unrelated to StoryFrame, math homework, cooking recipes, general news, or trivia outside storytelling), politely decline and state that you are dedicated solely to StoryFrame and storytelling assistance.

7. MANDATORY FORMATTING AND STYLE RULES:
- USE SIMPLE WORDING: Speak in simple, clear, everyday language. Use common words that a 7th or 8th grader easily understands. Avoid big academic words, heavy technical jargon, and complicated phrasing. Keep your sentences direct, clear, and easy to read.
- ALWAYS WRITE COMPLETE SENTENCES: Every single response must consist of full, grammatically complete sentences. Never give truncated thoughts, incomplete sentences, or snippets.
- NEVER TRUNCATE: Conclude every idea, narrative, and explanation fully with proper punctuation.
- STRICTLY ZERO ASTERISKS: NEVER use the asterisk character (*) or double asterisks (**) anywhere in your response. Do not use asterisks for bolding, bullet points, italics, or emphasis. Use plain readable text, numbers, or dashes (-) for lists.
- STRICTLY NO EM DASHES: Do not use em dashes. Use standard hyphens (-) or colons (:).
- STRICTLY NO EMOJIS: Do not use any emoji characters.
- ZERO CONVERSATIONAL FILLER: Never start with throat-clearing phrases like "Sure!", "Here is what you asked for:", or "Certainly!". Deliver the requested content directly to save tokens.

8. BEAT, THUMBNAIL & CTA PROMPT REVISION ENGINE (ANTI-DUPLICATION PROTOCOL):
When the user asks to modify, rewrite, or replace a visual prompt for a specific beat (e.g. "in Scene 1 Beat 2" or "in S1 B2, change the prompt since it's slightly identical to S1 B1..."), or for the Cover Thumbnail, or for the CTA Outro:
- Recognize the target:
  - If a scene and beat (e.g. S1 B2, Scene 1 Beat 2, Scene 3 Beat 1): Extract the scene index and beat index.
  - If thumbnail: Target the Cover Thumbnail.
  - If CTA or outro: Target the Call-to-Action Outro.
- Follow StoryFrame's Five Visual Pillars strictly:
  1. Character Continuity: Preserve locked biometric traits, facial bone structure, age, and wardrobe from the active story.
  2. Biomechanical Gestures and Weight: Describe precise physical action, posture tension, finger/hand arcs, and eye gaze vectors (e.g. politicians aggressively slamming hands on tax ledgers, leaning across tables, strained neck veins, clutching leather briefcases).
  3. Atmospheric Micro-Environment: Rich tactile textures of the setting (e.g. mahogany desks, scattered fiscal papers, marble columns, smoke haze).
  4. Directional Lighting: Cinematic Kelvin lighting (e.g. 3200K tungsten spotlight, harsh overhead fluorescent, dramatic chiaroscuro).
  5. Optics and Aspect Ratio Flag: Specify lens (e.g. 35mm anamorphic prime lens, f/2.8) and aspect ratio flag matching the story (--ar 9:16 for vertical portrait, --ar 16:9 for widescreen).
  6. Modality Rule: If image mode, specify static frozen frame with zero motion blur. If video mode, specify continuous video clip dynamics.
- NEVER output a separate "Recommended Negative Prompt" box or separate negative prompt section. Incorporate all quality and negative parameters directly.
- Wrap the final revised prompt in an action tag so the UI can provide an instant one-click apply button:
  For beats:
  [REVISE_BEAT scene=X beat=Y]
  Full revised visual prompt text here...
  [/REVISE_BEAT]

  For thumbnail:
  [REVISE_THUMBNAIL]
  Full revised thumbnail prompt text here...
  [/REVISE_THUMBNAIL]

  For CTA Outro:
  [REVISE_CTA]
  Full revised CTA outro prompt text here...
  [/REVISE_CTA]

- Precede the action tag with a brief 1-sentence explanation of what changed to eliminate duplication while maintaining continuous style.

9. REFERENCE IMAGE ANALYSIS (CHARACTER AND VISUAL STYLE EXTRACTION):
When the user attaches one or more reference images:
- Treat every reference image as guidance for both Character and Visual Style unless the user asks specifically about one aspect in their message.
- Study only what is clearly visible in the image(s). Never invent unseen details, hidden props, or random guesses.
- Identify the art medium or rendering style (for example: 3D claymation, 90s anime cel animation, impasto oil painting, 35mm film photography, stop-motion felt, graphic comic ink), surface textures, primary and accent colors, lighting setup and warmth/coolness, shadow contrast, and camera/lens look.
- Identify any visible character traits: subject type, approximate age or build, facial features, expression, hair color and hairstyle, and exact clothing, materials, and accessories with colors so StoryFrame can lock them across scenes.
- Keep your explanation clear, simple, and free of asterisks, em dashes, or emojis.
- Whenever the user asks to analyze, extract, match, or use the reference image(s) (or sends images with no specific text request), always include a clean, ready-to-apply block formatted exactly like this:
  [APPLY_CHARACTER_STYLE]
  Single cohesive paragraph combining the locked visual style and character traits ready to paste directly into StoryFrame's Character & Visual Style field.
  [/APPLY_CHARACTER_STYLE]
- Inside [APPLY_CHARACTER_STYLE]...[/APPLY_CHARACTER_STYLE], write only descriptive style and character traits as a single plain-text paragraph (no headings, no bullet lists, no asterisks, no em dashes).
- If the user asks follow-up questions about story concepts or asks to revise a beat, thumbnail, or CTA prompt while an image reference is in the conversation, carry that exact visual style and character look into those prompts and action tags.`;

export interface AssistantTextSegment {
  type: 'text';
  content: string;
}

export interface AssistantReviseBeatSegment {
  type: 'revise_beat';
  scene: number;
  beat: number;
  prompt: string;
  tagId: string;
}

export interface AssistantReviseThumbnailSegment {
  type: 'revise_thumbnail';
  prompt: string;
  tagId: string;
}

export interface AssistantReviseCtaSegment {
  type: 'revise_cta';
  prompt: string;
  tagId: string;
}

export interface ApplyCharacterStyleSegment {
  type: 'apply_character_style';
  style: string;
  tagId: string;
}

export type AssistantMessageSegment =
  | AssistantTextSegment
  | AssistantReviseBeatSegment
  | AssistantReviseThumbnailSegment
  | AssistantReviseCtaSegment
  | ApplyCharacterStyleSegment;

export function parseMessageSegments(content: string, messageId: string): AssistantMessageSegment[] {
  const segments: AssistantMessageSegment[] = [];
  const regex = /\[(REVISE_BEAT\s+scene=(\d+)\s+beat=(\d+)|REVISE_THUMBNAIL|REVISE_CTA|APPLY_CHARACTER_STYLE)\]([\s\S]*?)\[\/(?:REVISE_BEAT|REVISE_THUMBNAIL|REVISE_CTA|APPLY_CHARACTER_STYLE)\]/gi;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let indexCounter = 0;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const textChunk = content.slice(lastIndex, match.index).trim();
      if (textChunk) {
        segments.push({ type: 'text', content: textChunk });
      }
    }

    const fullTag = match[1];
    const promptBody = (match[4] || '').trim();
    const tagId = `${messageId}-rev-${indexCounter++}`;

    if (fullTag.toUpperCase().startsWith('REVISE_BEAT')) {
      const sceneNum = parseInt(match[2], 10);
      const beatNum = parseInt(match[3], 10);
      segments.push({
        type: 'revise_beat',
        scene: sceneNum,
        beat: beatNum,
        prompt: promptBody,
        tagId,
      });
    } else if (fullTag.toUpperCase() === 'REVISE_THUMBNAIL') {
      segments.push({
        type: 'revise_thumbnail',
        prompt: promptBody,
        tagId,
      });
    } else if (fullTag.toUpperCase() === 'REVISE_CTA') {
      segments.push({
        type: 'revise_cta',
        prompt: promptBody,
        tagId,
      });
    } else if (fullTag.toUpperCase() === 'APPLY_CHARACTER_STYLE') {
      segments.push({
        type: 'apply_character_style',
        style: promptBody,
        tagId,
      });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    const trailing = content.slice(lastIndex).trim();
    if (trailing) {
      segments.push({ type: 'text', content: trailing });
    }
  }

  if (segments.length === 0 && content.trim().length > 0) {
    segments.push({ type: 'text', content });
  }

  return segments;
}

export function buildDefaultImagePrompt(attachments: AssistantImageAttachment[]): string {
  if (attachments.length === 0) return '';
  return 'Analyze the attached reference image(s) thoroughly and extract a consistent character and visual style description for StoryFrame.';
}

export function selectSendableAttachmentIds(
  recentHistory: AssistantChatMessage[],
  newAttachments: AssistantImageAttachment[],
  maxImages: number = MAX_ACTIVE_IMAGES_GEMINI
): Set<string> {
  const allowedIds = new Set<string>();
  // Prioritize newest turn attachments first, then walk backward through recent turns
  const ordered: AssistantImageAttachment[] = [...newAttachments];
  for (let i = recentHistory.length - 1; i >= 0; i--) {
    const atts = recentHistory[i].attachments || [];
    for (let j = atts.length - 1; j >= 0; j--) {
      ordered.push(atts[j]);
    }
  }
  for (const att of ordered) {
    if (!att.base64Data && !att.dataUrl) continue;
    if (allowedIds.size >= maxImages) break;
    allowedIds.add(att.id);
  }
  return allowedIds;
}

export function buildAttachmentContextPrefix(
  attachments: AssistantImageAttachment[],
  omittedFromBinary: boolean = false
): string {
  if (!attachments || attachments.length === 0) return '';
  const labels = attachments.map((_att, idx) => {
    const stateNote = omittedFromBinary ? ' (image binary omitted to fit model window)' : '';
    return `[Reference Image ${idx + 1}: Character & Visual Style${stateNote}]`;
  });
  return `${labels.join(' ')}\n`;
}

export async function sendChatMessage(
  history: AssistantChatMessage[],
  newMessage: string,
  apiKey: string,
  modelQuality: GeminiModelQuality = 'standard',
  provider: AiProvider = 'gemini',
  groqModel?: string,
  storyContext?: string,
  newAttachments: AssistantImageAttachment[] = []
): Promise<string> {
  const trimmedKey = (apiKey || '').trim();
  if (!trimmedKey) {
    throw new Error(
      provider === 'groq'
        ? 'Please configure a valid Groq API key in Model & API Options (console.groq.com/keys) to chat with the assistant.'
        : 'Please configure a valid Gemini API key in Model & API Options to chat with the assistant.'
    );
  }

  const effectiveMessage = newMessage.trim() || buildDefaultImagePrompt(newAttachments);
  if (!effectiveMessage) {
    throw new Error('Please enter a message or attach a reference image.');
  }

  // Build effective system instruction with active story context if present
  const effectiveSystemInstruction = storyContext && storyContext.trim().length > 0
    ? `${SYSTEM_INSTRUCTION}\n\n================================================================================\nACTIVE STORYBOARD CONTEXT (CURRENT STORY LOADED IN THE APP):\n================================================================================\n${storyContext.trim()}`
    : SYSTEM_INSTRUCTION;

  // Format message history (keep last 6 messages to minimize token usage)
  const recentHistory = history.slice(-6);
  const resolvedGroqModel = groqModel || (modelQuality === 'high' ? 'openai/gpt-oss-120b' : 'qwen/qwen3.8-27b');
  const maxProviderImages = getMaxImagesForProvider(provider, resolvedGroqModel);
  const sendableAttachmentIds = selectSendableAttachmentIds(recentHistory, newAttachments, maxProviderImages);

  if (provider === 'groq') {
    const targetModel = resolvedGroqModel;
    const supportsVision = isGroqVisionModel(targetModel);

    if (newAttachments.length > 0 && !supportsVision) {
      throw new Error(
        `The active Groq model (${targetModel}) only supports text. Switch to Gemini or select Qwen 3.8 27B under Model Options to analyze reference images.`
      );
    }

    if (newAttachments.length > maxProviderImages) {
      throw new Error(
        `The active Groq model (${targetModel}) accepts up to ${maxProviderImages} reference images per message. Remove extra images or switch to Gemini for up to ${MAX_ACTIVE_IMAGES_GEMINI} images.`
      );
    }

    const buildGroqUserContent = (
      text: string,
      attachments: AssistantImageAttachment[] = []
    ): string | GroqChatContentPart[] => {
      const activeImages = supportsVision
        ? attachments.filter((att) => sendableAttachmentIds.has(att.id) && att.dataUrl)
        : [];
      const prefix = buildAttachmentContextPrefix(
        attachments,
        attachments.length > 0 && activeImages.length < attachments.length
      );
      const combinedText = `${prefix}${text}`.trim();

      if (activeImages.length === 0) {
        return combinedText;
      }

      const parts: GroqChatContentPart[] = [{ type: 'text', text: combinedText }];
      for (const img of activeImages) {
        parts.push({
          type: 'image_url',
          image_url: { url: img.dataUrl },
        });
      }
      return parts;
    };

    const messages: GroqChatMessage[] = [
      { role: 'system', content: effectiveSystemInstruction },
      ...recentHistory.map((msg) => ({
        role: msg.role === 'user' ? ('user' as const) : ('assistant' as const),
        content:
          msg.role === 'user'
            ? buildGroqUserContent(msg.content, msg.attachments || [])
            : msg.content,
      })),
      {
        role: 'user',
        content: buildGroqUserContent(effectiveMessage, newAttachments),
      },
    ];

    try {
      const content = await callGroqChatCompletion(trimmedKey, messages, {
        model: targetModel,
        jsonMode: false,
        temperature: 0.6,
        maxTokens: 1400,
      });

      if (!content || !content.trim()) {
        throw new Error('An error occurred, please try again.');
      }

      return cleanAssistantText(content.trim());
    } catch (err: any) {
      const msg = err?.message || '';
      throw new Error(msg || 'An error occurred with Groq Assistant, please try again.');
    }
  }

  // Provider: Gemini
  const buildGeminiUserParts = (
    text: string,
    attachments: AssistantImageAttachment[] = []
  ): Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> => {
    const activeImages = attachments.filter(
      (att) => sendableAttachmentIds.has(att.id) && att.base64Data
    );
    const prefix = buildAttachmentContextPrefix(
      attachments,
      attachments.length > 0 && activeImages.length < attachments.length
    );
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: `${prefix}${text}`.trim() },
    ];
    for (const img of activeImages) {
      parts.push({
        inlineData: {
          mimeType: img.mimeType || 'image/jpeg',
          data: img.base64Data,
        },
      });
    }
    return parts;
  };

  const contents: any[] = [];

  // Add conversation turns
  for (const msg of recentHistory) {
    contents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts:
        msg.role === 'user'
          ? buildGeminiUserParts(msg.content, msg.attachments || [])
          : [{ text: msg.content }],
    });
  }

  // Add latest user query
  contents.push({
    role: 'user',
    parts: buildGeminiUserParts(effectiveMessage, newAttachments),
  });

  // Use the exact model chosen by the user in Model Options (no fallback switching)
  const targetModel = resolveGeminiModelId(modelQuality);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${trimmedKey}`;

  const generationConfig: Record<string, any> = {
    maxOutputTokens: 1400,
  };
  if (targetModel !== 'gemini-4-hydrogen') {
    generationConfig.temperature = 0.6;
    generationConfig.topP = 0.9;
  }

  const payload = {
    contents,
    systemInstruction: {
      parts: [{ text: effectiveSystemInstruction }],
    },
    generationConfig,
  };

  try {
    const resp = await fetchWithExponentialBackoff(() =>
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    );

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(sanitizeGenericErrorMessage(`API error (${resp.status}): ${errText}`, trimmedKey, 'gemini', targetModel));
    }

    const resJson = await resp.json();
    extractAndRecordGeminiUsage(resJson, targetModel);
    const content = extractGeminiResponseText(resJson);
    if (!content) {
      throw new Error('An error occurred, please try again.');
    }

    return cleanAssistantText(content);
  } catch (err: any) {
    const msg = err?.message || '';
    throw new Error(sanitizeGenericErrorMessage(msg || 'An error occurred, please try again.', trimmedKey, 'gemini', targetModel));
  }
}
