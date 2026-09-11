import React, { createContext, useContext, useState, useEffect } from 'react';

const SESSION_STORAGE_KEY = 'byok_gemini_key';

interface ApiKeyContextType {
  apiKey: string;
  hasCustomKey: boolean;
  rememberInSession: boolean;
  setCustomApiKey: (key: string, remember: boolean) => void;
  clearCustomApiKey: () => void;
}

const ApiKeyContext = createContext<ApiKeyContextType>({
  apiKey: '',
  hasCustomKey: false,
  rememberInSession: false,
  setCustomApiKey: () => {},
  clearCustomApiKey: () => {},
});

export const ApiKeyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const envDefaultKey = typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY
    ? String((import.meta as any).env.VITE_GEMINI_API_KEY).trim()
    : '';

  const [apiKey, setApiKey] = useState<string>(envDefaultKey);
  const [rememberInSession, setRememberInSession] = useState<boolean>(Boolean(envDefaultKey));

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored && stored.trim()) {
        setApiKey(stored.trim());
        setRememberInSession(true);
      } else if (envDefaultKey) {
        setApiKey(envDefaultKey);
        setRememberInSession(true);
      }
    } catch {
      // Ignore sessionStorage access errors
    }
  }, [envDefaultKey]);

  const setCustomApiKey = (newKey: string, remember: boolean) => {
    const trimmed = newKey.trim();
    setApiKey(trimmed);
    setRememberInSession(remember);

    try {
      if (remember && trimmed) {
        sessionStorage.setItem(SESSION_STORAGE_KEY, trimmed);
      } else {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  };

  const clearCustomApiKey = () => {
    setApiKey('');
    setRememberInSession(false);
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  };

  return (
    <ApiKeyContext.Provider
      value={{
        apiKey,
        hasCustomKey: Boolean(apiKey && apiKey.trim().length > 0),
        rememberInSession,
        setCustomApiKey,
        clearCustomApiKey,
      }}
    >
      {children}
    </ApiKeyContext.Provider>
  );
};

export function useApiKey(): ApiKeyContextType {
  return useContext(ApiKeyContext);
}
