import { AiProvider } from '../types';
import { fetchWithExponentialBackoff } from '../utils/retryFetch';
import { callGroqChatCompletion, extractCleanJson, sanitizeGroqErrorMessage } from './groqClient';

export interface UnifiedJsonRequest {
  provider?: AiProvider;
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  modelQuality?: 'standard' | 'high';
  groqModel?: string;
  userSignal?: AbortSignal;
  onStatusMessage?: (msg: string) => void;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}

/**
 * Redacts sensitive API keys and formats user-friendly error messages.
 */
export function sanitizeGenericErrorMessage(errorText: string, apiKey: string, provider: AiProvider = 'gemini'): string {
  if (!errorText) return 'An unexpected error occurred.';
  let cleaned = errorText;
  if (apiKey && apiKey.length > 6) {
    cleaned = cleaned.replaceAll(apiKey, '[REDACTED]');
  }

  if (provider === 'groq') {
    return sanitizeGroqErrorMessage(cleaned, apiKey);
  }

  const lower = cleaned.toLowerCase();
  if (lower.includes('caller does not have permission') || lower.includes('permission_denied')) {
    return `The caller does not have permission. Please verify that:
1. Your API key has the "Generative Language API" enabled in Google Cloud / Google AI Studio.
2. If your key has HTTP referrer restrictions, ensure this application domain is permitted or remove the referrer restriction.
3. If using an AI Studio key, ensure it is active at https://aistudio.google.com/app/apikey.`;
  }
  if (lower.includes('503') || lower.includes('overloaded') || lower.includes('service unavailable')) {
    return 'Google Gemini servers are temporarily busy. Please wait a moment and click Retry Breakdown.';
  }
  if (lower.includes('429') || lower.includes('quota') || lower.includes('resource has been exhausted')) {
    return `Gemini API rate limit or quota exceeded (429).
Please wait a moment before trying again, or check your quotas at https://aistudio.google.com/.`;
  }
  return cleaned;
}

/**
 * Robust JSON extraction helper that handles raw text, markdown blocks, and surrounding commentary.
 */
export function robustJsonParse<T = any>(rawText: string): T {
  return extractCleanJson(rawText);
}

/**
 * Unified JSON dispatch executing against either Google Gemini or Groq Cloud API.
 */
export async function executeJsonLlmCall<T = any>(params: UnifiedJsonRequest): Promise<T> {
  const {
    provider = 'gemini',
    apiKey,
    systemPrompt,
    userPrompt,
    modelQuality = 'standard',
    groqModel,
    userSignal,
    onStatusMessage,
    temperature = 0.3,
    topP = 0.85,
    maxTokens,
  } = params;

  if (userSignal?.aborted) {
    throw new DOMException('Generation request was cancelled by user.', 'AbortError');
  }

  const trimmedKey = (apiKey || '').trim();
  if (!trimmedKey) {
    throw new Error(
      provider === 'groq'
        ? 'Groq API key is required. Please apply your key under Model & API Options (get one at console.groq.com/keys).'
        : 'Gemini API key is required. Please apply your key under Model & API Options.'
    );
  }

  // Provider: GROQ CLOUD
  if (provider === 'groq') {
    const targetModel = groqModel || (modelQuality === 'high' ? 'openai/gpt-oss-120b' : 'qwen/qwen3.8-27b');
    try {
      const rawText = await callGroqChatCompletion(
        trimmedKey,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        {
          model: targetModel,
          temperature,
          maxTokens: maxTokens || 8192,
          signal: userSignal,
          onStatusMessage,
          jsonMode: true,
        }
      );

      return robustJsonParse<T>(rawText);
    } catch (err: any) {
      if (userSignal?.aborted || err?.name === 'AbortError') {
        throw new DOMException('Generation request was cancelled by user.', 'AbortError');
      }
      throw new Error(sanitizeGenericErrorMessage(err?.message || 'Groq request failed', trimmedKey, 'groq'));
    }
  }

  // Provider: GEMINI (Google Generative Language API)
  const targetModel = modelQuality === 'high' ? 'gemini-3.1-pro-preview' : 'gemini-3.8-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${trimmedKey}`;

  const payload: Record<string, any> = {
    contents: [
      {
        role: 'user',
        parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
      },
    ],
    generationConfig: {
      temperature,
      topP,
      responseMimeType: 'application/json',
    },
  };

  if (typeof maxTokens === 'number' && maxTokens > 0) {
    payload.generationConfig.maxOutputTokens = maxTokens;
  }

  try {
    const resp = await fetchWithExponentialBackoff(
      () =>
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: userSignal,
        }),
      {
        onRetry: (attempt, maxAttempts, delayMs) => {
          if (onStatusMessage) {
            const sec = Math.ceil(delayMs / 1000);
            onStatusMessage(`Server busy (503/429). Retrying in ${sec}s (Attempt ${attempt} of ${maxAttempts})...`);
          }
        },
      }
    );

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`API error (${resp.status}): ${errText}`);
    }

    const resJson = await resp.json();
    const contentCandidate = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!contentCandidate) {
      throw new Error('Empty response from model');
    }

    return robustJsonParse<T>(contentCandidate);
  } catch (err: any) {
    if (userSignal?.aborted || err?.name === 'AbortError') {
      throw new DOMException('Generation request was cancelled by user.', 'AbortError');
    }
    throw new Error(sanitizeGenericErrorMessage(err?.message || 'Failed to generate content with Gemini.', trimmedKey, 'gemini'));
  }
}
