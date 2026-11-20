import { AiProvider } from '../types';
import { fetchWithExponentialBackoff } from '../utils/retryFetch';
import {
  callGroqChatCompletion,
  extractCleanJson,
  GROQ_API_BASE_URL,
  sanitizeGroqErrorMessage,
  sanitizePromptText,
} from './groqClient';
import { extractAndRecordGeminiUsage, extractAndRecordGroqUsage } from './aiUsageStorage';

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
  thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high';
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
  if (lower.includes('404') || lower.includes('not_found') || lower.includes('is not found')) {
    return 'The requested Gemini model is unavailable or unsupported (404). Please verify your selected Gemini model.';
  }
  if (lower.includes('api_key_invalid') || lower.includes('api key not valid')) {
    return 'Your Gemini API key appears invalid (400). Please check your key in Model & API Settings.';
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
 * Extracts generated text from Gemini candidates while skipping internal thinking parts.
 */
export function extractGeminiResponseText(resJson: any): string {
  const parts = resJson?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  const nonThoughtText = parts
    .filter((p: any) => p && !p.thought && typeof p.text === 'string')
    .map((p: any) => p.text)
    .join('')
    .trim();
  if (nonThoughtText) return nonThoughtText;
  return parts
    .filter((p: any) => p && typeof p.text === 'string')
    .map((p: any) => p.text)
    .join('')
    .trim();
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
    thinkingLevel,
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
  const targetModel = modelQuality === 'high' ? 'gemini-3.1-pro-preview' : 'gemini-4-hydrogen';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${trimmedKey}`;

  const isThinkingModel = targetModel === 'gemini-4-hydrogen' || targetModel === 'gemini-3.1-pro-preview';
  const defaultThinking: 'minimal' | 'low' = targetModel === 'gemini-3.1-pro-preview' ? 'low' : 'minimal';

  const buildGeminiPayload = (level: 'minimal' | 'low' | 'medium' | 'high' | 'none'): Record<string, any> => {
    const generationConfig: Record<string, any> = {
      responseMimeType: 'application/json',
    };

    // Gemini 3 & 4 models reject legacy temperature/topP and use thinkingLevel;
    // cap thinkingLevel to avoid multi-minute reasoning stalls on structured JSON breakdowns
    if (isThinkingModel) {
      if (level !== 'none') {
        generationConfig.thinkingConfig = {
          thinkingLevel: targetModel === 'gemini-3.1-pro-preview' && level === 'minimal' ? 'low' : level,
        };
      }
    } else {
      generationConfig.temperature = temperature;
      generationConfig.topP = topP;
    }

    if (typeof maxTokens === 'number' && maxTokens > 0) {
      generationConfig.maxOutputTokens = maxTokens;
    }

    return {
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
        },
      ],
      generationConfig,
    };
  };

  try {
    const requestedLevel = thinkingLevel || defaultThinking;
    let resp = await fetchWithExponentialBackoff(
      () =>
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildGeminiPayload(requestedLevel)),
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

    if (!resp.ok && resp.status === 400 && isThinkingModel) {
      const firstErrText = await resp.text().catch(() => '');
      if (/\bthink/i.test(firstErrText)) {
        const nextLevel = requestedLevel === 'minimal' ? 'low' : 'none';
        resp = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildGeminiPayload(nextLevel)),
          signal: userSignal,
        });
        if (!resp.ok && resp.status === 400 && nextLevel === 'low') {
          resp = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildGeminiPayload('none')),
            signal: userSignal,
          });
        }
      } else {
        throw new Error(`API error (${resp.status}): ${firstErrText}`);
      }
    }

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`API error (${resp.status}): ${errText}`);
    }

    const resJson = await resp.json();
    extractAndRecordGeminiUsage(resJson, targetModel);
    const contentCandidate = extractGeminiResponseText(resJson);
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

export async function executeGeminiSchemaCall<T = any>(params: {
  apiKey: string;
  prompt: string;
  modelQuality?: 'standard' | 'high';
  responseSchema?: Record<string, any>;
  responseMimeType?: string;
  temperature?: number;
  thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high';
  errorContext?: string;
  userSignal?: AbortSignal;
  onRetryMessage?: (attempt: number, maxAttempts: number, delayMs: number) => void;
}): Promise<T | string> {
  const {
    apiKey,
    prompt,
    modelQuality = 'standard',
    responseSchema,
    responseMimeType = 'application/json',
    temperature = 0.2,
    thinkingLevel = 'minimal',
    errorContext = 'Gemini request',
    userSignal,
    onRetryMessage,
  } = params;

  const modelName = modelQuality === 'high' ? 'gemini-3.1-pro-preview' : 'gemini-4-hydrogen';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const isThinkingModel = modelName === 'gemini-4-hydrogen' || modelName === 'gemini-3.1-pro-preview';
  const requestedLevel = modelName === 'gemini-3.1-pro-preview' && thinkingLevel === 'minimal' ? 'low' : thinkingLevel;

  const buildPayload = (level: 'minimal' | 'low' | 'medium' | 'high' | 'none'): Record<string, any> => {
    const generationConfig: Record<string, any> = {};
    if (responseMimeType) generationConfig.responseMimeType = responseMimeType;
    if (responseSchema) generationConfig.responseSchema = responseSchema;

    if (isThinkingModel) {
      if (level !== 'none') {
        generationConfig.thinkingConfig = {
          thinkingLevel: modelName === 'gemini-3.1-pro-preview' && level === 'minimal' ? 'low' : level,
        };
      }
    } else {
      generationConfig.temperature = temperature;
    }

    return {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig,
    };
  };

  let response = await fetchWithExponentialBackoff(
    () =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(requestedLevel)),
        signal: userSignal,
      }),
    {
      initialDelayMs: 2000,
      maxAttempts: 4,
      onRetry: (attempt, maxAttempts, delayMs) => {
        if (onRetryMessage) onRetryMessage(attempt, maxAttempts, delayMs);
      },
    }
  );

  if (!response.ok && response.status === 400 && isThinkingModel) {
    const firstErrText = await response.text().catch(() => '');
    if (/\bthink/i.test(firstErrText)) {
      const nextLevel = requestedLevel === 'minimal' ? 'low' : 'none';
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(nextLevel)),
        signal: userSignal,
      });
      if (!response.ok && response.status === 400 && nextLevel === 'low') {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload('none')),
          signal: userSignal,
        });
      }
    } else {
      throw new Error(sanitizeGenericErrorMessage(`${errorContext} (${response.status}): ${firstErrText}`, apiKey, 'gemini'));
    }
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(sanitizeGenericErrorMessage(`${errorContext} (${response.status}): ${errText}`, apiKey, 'gemini'));
  }

  const json = await response.json();
  extractAndRecordGeminiUsage(json, modelName);
  const rawText = extractGeminiResponseText(json);
  if (!rawText) {
    throw new Error(`Empty response from ${errorContext}`);
  }

  if (responseMimeType === 'application/json') {
    return robustJsonParse<T>(rawText);
  }
  return rawText;
}

export interface PartialStoryboardStreamState {
  styleProfile?: Record<string, any>;
  characterSheet?: Record<string, string>;
  locationSheet?: Record<string, string>;
  hookAnalysis?: Record<string, any>;
  thumbnail?: Record<string, any>;
  scenes: Array<Record<string, any>>;
}

/**
 * Incrementally parses top-level metadata objects and completed elements inside `"scenes": [...]`
 * from a partially streamed JSON buffer so finished scenes can render before the full response ends.
 */
export function extractCompletedStoryboardFields(buffer: string): PartialStoryboardStreamState {
  const empty: PartialStoryboardStreamState = { scenes: [] };
  if (!buffer || typeof buffer !== 'string') return empty;

  const rootStart = buffer.indexOf('{');
  if (rootStart === -1) return empty;

  const len = buffer.length;
  let i = rootStart + 1;

  const skipWsAndCommas = () => {
    while (i < len && /[\s,]/.test(buffer[i])) i++;
  };

  const readJsonString = (): { value: string; end: number } | null => {
    if (buffer[i] !== '"') return null;
    const start = i;
    i++;
    let escaped = false;
    while (i < len) {
      const ch = buffer[i];
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        const raw = buffer.slice(start, i + 1);
        i++;
        try {
          return { value: JSON.parse(raw), end: i };
        } catch {
          return null;
        }
      }
      i++;
    }
    return null;
  };

  const skipComposite = (openChar: '{' | '[', closeChar: '}' | ']'): string | null => {
    if (buffer[i] !== openChar) return null;
    const start = i;
    let depth = 0;
    let inString = false;
    let escaped = false;
    while (i < len) {
      const ch = buffer[i];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === '\\') {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
      } else {
        if (ch === '"') {
          inString = true;
        } else if (ch === openChar) {
          depth++;
        } else if (ch === closeChar) {
          depth--;
          if (depth === 0) {
            i++;
            return buffer.slice(start, i);
          }
        }
      }
      i++;
    }
    return null;
  };

  const skipScalarOrNull = (): boolean => {
    while (i < len && !/[,}\]]/.test(buffer[i])) {
      i++;
    }
    return i < len;
  };

  const result: PartialStoryboardStreamState = { scenes: [] };

  while (i < len) {
    skipWsAndCommas();
    if (i >= len || buffer[i] === '}') break;
    if (buffer[i] !== '"') break;

    const keyRes = readJsonString();
    if (!keyRes) break;
    const key = keyRes.value;

    skipWsAndCommas();
    if (i >= len || buffer[i] !== ':') break;
    i++;
    skipWsAndCommas();
    if (i >= len) break;

    const ch = buffer[i];

    if (key === 'scenes' && ch === '[') {
      i++; // enter array
      while (i < len) {
        skipWsAndCommas();
        if (i >= len || buffer[i] === ']') {
          i++;
          break;
        }
        if (buffer[i] === '{') {
          const sceneSlice = skipComposite('{', '}');
          if (!sceneSlice) {
            // Scene still streaming
            return result;
          }
          try {
            const parsedScene = JSON.parse(sceneSlice);
            if (parsedScene && typeof parsedScene === 'object') {
              result.scenes.push(parsedScene);
            }
          } catch {
            return result;
          }
        } else {
          break;
        }
      }
      continue;
    }

    if (ch === '{') {
      const objSlice = skipComposite('{', '}');
      if (!objSlice) break;
      try {
        const parsedObj = JSON.parse(objSlice);
        if (key === 'styleProfile') result.styleProfile = parsedObj;
        else if (key === 'characterSheet') result.characterSheet = parsedObj;
        else if (key === 'locationSheet') result.locationSheet = parsedObj;
        else if (key === 'hookAnalysis') result.hookAnalysis = parsedObj;
        else if (key === 'thumbnail') result.thumbnail = parsedObj;
      } catch {
        // Ignore partial object
      }
    } else if (ch === '[') {
      const arrSlice = skipComposite('[', ']');
      if (!arrSlice) break;
    } else if (ch === '"') {
      const strRes = readJsonString();
      if (!strRes) break;
    } else {
      if (!skipScalarOrNull()) break;
    }
  }

  return result;
}

export interface StreamJsonStoryboardParams extends UnifiedJsonRequest {
  onPartialStoryboard?: (partial: PartialStoryboardStreamState) => void;
}

/**
 * Streams storyboard JSON incrementally via Gemini SSE (`:streamGenerateContent?alt=sse`) or
 * Groq SSE, invoking `onPartialStoryboard` whenever new completed scenes arrive.
 * Automatically falls back to `executeJsonLlmCall` if streaming is unavailable.
 */
export async function streamJsonLlmWithSceneProgress<T = any>(
  params: StreamJsonStoryboardParams
): Promise<T> {
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
    thinkingLevel,
    onPartialStoryboard,
  } = params;

  if (!onPartialStoryboard) {
    return executeJsonLlmCall<T>(params);
  }

  if (userSignal?.aborted) {
    throw new DOMException('Generation request was cancelled by user.', 'AbortError');
  }

  const trimmedKey = (apiKey || '').trim();
  if (!trimmedKey) {
    throw new Error(
      provider === 'groq'
        ? 'Groq API key is required. Please apply your key under Model & API Options (console.groq.com/keys).'
        : 'Gemini API key is required. Please apply your key under Model & API Options.'
    );
  }

  let accumulatedText = '';
  let lastEmittedSceneCount = 0;
  let lastUsageChunk: any = null;

  const emitProgressIfReady = () => {
    const partial = extractCompletedStoryboardFields(accumulatedText);
    if (partial.scenes.length > lastEmittedSceneCount) {
      lastEmittedSceneCount = partial.scenes.length;
      onPartialStoryboard(partial);
    }
  };

  // Provider: GROQ CLOUD STREAMING
  if (provider === 'groq') {
    const targetModel = groqModel || (modelQuality === 'high' ? 'openai/gpt-oss-120b' : 'qwen/qwen3.8-27b');
    try {
      const payload = {
        model: targetModel,
        messages: [
          { role: 'system', content: sanitizePromptText(systemPrompt) },
          { role: 'user', content: sanitizePromptText(userPrompt) },
        ],
        temperature,
        max_tokens: maxTokens || 8192,
        response_format: { type: 'json_object' },
        stream: true,
        stream_options: { include_usage: true },
      };

      const resp = await fetchWithExponentialBackoff(
        () =>
          fetch(GROQ_API_BASE_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${trimmedKey}`,
            },
            body: JSON.stringify(payload),
            signal: userSignal,
          }),
        {
          initialDelayMs: 2000,
          maxAttempts: 4,
          onRetry: (attempt, maxAttempts, delayMs) => {
            if (onStatusMessage) {
              onStatusMessage(`Groq busy. Retrying in ${Math.ceil(delayMs / 1000)}s (Attempt ${attempt}/${maxAttempts})...`);
            }
          },
        }
      );

      if (!resp.ok || !resp.body || typeof resp.body.getReader !== 'function') {
        return executeJsonLlmCall<T>(params);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() || '';
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line.startsWith('data:')) continue;
          const dataStr = line.slice(5).trim();
          if (!dataStr || dataStr === '[DONE]') continue;
          try {
            const chunk = JSON.parse(dataStr);
            if (chunk?.usage || chunk?.x_groq?.usage) {
              lastUsageChunk = chunk;
            }
            const delta = chunk?.choices?.[0]?.delta?.content;
            if (typeof delta === 'string') {
              accumulatedText += delta;
              emitProgressIfReady();
            }
          } catch {
            // Ignore partial SSE frames
          }
        }
      }

      if (lastUsageChunk) {
        extractAndRecordGroqUsage(lastUsageChunk, targetModel);
      }
      if (!accumulatedText.trim()) {
        return executeJsonLlmCall<T>(params);
      }
      return robustJsonParse<T>(accumulatedText);
    } catch (err: any) {
      if (userSignal?.aborted || err?.name === 'AbortError') {
        throw new DOMException('Generation request was cancelled by user.', 'AbortError');
      }
      return executeJsonLlmCall<T>(params);
    }
  }

  // Provider: GEMINI SSE STREAMING
  const targetModel = modelQuality === 'high' ? 'gemini-3.1-pro-preview' : 'gemini-4-hydrogen';
  const streamEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:streamGenerateContent?alt=sse&key=${trimmedKey}`;

  const isThinkingModel = targetModel === 'gemini-4-hydrogen' || targetModel === 'gemini-3.1-pro-preview';
  const requestedLevel =
    targetModel === 'gemini-3.1-pro-preview' && (thinkingLevel === 'minimal' || !thinkingLevel)
      ? 'low'
      : thinkingLevel || 'minimal';

  const buildPayload = (level: 'minimal' | 'low' | 'medium' | 'high' | 'none'): Record<string, any> => {
    const generationConfig: Record<string, any> = {
      responseMimeType: 'application/json',
    };
    if (isThinkingModel) {
      if (level !== 'none') {
        generationConfig.thinkingConfig = {
          thinkingLevel: targetModel === 'gemini-3.1-pro-preview' && level === 'minimal' ? 'low' : level,
        };
      }
    } else {
      generationConfig.temperature = temperature;
      generationConfig.topP = topP;
    }
    if (typeof maxTokens === 'number' && maxTokens > 0) {
      generationConfig.maxOutputTokens = maxTokens;
    }
    return {
      contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
      generationConfig,
    };
  };

  try {
    let resp = await fetchWithExponentialBackoff(
      () =>
        fetch(streamEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload(requestedLevel)),
          signal: userSignal,
        }),
      {
        onRetry: (attempt, maxAttempts, delayMs) => {
          if (onStatusMessage) {
            onStatusMessage(`Server busy (503/429). Retrying in ${Math.ceil(delayMs / 1000)}s (Attempt ${attempt} of ${maxAttempts})...`);
          }
        },
      }
    );

    if (!resp.ok && resp.status === 400 && isThinkingModel) {
      const errText = await resp.text().catch(() => '');
      if (/\bthink/i.test(errText)) {
        const nextLevel = requestedLevel === 'minimal' ? 'low' : 'none';
        resp = await fetch(streamEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload(nextLevel)),
          signal: userSignal,
        });
        if (!resp.ok && resp.status === 400 && nextLevel === 'low') {
          resp = await fetch(streamEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildPayload('none')),
            signal: userSignal,
          });
        }
      }
    }

    if (!resp.ok || !resp.body || typeof resp.body.getReader !== 'function') {
      return executeJsonLlmCall<T>(params);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      sseBuffer += decoder.decode(value, { stream: true });
      const lines = sseBuffer.split('\n');
      sseBuffer = lines.pop() || '';
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;
        const dataStr = line.slice(5).trim();
        if (!dataStr || dataStr === '[DONE]') continue;
        try {
          const chunk = JSON.parse(dataStr);
          if (chunk?.usageMetadata) {
            lastUsageChunk = chunk;
          }
          const parts = chunk?.candidates?.[0]?.content?.parts;
          if (Array.isArray(parts)) {
            for (const p of parts) {
              if (p && !p.thought && typeof p.text === 'string') {
                accumulatedText += p.text;
              }
            }
            emitProgressIfReady();
          }
        } catch {
          // Ignore partial SSE lines
        }
      }
    }

    if (lastUsageChunk) {
      extractAndRecordGeminiUsage(lastUsageChunk, targetModel);
    }

    if (!accumulatedText.trim()) {
      return executeJsonLlmCall<T>(params);
    }

    return robustJsonParse<T>(accumulatedText);
  } catch (err: any) {
    if (userSignal?.aborted || err?.name === 'AbortError') {
      throw new DOMException('Generation request was cancelled by user.', 'AbortError');
    }
    throw new Error(sanitizeGenericErrorMessage(err?.message || 'Failed to generate content with Gemini.', trimmedKey, 'gemini'));
  }
}
