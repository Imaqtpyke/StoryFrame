import { useState } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import BackgroundEffect from './components/BackgroundEffect';
import GeneratorForm from './components/GeneratorForm';
import ResultsView from './components/ResultsView';
import LegalView from './components/LegalViews';
import ScrollToTopButton from './components/ScrollToTopButton';
import { ApiKeyProvider, useApiKey } from './context/ApiKeyContext';
import { generateStoryDirectly } from './services/geminiClient';
import { ActivePage, GenerateStoryRequest, StoryGenerationResult } from './types';

function StoryFrameMain() {
  const { apiKey } = useApiKey();
  const [activePage, setActivePage] = useState<ActivePage>('generator');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<StoryGenerationResult | null>(null);
  const [lastRequest, setLastRequest] = useState<GenerateStoryRequest | null>(null);

  const handleGenerateStory = async (data: GenerateStoryRequest) => {
    setIsLoading(true);
    setErrorMessage(null);
    setLastRequest(data);

    try {
      if (!apiKey || !apiKey.trim()) {
        throw new Error('Gemini API key is required. Please apply your key under Model Options before generating a breakdown.');
      }

      // Direct client-side generation using BYOK
      const responseData = await generateStoryDirectly(data, apiKey.trim());
      setResult(responseData);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      const errorMsg = err?.message || 'An unexpected failure occurred while connecting to Google Gemini.';
      // Ensure API keys are never exposed in error states
      const safeErrorMsg = apiKey && apiKey.length > 6 ? errorMsg.replaceAll(apiKey, '[REDACTED]') : errorMsg;
      setErrorMessage(safeErrorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToEdit = () => {
    setResult(null);
    setErrorMessage(null);
  };

  const handleReset = () => {
    setResult(null);
    setLastRequest(null);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0C0C0B] text-[#F5F5F0] selection:bg-white selection:text-black relative font-narrative">
      {/* Subtle monochrome motion background layer */}
      <BackgroundEffect />

      <Header activePage={activePage} onNavigate={setActivePage} />

      <main className="flex-1 w-full max-w-5xl mx-auto px-3 xs:px-4 sm:px-6 pt-6 sm:pt-14 pb-12 sm:pb-16 relative z-10">
        {activePage === 'generator' ? (
          result && lastRequest ? (
            <ResultsView
              result={result}
              format={lastRequest.format}
              platform={lastRequest.platform}
              onBackToEdit={handleBackToEdit}
              onReset={handleReset}
            />
          ) : (
            <GeneratorForm
              onSubmit={handleGenerateStory}
              isLoading={isLoading}
              errorMessage={errorMessage}
            />
          )
        ) : (
          <LegalView
            page={activePage}
            onBack={() => setActivePage('generator')}
            onNavigate={setActivePage}
          />
        )}
      </main>

      <Footer onNavigate={setActivePage} />

      {/* Up button when scrolled down */}
      <ScrollToTopButton />
    </div>
  );
}

export default function App() {
  return (
    <ApiKeyProvider>
      <StoryFrameMain />
    </ApiKeyProvider>
  );
}
