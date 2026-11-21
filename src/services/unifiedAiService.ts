import { AiProvider } from '../types';
import { fetchWithExponentialBackoff } from '../utils/retryFetch';
import {
  callGroqChatCompletion,
  extractCleanJson,
  getGroqReasoningOptions,
  GROQ_API_BASE_URL,
  sanitizeGroqErrorMessage,
  sanitizePromptText,
  stripReasoningWrappers,
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
  sceneIndex?: number;
  prompts?: Array<Record<string, any>>;
  scenes: Array<Record<string, any>>;
}

/**
 * Incrementally parses top-level metadata objects and completed elements inside `"scenes": [...]`
 * from a partially streamed JSON buffer so finished scenes can render before the full response ends.
 */
export function extractCompletedStoryboardFields(rawBuffer: string): PartialStoryboardStreamState {
  const empty: PartialStoryboardStreamState = { scenes: [] };
  if (!rawBuffer || typeof rawBuffer !== 'string') return empty;

  const stripped = stripReasoningWrappers(rawBuffer);
  if (!stripped) return empty;
  const buffer = stripped;

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

  const readScalarValue = (buf: string, startPos: number): { value: any; nextPos: number } | null => {
    let pos = startPos;
    const n = buf.length;
    while (pos < n && !/[,}\]]/.test(buf[pos])) pos++;
    if (pos >= n) return null;
    const raw = buf.slice(startPos, pos).trim();
    if (!raw) return { value: undefined, nextPos: pos };
    try {
      return { value: JSON.parse(raw), nextPos: pos };
    } catch {
      return { value: undefined, nextPos: pos };
    }
  };

  /**
   * Scans an unclosed Scene object slice (`{ ...`) and returns a partial scene
   * object ONLY if it already contains at least one completed beat or prompt item.
   */
  const extractPartialOpenScene = (openSlice: string): Record<string, any> | null => {
    const oLen = openSlice.length;
    if (oLen < 2 || openSlice[0] !== '{') return null;
    let j = 1;

    const skipO = () => {
      while (j < oLen && /[\s,]/.test(openSlice[j])) j++;
    };

    const readStrO = (): string | null => {
      if (openSlice[j] !== '"') return null;
      const st = j;
      j++;
      let esc = false;
      while (j < oLen) {
        const c = openSlice[j];
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') {
          const slice = openSlice.slice(st, j + 1);
          j++;
          try {
            return JSON.parse(slice);
          } catch {
            return null;
          }
        }
        j++;
      }
      return null;
    };

    const readCompO = (openC: '{' | '[', closeC: '}' | ']'): string | null => {
      if (openSlice[j] !== openC) return null;
      const st = j;
      let d = 0;
      let inStr = false;
      let esc = false;
      while (j < oLen) {
        const c = openSlice[j];
        if (inStr) {
          if (esc) esc = false;
          else if (c === '\\') esc = true;
          else if (c === '"') inStr = false;
        } else {
          if (c === '"') inStr = true;
          else if (c === openC) d++;
          else if (c === closeC) {
            d--;
            if (d === 0) {
              j++;
              return openSlice.slice(st, j);
            }
          }
        }
        j++;
      }
      return null;
    };

    let sceneIndex: number | undefined;
    let narratorLine: string | undefined;
    let estimatedSeconds: number | undefined;
    const completedBeats: Array<Record<string, any>> = [];
    const completedPrompts: Array<Record<string, any>> = [];

    while (j < oLen) {
      skipO();
      if (j >= oLen || openSlice[j] === '}') break;
      if (openSlice[j] !== '"') break;
      const k = readStrO();
      if (k === null) break;
      skipO();
      if (j >= oLen || openSlice[j] !== ':') break;
      j++;
      skipO();
      if (j >= oLen) break;

      const chO = openSlice[j];
      if ((k === 'beats' || k === 'prompts') && chO === '[') {
        j++; // enter array
        while (j < oLen) {
          skipO();
          if (j >= oLen || openSlice[j] === ']') {
            if (j < oLen) j++;
            break;
          }
          if (openSlice[j] === '{') {
            const itemSlice = readCompO('{', '}');
            if (!itemSlice) {
              break;
            }
            try {
              const parsedItem = JSON.parse(itemSlice);
              if (parsedItem && typeof parsedItem === 'object') {
                if (k === 'beats') completedBeats.push(parsedItem);
                else completedPrompts.push(parsedItem);
              }
            } catch {
              break;
            }
          } else {
            break;
          }
        }
        continue;
      }

      if (chO === '{') {
        const s = readCompO('{', '}');
        if (!s) break;
      } else if (chO === '[') {
        const s = readCompO('[', ']');
        if (!s) break;
      } else if (chO === '"') {
        const val = readStrO();
        if (val === null) break;
        if (k === 'narratorLine') narratorLine = val;
      } else {
        const sc = readScalarValue(openSlice, j);
        if (!sc) break;
        j = sc.nextPos;
        if ((k === 'index' || k === 'sceneIndex') && typeof sc.value === 'number') {
          sceneIndex = sc.value;
        } else if (k === 'estimatedSeconds' && typeof sc.value === 'number') {
          estimatedSeconds = sc.value;
        }
      }
    }

    if (completedBeats.length === 0 && completedPrompts.length === 0) {
      return null;
    }

    const partialScene: Record<string, any> = {};
    if (typeof sceneIndex === 'number') {
      partialScene.index = sceneIndex;
      partialScene.sceneIndex = sceneIndex;
    }
    if (typeof narratorLine === 'string') partialScene.narratorLine = narratorLine;
    if (typeof estimatedSeconds === 'number') partialScene.estimatedSeconds = estimatedSeconds;
    if (completedBeats.length > 0) partialScene.beats = completedBeats;
    if (completedPrompts.length > 0) partialScene.prompts = completedPrompts;
    return partialScene;
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
          if (i < len) i++;
          break;
        }
        if (buffer[i] === '{') {
          const openSceneStart = i;
          const sceneSlice = skipComposite('{', '}');
          if (!sceneSlice) {
            // Scene still streaming: surface any already-completed beats or prompts inside it
            const partialOpen = extractPartialOpenScene(buffer.slice(openSceneStart));
            if (partialOpen) {
              result.scenes.push(partialOpen);
            }
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

    if (key === 'prompts' && ch === '[') {
      i++; // enter top-level Stage 3 prompts array
      const completedPrompts: Array<Record<string, any>> = [];
      while (i < len) {
        skipWsAndCommas();
        if (i >= len || buffer[i] === ']') {
          if (i < len) i++;
          break;
        }
        if (buffer[i] === '{') {
          const promptSlice = skipComposite('{', '}');
          if (!promptSlice) {
            if (completedPrompts.length > 0) result.prompts = completedPrompts;
            return result;
          }
          try {
            const parsedPrompt = JSON.parse(promptSlice);
            if (parsedPrompt && typeof parsedPrompt === 'object') {
              completedPrompts.push(parsedPrompt);
            }
          } catch {
            if (completedPrompts.length > 0) result.prompts = completedPrompts;
            return result;
          }
        } else {
          break;
        }
      }
      if (completedPrompts.length > 0) result.prompts = completedPrompts;
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
      const sc = readScalarValue(buffer, i);
      if (!sc) break;
      i = sc.nextPos;
      if (key === 'sceneIndex' && typeof sc.value === 'number') {
        result.sceneIndex = sc.value;
      }
    }
  }

  return result;
}

export interface StreamJsonStoryboardParams extends UnifiedJsonRequest {
  onPartialStoryboard?: (partial: PartialStoryboardStreamState) => void;
}

/**
 * Streams storyboard JSON incrementally via Gemini SSE (`:streamGenerateContent?alt=sse`) or
 * Groq SSE, invoking `onPartialStoryboard` whenever new completed beats, prompts, or scenes arrive.
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
  let lastEmittedSignature = '';
  let lastUsageChunk: any = null;

  const emitProgressIfReady = (): boolean => {
    const partial = extractCompletedStoryboardFields(accumulatedText);
    const hasData =
      partial.scenes.length > 0 ||
      (Array.isArray(partial.prompts) && partial.prompts.length > 0) ||
      Boolean(partial.styleProfile || partial.characterSheet || partial.hookAnalysis);
    if (!hasData) return false;

    const sceneSig = partial.scenes
      .map((s: any, idx: number) => {
        const beatCount = Array.isArray(s?.beats) ? s.beats.length : 0;
        const promptCount = Array.isArray(s?.prompts) ? s.prompts.length : 0;
        return `${s?.index ?? s?.sceneIndex ?? idx + 1}:${beatCount}:${promptCount}`;
      })
      .join('|');
    const metaSig = [
      partial.styleProfile ? 1 : 0,
      partial.characterSheet ? Object.keys(partial.characterSheet).length : 0,
      partial.locationSheet ? Object.keys(partial.locationSheet).length : 0,
      partial.hookAnalysis ? 1 : 0,
      Array.isArray(partial.prompts) ? partial.prompts.length : 0,
    ].join(':');
    const signature = `${metaSig}::${sceneSig}`;
    if (signature !== lastEmittedSignature) {
      lastEmittedSignature = signature;
      onPartialStoryboard(partial);
      return true;
    }
    return false;
  };

  // Provider: GROQ CLOUD STREAMING (retries with stream: true intact on 400 validation errors)
  if (provider === 'groq') {
    const targetModel = groqModel || (modelQuality === 'high' ? 'openai/gpt-oss-120b' : 'qwen/qwen3.8-27b');
    const baseMessages = [
      { role: 'system', content: sanitizePromptText(systemPrompt) },
      { role: 'user', content: sanitizePromptText(userPrompt) },
    ];

    const runGroqStreamAttempt = async (strictJson: boolean): Promise<Response> => {
      const attemptPayload: Record<string, any> = {
        model: targetModel,
        messages: strictJson
          ? baseMessages
          : [
              ...baseMessages,
              {
                role: 'user',
                content:
                  'CRITICAL INSTRUCTION: Output strictly valid, raw JSON only starting directly with { and no markdown fences or commentary.',
              },
            ],
        temperature,
        max_tokens: maxTokens || 8192,
        stream: true,
        ...(strictJson ? getGroqReasoningOptions(targetModel) : {}),
      };
      if (strictJson) {
        attemptPayload.response_format = { type: 'json_object' };
      }

      return fetchWithExponentialBackoff(
        () =>
          fetch(GROQ_API_BASE_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${trimmedKey}`,
            },
            body: JSON.stringify(attemptPayload),
            signal: userSignal,
          }),
        {
          initialDelayMs: 2000,
          maxAttempts: 4,
          onRetry: (attempt, maxAttempts, delayMs) => {
            if (onStatusMessage) {
              onStatusMessage(
                `Groq busy. Retrying in ${Math.ceil(delayMs / 1000)}s (Attempt ${attempt}/${maxAttempts})...`
              );
            }
          },
        }
      );
    };

    try {
      let resp = await runGroqStreamAttempt(true);

      // If Groq rejects strict json_object or optional reasoning params during streaming,
      // retry WHILE KEEPING stream: true active instead of silently dropping to non-streaming.
      if (!resp.ok && resp.status === 400) {
        if (onStatusMessage) {
          onStatusMessage('Switching Groq stream to resilient live JSON mode...');
        }
        resp = await runGroqStreamAttempt(false);
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
        const lines = sseBuffer.split(/\r?\n/);
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
              if (emitProgressIfReady()) {
                // Yield one turn so React paints each newly completed beat/scene progressively
                // rather than batching fast Groq LPU bursts into one render
                await new Promise((resolve) => setTimeout(resolve, 0));
              }
            }
          } catch {
            // Ignore partial SSE frames
          }
        }
      }

      if (sseBuffer.trim().startsWith('data:')) {
        const trailing = sseBuffer.trim().slice(5).trim();
        if (trailing && trailing !== '[DONE]') {
          try {
            const chunk = JSON.parse(trailing);
            if (chunk?.usage || chunk?.x_groq?.usage) lastUsageChunk = chunk;
            const delta = chunk?.choices?.[0]?.delta?.content;
            if (typeof delta === 'string') {
              accumulatedText += delta;
              emitProgressIfReady();
            }
          } catch {
            // Ignore trailing incomplete chunk
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
      const lines = sseBuffer.split(/\r?\n/);
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
