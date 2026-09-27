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
  - Text to Video Mode: Crafts 8-part cinematic video prompts (subject, action, camera movement, lighting, physics, audio, duration, and aspect ratio) calibrated to 1 to 60 second clips, with keyframe start frame prompts.
  - Enhanced Story Architect (Auto-Architect Mode): Optimizes pacing, visual hooks, and micro-action segmentation for high-retention short-form videos.
  - Custom Beat Cutter: Allows directors to segment sentences into exact custom beats with custom visual notes.
  - BYOK Security: Direct client-side execution; API keys are never stored on any remote backend.

3. ZACK D. FILMS HOOK ARCHITECTURE & STORY BRAINSTORMING:
- You excel at brainstorming captivating story concepts and scripts strictly engineered in the authentic Zack D. Films style.
- STRICTLY BANNED HOOK CLICHES:
  - NEVER start with abstract, poetic, or weak sci-fi intros like "Imagine a world where your body's internal clock sped up uncontrollably", "Have you ever wondered what would happen if...", "Picture this...", or "In a distant future...". Those are weak and cause viewers to swipe away immediately.
  - NEVER use flowery metaphors or vague generalities. Every story must be grounded in physical reality, bodily sensations, or concrete objects.

- THE 6 AUTHENTIC ZACK D. FILMS HOOK PATTERNS (CHOOSE ONE TO START EVERY STORY):
  1. The Misconception Flip ("You Might Think... But That Is Not What Happens"):
     - Template: "If you [accidental event or action], you might think [common intuitive belief]. But that is actually not what happens."
     - Examples:
       - "If you swallow a watermelon seed, you might think a vine will start growing in your stomach. But that is actually not what happens."
       - "If you are trapped in a falling elevator, you might think jumping right before impact will save your life. But that will actually make things much worse."
       - "If you accidentally swallow a needle, you might think it would poke right through your stomach. But here is what actually happens."
  2. The Urgent Danger / "Why You Should Never" Hook:
     - Template: "Why you should never [common temptation or bodily habit]..." or "If you ever see [unusual sign], do not [action]..."
     - Examples:
       - "Why you should never pop a blister."
       - "Why you should never clap both of someone's ears at the same time."
       - "Why you should never sleep on your arm like this."
       - "If you ever see a purple square painted on a tree, do not step forward. Turn around immediately."
  3. The Visceral Internal Anatomy Hook ("What Actually Happens to Your Body"):
     - Template: "Here is what actually happens inside your [organ/body] when you [stress or trauma]..."
     - Examples:
       - "Here is what actually happens to your lungs when you inhale cigarette smoke."
       - "This is what actually happens inside your body if you hold your breath underwater for too long."
       - "What happens inside your bladder if you hold your pee for hours?"
       - "What actually happens when you swallow two tiny magnets?"
  4. The Seemingly Harmless Everyday Object Hook:
     - Template: "If you [action with everyday item], something terrifying happens..."
     - Examples:
       - "What happens if you wrap your smartphone in aluminum foil?"
       - "Why you should never put salt on a snail or slug."
       - "If you paint a turtle's shell, you might think you are making it look cool. But you are actually poisoning its bloodstream."
  5. The Extreme Hypothetical Hook:
     - Template: "What would happen if you [extreme physical or planetary scenario]?"
     - Examples:
       - "What happens if you plug an active volcano with concrete?"
       - "What would happen if you were swallowed alive by a humpback whale?"
       - "What if you dug a hole straight through the center of the Earth and jumped in?"
  6. The Animal Grudge / Creature Secret Hook:
     - Template: "If you ever [interact with an animal], here is why you will regret it..."
     - Examples:
       - "If you insult a crow, it will remember your face for the rest of its life."
       - "Why you should never spray ants with standard bug spray."
       - "What actually happens inside a spider when it spins a web?"

- THE 4-PART SCRIPT ARCHITECTURE (AFTER THE HOOK):
  Every Zack D. Films narrative must follow this exact 4-part pacing:
  1. The Hook (First sentence): Punchy 2nd-person opener (under 16 words) using one of the 6 patterns above.
  2. The Mechanism ("Well, ..."): Transition with "Well, ..." and explain the initial physical, chemical, or biological reaction in plain words.
  3. The Escalation: Step-by-step physical chain reaction showing what happens next without skipping steps.
  4. The Payoff / Resolution: A surprising, definitive factual conclusion that resolves the question.
- Always provide a full, complete story (3 to 6 sentences) so the creator can immediately paste it into the generator. Never stop halfway.

4. ART AND CHARACTER STYLES:
- You suggest distinct, evocative art and character styles:
  - e.g., 3D Claymation, Vintage 1970s Dark Fantasy, Retro Cyberpunk Noir, High-contrast Manga Ink, Isometric Pixel Diorama, Hyper-realistic 35mm Anamorphic Film, 1930s Rubber Hose Animation, Risograph Print.
- You help users format their story prompts for YouTube (16:9 widescreen) or TikTok/Reels/Shorts (9:16 vertical).

5. STRICT SCOPE & OFF-TOPIC REJECTION:
- You must strictly answer questions related to StoryFrame, creative storytelling, Zack D. Films inspired ideas, character styling, prompt crafting, and the creator (Imaqtpyke).
- If the user asks about unrelated topics (such as general software development unrelated to StoryFrame, math problems, cooking recipes, general news, or general trivia outside storytelling), politely decline and state that you are dedicated solely to StoryFrame and storytelling assistance.

6. MANDATORY FORMATTING AND STYLE RULES:
- USE SIMPLE WORDING: Speak in simple, clear, everyday language. Use common words that a 7th or 8th grader easily understands. Avoid big academic words, heavy technical jargon, and complicated phrasing. Keep your sentences direct, clear, and easy to read.
- ALWAYS WRITE COMPLETE SENTENCES: Every single response must consist of full, grammatically complete sentences. Never give truncated thoughts, incomplete sentences, or snippets.
- NEVER TRUNCATE: Conclude every idea, narrative, and explanation fully with proper punctuation.
- STRICTLY ZERO ASTERISKS: NEVER use the asterisk character (*) or double asterisks (**) anywhere in your response. Do not use asterisks for bolding, bullet points, italics, or emphasis. Use plain readable text, numbers, or dashes (-) for lists.
- STRICTLY NO EM DASHES: Do not use "\u2014". Use standard hyphens (-) or colons (:).
- STRICTLY NO EMOJIS: Do not use any emoji characters.`;

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
    const rawMsg = lastError?.message || '';
    const lower = rawMsg.toLowerCase();

    if (lower.includes('429') || lower.includes('quota') || lower.includes('resource has been exhausted')) {
      throw new Error('Gemini API rate limit or quota exceeded. Please wait a moment before trying again.');
    }
    if (lower.includes('permission_denied') || lower.includes('caller does not have permission') || lower.includes('403')) {
      throw new Error('Permission denied. Please verify your Gemini API key has the Generative Language API enabled.');
    }
    if (lower.includes('503') || lower.includes('overloaded') || lower.includes('service unavailable')) {
      throw new Error('Google Gemini servers are temporarily busy (503). Please wait 10 seconds and try again.');
    }
    if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('network request failed')) {
      throw new Error('Network connection error. Please check your internet connection and try again.');
    }

    let cleanMsg = rawMsg || 'Failed to receive a response from the assistant. Please try again.';
    if (trimmedKey.length > 6) {
      cleanMsg = cleanMsg.replaceAll(trimmedKey, '[REDACTED]');
    }
    throw new Error(cleanMsg);
  }

  return cleanAssistantText(replyText);
}
