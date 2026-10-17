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
 * Executes a chat completion call directly to Groq Cloud API.
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

  const payload: Record<string, any> = {
    model,
    messages,
    temperature,
  };

  if (options.jsonMode) {
    payload.response_format = { type: 'json_object' };
  }

  if (options.maxTokens) {
    payload.max_tokens = options.maxTokens;
  }

  const response = await fetchWithExponentialBackoff(
    () =>
      fetch(GROQ_API_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${trimmedKey}`,
        },
        body: JSON.stringify(payload),
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

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errJson = await response.json();
      errorDetail = errJson?.error?.message || JSON.stringify(errJson);
    } catch {
      errorDetail = await response.text().catch(() => 'Unknown network error');
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
