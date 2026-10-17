// Direct client-side execution for Groq Cloud API.
// Dispatched directly from the browser to Groq's OpenAI-compatible endpoint.
// Keys remain strictly in client sessionStorage and are never transmitted to third-party servers.

import { fetchWithExponentialBackoff } from '../utils/retryFetch';

export const GROQ_API_BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';

export interface GroqChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GroqChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  signal?: AbortSignal;
  onStatusMessage?: (msg: string) => void;
}

/**
 * Normalizes special unicode characters (non-breaking hyphens, non-breaking spaces, smart quotes)
 * into standard ASCII to prevent tokenizer and JSON syntax errors.
 */
export function sanitizePromptText(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u2010\u2011\u2012]/g, '-')
    .replace(/[\u2013\u2014]/g, ', ')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"');
}

/**
 * Attempts to repair truncated JSON strings by balancing unclosed quotes, brackets, and braces.
 */
export function tryRepairTruncatedJson(raw: string): any {
  if (!raw || typeof raw !== 'string') return null;
  let text = raw.trim();

  // Strip code fences if present
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/i);
  if (fenceMatch && fenceMatch[1]) {
    text = fenceMatch[1].trim();
  }

  // Find start of JSON object or array
  const startIdx = text.search(/[{\[]/);
  if (startIdx === -1) return null;
  text = text.slice(startIdx);

  // If already valid JSON
  try {
    return JSON.parse(text);
  } catch {
    // Continue with repair heuristics
  }

  // Trim trailing invalid partial tokens (like trailing commas, unclosed keys or values)
  text = text.replace(/,\s*$/, '').trim();

  // State machine to close open quotes and track bracket stack
  let inString = false;
  let isEscaped = false;
  const stack: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (ch === '\\') {
        isEscaped = true;
      } else if (ch === '"') {
        inString = false;
      }
    } else {
      if (ch === '"') {
        inString = true;
      } else if (ch === '{') {
        stack.push('}');
      } else if (ch === '[') {
        stack.push(']');
      } else if (ch === '}' || ch === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === ch) {
          stack.pop();
        }
      }
    }
  }

  // If cut off inside an open string, close the string
  let repaired = text;
  if (inString) {
    repaired += '"';
  }

  // Remove any trailing comma that preceded closure
  repaired = repaired.replace(/,\s*([}\]]|$)/g, '$1');

  // Close remaining unclosed brackets in reverse LIFO order
  while (stack.length > 0) {
    const closeChar = stack.pop();
    repaired += closeChar;
  }

  try {
    return JSON.parse(repaired);
  } catch {
    // Second-pass: try aggressively rolling back to the last complete item in an array/object
    const lastValidComma = repaired.lastIndexOf(',');
    if (lastValidComma > startIdx) {
      let sub = repaired.slice(0, lastValidComma);
      // Re-balance stack
      const subStack: string[] = [];
      let subInStr = false;
      let subEsc = false;
      for (const ch of sub) {
        if (subInStr) {
          if (subEsc) subEsc = false;
          else if (ch === '\\') subEsc = true;
          else if (ch === '"') subInStr = false;
        } else {
          if (ch === '"') subInStr = true;
          else if (ch === '{') subStack.push('}');
          else if (ch === '[') subStack.push(']');
          else if (ch === '}' || ch === ']') {
            if (subStack.length > 0 && subStack[subStack.length - 1] === ch) subStack.pop();
          }
        }
      }
      while (subStack.length > 0) {
        sub += subStack.pop();
      }
      try {
        return JSON.parse(sub);
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Executes a chat completion call directly to Groq Cloud API with robust JSON mode error recovery.
 */
export async function callGroqChatCompletion(
  apiKey: string,
  messages: GroqChatMessage[],
  options: GroqChatOptions = {}
): Promise<string> {
  const trimmedKey = (apiKey || '').trim();
  if (!trimmedKey) {
    throw new Error('Groq API Key is required. Please add your key in Model & API Options.');
  }

  const model = options.model || 'openai/gpt-oss-120b';
  const temperature = options.temperature ?? 0.2;
  // Default to 8192 max tokens to prevent premature JSON truncation on multi-scene storyboards
  const maxTokens = options.maxTokens || 8192;

  // Sanitize non-breaking hyphens and unusual whitespace in user prompts
  const sanitizedMessages = messages.map((m) => ({
    role: m.role,
    content: sanitizePromptText(m.content),
  }));

  const payload: Record<string, any> = {
    model,
    messages: sanitizedMessages,
    temperature,
    max_tokens: maxTokens,
  };

  if (options.jsonMode) {
    payload.response_format = { type: 'json_object' };
  }

  const executeRequest = async (currentPayload: Record<string, any>) => {
    return fetchWithExponentialBackoff(
      () =>
        fetch(GROQ_API_BASE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${trimmedKey}`,
          },
          body: JSON.stringify(currentPayload),
          signal: options.signal,
        }),
      {
        initialDelayMs: 2000,
        maxAttempts: 4,
        onRetry: (attempt, _max, delayMs) => {
          if (options.onStatusMessage) {
            options.onStatusMessage(
              `Groq API rate limit or server busy. Retrying (Attempt ${attempt}/4, waiting ${Math.round(delayMs / 1000)}s)...`
            );
          }
        },
      }
    );
  };

  let response = await executeRequest(payload);

  if (!response.ok) {
    let errorDetail = '';
    let failedGen: string | undefined = undefined;

    try {
      const errJson = await response.json();
      errorDetail = errJson?.error?.message || JSON.stringify(errJson);
      failedGen = errJson?.error?.failed_generation;
    } catch {
      errorDetail = await response.text().catch(() => 'Unknown network error');
    }

    // 1. If Groq failed JSON validation (code: json_validate_failed), check failed_generation first
    if (response.status === 400 && (errorDetail.includes('Failed to validate JSON') || errorDetail.includes('json_validate_failed'))) {
      if (failedGen && typeof failedGen === 'string' && failedGen.trim().length > 10) {
        const repaired = tryRepairTruncatedJson(failedGen);
        if (repaired && typeof repaired === 'object') {
          return JSON.stringify(repaired);
        }
      }

      // 2. Fallback: Retry once WITHOUT response_format: json_object
      // In raw mode, Groq does not reject the response via its strict proxy validator,
      // and our client-side extractCleanJson will cleanly parse it.
      if (options.jsonMode) {
        if (options.onStatusMessage) {
          options.onStatusMessage('Re-requesting from Groq with resilient JSON streaming...');
        }
        const fallbackPayload: Record<string, any> = {
          ...payload,
          messages: [
            ...sanitizedMessages,
            {
              role: 'user',
              content: 'CRITICAL INSTRUCTION: Your output MUST be strictly valid, raw JSON only. Do not include markdown formatting or commentary.',
            },
          ],
        };
        delete fallbackPayload.response_format;

        const fallbackResp = await executeRequest(fallbackPayload);
        if (fallbackResp.ok) {
          const fallbackData = await fallbackResp.json();
          const fallbackContent = fallbackData?.choices?.[0]?.message?.content;
          if (fallbackContent && typeof fallbackContent === 'string') {
            return fallbackContent;
          }
        }
      }
    }

    if (response.status === 401) {
      throw new Error(
        'Groq API key is invalid or unauthorized. Please verify your API key from console.groq.com/keys.'
      );
    } else if (response.status === 429) {
      throw new Error(
        'Groq free-tier rate limit reached. Please wait a few seconds before trying again.'
      );
    } else {
      throw new Error(
        `Groq API error (${response.status}): ${sanitizeGroqErrorMessage(errorDetail, trimmedKey)}`
      );
    }
  }

  const data = await response.json();
  const rawContent = data?.choices?.[0]?.message?.content;
  if (!rawContent || typeof rawContent !== 'string') {
    throw new Error('Empty response received from Groq API.');
  }

  return rawContent;
}

/**
 * Robust JSON extractor from model text (removes markdown code fences and extraneous text).
 */
export function extractCleanJson(raw: string): any {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Empty response received from LLM.');
  }

  const cleaned = raw.trim();

  // 1. Try direct parse first
  try {
    return JSON.parse(cleaned);
  } catch {
    // Continue with markdown fence removal
  }

  // 2. Remove markdown code fences like ```json ... ```
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch && fenceMatch[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // Continue to bracket search
    }
  }

  // 3. Find outermost JSON object
  const startObj = cleaned.indexOf('{');
  const endObj = cleaned.lastIndexOf('}');
  if (startObj !== -1 && endObj !== -1 && endObj > startObj) {
    try {
      return JSON.parse(cleaned.slice(startObj, endObj + 1));
    } catch {
      // Continue
    }
  }

  // 4. Find outermost JSON array
  const startArr = cleaned.indexOf('[');
  const endArr = cleaned.lastIndexOf(']');
  if (startArr !== -1 && endArr !== -1 && endArr > startArr) {
    try {
      return JSON.parse(cleaned.slice(startArr, endArr + 1));
    } catch {
      // Continue
    }
  }

  // 5. Try heuristic repair on truncated JSON
  const repaired = tryRepairTruncatedJson(cleaned);
  if (repaired && typeof repaired === 'object') {
    return repaired;
  }

  throw new Error(`Failed to parse structured JSON from model response: ${cleaned.slice(0, 160)}...`);
}

/**
 * Redacts any accidental leakage of API keys from error messages.
 */
export function sanitizeGroqErrorMessage(msg: string, keyToRedact?: string): string {
  let sanitized = msg;
  if (keyToRedact && keyToRedact.length > 6) {
    sanitized = sanitized.split(keyToRedact).join('[REDACTED]');
  }
  return sanitized.replace(/gsk_[a-zA-Z0-9_-]+/g, '[REDACTED_GROQ_KEY]');
}
