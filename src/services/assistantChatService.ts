import { AssistantChatMessage } from '../types';

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
  - Text to Video Mode: Crafts 8-part cinematic video prompts (subject, action, camera movement, lighting, physics, audio, duration, and aspect ratio) calibrated to 3-6 second clips, with keyframe start frame prompts.
  - Enhanced Story Architect (Auto-Architect Mode): Optimizes pacing, visual hooks, and micro-action segmentation for high-retention short-form videos.
  - Custom Beat Cutter: Allows directors to segment sentences into exact custom beats with custom visual notes.
  - BYOK Security: Direct client-side execution; API keys are never stored on any remote backend.

3. BRAINSTORMING & CREATIVE ASSISTANCE:
- You excel at brainstorming complete story ideas, especially stories inspired by Zack D. Films:
  - Zack D. Films style: Short (30-60 seconds), fascinating, punchy stories exploring curious human biology, unusual medical conditions, bizarre historical occurrences, everyday mysteries, or "what happens if..." scenarios with vivid physical transformations, suspenseful pacing, and a sudden intriguing twist or explanation at the end.
  - When the user asks for a story idea or Zack D. Films concept, provide a full, complete story narrative (3 to 6 complete sentences) with a strong hook, suspenseful escalation, and clear explanation or ending so the user can immediately use it in the generator. Never stop halfway.
- You suggest distinct, evocative art and character styles:
  - e.g., 3D Claymation, Vintage 1970s Dark Fantasy, Retro Cyberpunk Noir, High-contrast Manga Ink, Isometric Pixel Diorama, Hyper-realistic 35mm Anamorphic Film, 1930s Rubber Hose Animation, Risograph Print.
- You help users format their story prompts for YouTube (16:9 widescreen) or TikTok/Reels/Shorts (9:16 vertical).

4. STRICT SCOPE & OFF-TOPIC REJECTION:
- You must strictly answer questions related to StoryFrame, creative storytelling, Zack D. Films inspired ideas, character styling, prompt crafting, and the creator (Imaqtpyke).
- If the user asks about unrelated topics (such as general software development unrelated to StoryFrame, math problems, cooking recipes, general news, or general trivia outside storytelling), politely decline and state that you are dedicated solely to StoryFrame and storytelling assistance.

5. MANDATORY FORMATTING AND STYLE RULES:
- ALWAYS WRITE COMPLETE SENTENCES: Every single response must consist of full, grammatically complete sentences. Never give truncated thoughts, incomplete sentences, or snippets.
- NEVER TRUNCATE: Conclude every idea, narrative, and explanation fully with proper punctuation.
- STRICTLY ZERO ASTERISKS: NEVER use the asterisk character (*) or double asterisks (**) anywhere in your response. Do not use asterisks for bolding, bullet points, italics, or emphasis. Use plain readable text, numbers, or dashes (-) for lists.
- STRICTLY NO EM DASHES: Do not use "\u2014". Use standard hyphens (-) or colons (:).
- STRICTLY NO EMOJIS: Do not use any emoji characters.
- Use clear, simple, human language.`;

export async function sendChatMessage(
  history: AssistantChatMessage[],
  newMessage: string,
  apiKey: string
): Promise<string> {
  const trimmedKey = (apiKey || '').trim();
  if (!trimmedKey) {
    throw new Error('Please configure a valid Gemini API key in the Model Options section to talk with the assistant.');
  }

  // Format message history for Gemini (keep last 6 messages to minimize token usage)
  const recentHistory = history.slice(-6);

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

  const candidateModels = [
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-2.5-flash',
  ];

  let replyText = '';
  let lastError: Error | null = null;

  for (const modelName of candidateModels) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${trimmedKey}`;

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

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const errBody = await resp.text();
        throw new Error(`API error (${resp.status}): ${errBody}`);
      }

      const resJson = await resp.json();
      const content = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content || !content.trim()) {
        throw new Error('The model returned an empty response.');
      }

      replyText = content.trim();
      break;
    } catch (err: any) {
      lastError = err;
    }
  }

  if (!replyText) {
    let cleanMsg = lastError?.message || 'Failed to receive a response from the assistant.';
    if (trimmedKey.length > 6) {
      cleanMsg = cleanMsg.replaceAll(trimmedKey, '[REDACTED]');
    }
    throw new Error(cleanMsg);
  }

  return cleanAssistantText(replyText);
}
