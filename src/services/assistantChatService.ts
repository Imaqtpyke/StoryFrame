import { AssistantChatMessage } from '../types';
import { fetchWithExponentialBackoff } from '../utils/retryFetch';

const CHAT_STORAGE_KEY = 'storyframe_assistant_chat_history_v1';

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
  try {
    sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-20)));
  } catch {
    // Ignore storage quota errors
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
- ZERO CONVERSATIONAL FILLER: Never start with throat-clearing phrases like "Sure!", "Here is what you asked for:", or "Certainly!". Deliver the requested content directly to save tokens.`;

import { AiProvider } from '../types';
import { callGroqChatCompletion } from './groqClient';

export async function sendChatMessage(
  history: AssistantChatMessage[],
  newMessage: string,
  apiKey: string,
  modelQuality: 'standard' | 'high' = 'standard',
  provider: AiProvider = 'gemini',
  groqModel?: string
): Promise<string> {
  const trimmedKey = (apiKey || '').trim();
  if (!trimmedKey) {
    throw new Error(
      provider === 'groq'
        ? 'Please configure a valid Groq API key in Model & API Options (console.groq.com/keys) to chat with the assistant.'
        : 'Please configure a valid Gemini API key in Model & API Options to chat with the assistant.'
    );
  }

  // Format message history (keep last 6 messages to minimize token usage)
  const recentHistory = history.slice(-6);

  if (provider === 'groq') {
    const targetModel = groqModel || (modelQuality === 'high' ? 'openai/gpt-oss-120b' : 'qwen/qwen3.8-27b');
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: SYSTEM_INSTRUCTION },
      ...recentHistory.map((msg) => ({
        role: msg.role === 'user' ? ('user' as const) : ('assistant' as const),
        content: msg.content,
      })),
      { role: 'user', content: newMessage.trim() },
    ];

    try {
      const content = await callGroqChatCompletion(trimmedKey, messages, {
        model: targetModel,
        jsonMode: false,
        temperature: 0.6,
        maxTokens: 1200,
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
  const contents: any[] = [];

  // Add conversation turns
  for (const msg of recentHistory) {
    contents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    });
  }

  // Add latest user query
  contents.push({
    role: 'user',
    parts: [{ text: newMessage.trim() }],
  });

  // Use the exact model chosen by the user in Model Options (no fallback switching)
  const targetModel = modelQuality === 'high' ? 'gemini-3.1-pro-preview' : 'gemini-3.8-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${trimmedKey}`;

  const payload = {
    contents,
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    generationConfig: {
      temperature: 0.6,
      topP: 0.9,
      maxOutputTokens: 1200,
    },
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
      if (resp.status === 503 || resp.status === 429) {
        throw new Error(
          'Google Gemini servers are temporarily busy (503 Service Unavailable). Do not immediately retry the request at full speed, as this adds more stress to an already struggling server. Instead, we used an exponential backoff strategy—waiting a brief period before retrying, and doubling the wait time for subsequent attempts. Please try again shortly.'
        );
      }
      throw new Error(`Server status ${resp.status}: Service temporarily unavailable. Please try again shortly.`);
    }

    const resJson = await resp.json();
    const content = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content || !content.trim()) {
      throw new Error('An error occurred, please try again.');
    }

    return cleanAssistantText(content.trim());
  } catch (err: any) {
    const msg = err?.message || '';
    if (msg.includes('503') || msg.includes('overloaded') || msg.includes('unavailable')) {
      throw new Error(
        'Google Gemini servers are temporarily busy (503 Service Unavailable). Do not immediately retry the request at full speed, as this adds more stress to an already struggling server. Instead, we used an exponential backoff strategy—waiting a brief period before retrying, and doubling the wait time for subsequent attempts. Please try again shortly.'
      );
    }
    throw new Error(msg || 'An error occurred, please try again.');
  }
}
