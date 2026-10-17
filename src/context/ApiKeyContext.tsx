import React, { createContext, useContext, useState, useEffect } from 'react';
import { AiProvider } from '../types';

const GEMINI_STORAGE_KEY = 'byok_gemini_key';
const GROQ_STORAGE_KEY = 'byok_groq_key';
const PROVIDER_STORAGE_KEY = 'storyframe_ai_provider';
const MODEL_QUALITY_STORAGE_KEY = 'storyframe_model_quality_tier';
const GROQ_MODEL_STORAGE_KEY = 'storyframe_groq_model_tier';

interface ApiKeyContextType {
  // Provider
  aiProvider: AiProvider;
  setAiProvider: (provider: AiProvider) => void;

  // Active Key (reflects current active provider)
  apiKey: string;
  hasCustomKey: boolean;
  rememberInSession: boolean;

  // Provider-specific keys
  geminiApiKey: string;
  groqApiKey: string;

  // Model selection
  modelQuality: 'standard' | 'high'; // Gemini: standard (3.8 Flash), high (3.1 Pro)
  groqModel: string; // Groq: openai/gpt-oss-120b (Recommended), qwen/qwen3.8-27b, openai/gpt-oss-20b
  setModelQuality: (quality: 'standard' | 'high') => void;
  setGroqModel: (model: string) => void;

  // Key operations
  setCustomApiKey: (key: string, remember: boolean, targetProvider?: AiProvider) => void;
  clearCustomApiKey: (targetProvider?: AiProvider) => void;
}

const ApiKeyContext = createContext<ApiKeyContextType>({
  aiProvider: 'gemini',
  setAiProvider: () => {},
  apiKey: '',
  hasCustomKey: false,
  rememberInSession: false,
  geminiApiKey: '',
  groqApiKey: '',
  modelQuality: 'standard',
  groqModel: 'openai/gpt-oss-120b',
  setCustomApiKey: () => {},
  clearCustomApiKey: () => {},
  setModelQuality: () => {},
  setGroqModel: () => {},
});

export const ApiKeyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const envGeminiKey =
    typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY
      ? String((import.meta as any).env.VITE_GEMINI_API_KEY).trim()
      : '';

  const envGroqKey =
    typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GROQ_API_KEY
      ? String((import.meta as any).env.VITE_GROQ_API_KEY).trim()
      : '';

  const [aiProvider, setAiProviderState] = useState<AiProvider>('gemini');
  const [geminiApiKey, setGeminiApiKey] = useState<string>(envGeminiKey);
  const [groqApiKey, setGroqApiKey] = useState<string>(envGroqKey);
  const [rememberInSession, setRememberInSession] = useState<boolean>(true);
  const [modelQuality, setModelQualityState] = useState<'standard' | 'high'>('standard');
  const [groqModel, setGroqModelState] = useState<string>('openai/gpt-oss-120b');

  useEffect(() => {
    try {
      // 1. Restore Provider
      const storedProvider = sessionStorage.getItem(PROVIDER_STORAGE_KEY);
      if (storedProvider === 'groq' || storedProvider === 'gemini') {
        setAiProviderState(storedProvider);
      }

      // 2. Restore Gemini Key
      const storedGemini = sessionStorage.getItem(GEMINI_STORAGE_KEY);
      if (storedGemini && storedGemini.trim()) {
        setGeminiApiKey(storedGemini.trim());
      } else if (envGeminiKey) {
        setGeminiApiKey(envGeminiKey);
      }

      // 3. Restore Groq Key
      const storedGroq = sessionStorage.getItem(GROQ_STORAGE_KEY);
      if (storedGroq && storedGroq.trim()) {
        setGroqApiKey(storedGroq.trim());
      } else if (envGroqKey) {
        setGroqApiKey(envGroqKey);
      }

      // 4. Restore Model Tiers
      const storedQuality = sessionStorage.getItem(MODEL_QUALITY_STORAGE_KEY);
      if (storedQuality === 'high' || storedQuality === 'standard') {
        setModelQualityState(storedQuality);
      }

      const storedGroqModel = sessionStorage.getItem(GROQ_MODEL_STORAGE_KEY);
      if (storedGroqModel && storedGroqModel.trim()) {
        setGroqModelState(storedGroqModel.trim());
      }
    } catch {
      // Ignore sessionStorage access errors
    }
  }, [envGeminiKey, envGroqKey]);

  const setAiProvider = (provider: AiProvider) => {
    setAiProviderState(provider);
    try {
      sessionStorage.setItem(PROVIDER_STORAGE_KEY, provider);
    } catch {
      // Ignore storage errors
    }
  };

  const setModelQuality = (quality: 'standard' | 'high') => {
    setModelQualityState(quality);
    try {
      sessionStorage.setItem(MODEL_QUALITY_STORAGE_KEY, quality);
    } catch {
      // Ignore storage errors
    }
  };

  const setGroqModel = (model: string) => {
    setGroqModelState(model);
    try {
      sessionStorage.setItem(GROQ_MODEL_STORAGE_KEY, model);
    } catch {
      // Ignore storage errors
    }
  };

  const setCustomApiKey = (newKey: string, remember: boolean, targetProvider?: AiProvider) => {
    const trimmed = newKey.trim();
    const target = targetProvider || aiProvider;
    setRememberInSession(remember);

    if (target === 'groq') {
      setGroqApiKey(trimmed);
      try {
        if (remember && trimmed) {
          sessionStorage.setItem(GROQ_STORAGE_KEY, trimmed);
        } else {
          sessionStorage.removeItem(GROQ_STORAGE_KEY);
        }
      } catch {
        // Ignore storage errors
      }
    } else {
      setGeminiApiKey(trimmed);
      try {
        if (remember && trimmed) {
          sessionStorage.setItem(GEMINI_STORAGE_KEY, trimmed);
        } else {
          sessionStorage.removeItem(GEMINI_STORAGE_KEY);
        }
      } catch {
        // Ignore storage errors
      }
    }
  };

  const clearCustomApiKey = (targetProvider?: AiProvider) => {
    const target = targetProvider || aiProvider;
    if (target === 'groq') {
      setGroqApiKey('');
      try {
        sessionStorage.removeItem(GROQ_STORAGE_KEY);
      } catch {
        // Ignore storage errors
      }
    } else {
      setGeminiApiKey('');
      try {
        sessionStorage.removeItem(GEMINI_STORAGE_KEY);
      } catch {
        // Ignore storage errors
      }
    }
  };

  // Active key based on currently selected provider
  const activeKey = aiProvider === 'groq' ? groqApiKey : geminiApiKey;

  return (
    <ApiKeyContext.Provider
      value={{
        aiProvider,
        setAiProvider,
        apiKey: activeKey,
        hasCustomKey: Boolean(activeKey && activeKey.trim().length > 0),
        rememberInSession,
        geminiApiKey,
        groqApiKey,
        modelQuality,
        groqModel,
        setCustomApiKey,
        clearCustomApiKey,
        setModelQuality,
        setGroqModel,
      }}
    >
      {children}
    </ApiKeyContext.Provider>
  );
};

export function useApiKey(): ApiKeyContextType {
  return useContext(ApiKeyContext);
}
