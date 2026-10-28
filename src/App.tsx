import { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import BackgroundEffect from './components/BackgroundEffect';
import GeneratorForm from './components/GeneratorForm';
import ResultsView from './components/ResultsView';
import ResultsSkeleton from './components/ResultsSkeleton';
import ResultsErrorView from './components/ResultsErrorView';
import Forbidden403View from './components/Forbidden403View';
import LegalView from './components/LegalViews';
import ScrollToTopButton from './components/ScrollToTopButton';
import HistoryModal from './components/HistoryModal';
import HelpGuideModal from './components/HelpGuideModal';
import AssistantChatDrawer from './components/AssistantChatDrawer';
import { ApiKeyProvider, useApiKey } from './context/ApiKeyContext';
import { generateStoryDirectly } from './services/geminiClient';
import { getHistoryItems, addHistoryItem, deleteHistoryItem, clearAllHistory, updateHistoryResult } from './services/historyStorage';
import { ActivePage, GenerateStoryRequest, HistoryItem, StoryGenerationResult } from './types';

function isForbiddenError(msg: string | null): boolean {
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return (
    lower.includes('403') ||
    lower.includes('permission denied') ||
    lower.includes('caller does not have permission') ||
    lower.includes('generative language api') ||
    lower.includes('forbidden')
  );
}

function StoryFrameMain() {
  const { apiKey, aiProvider } = useApiKey();
  const [activePage, setActivePage] = useState<ActivePage>('generator');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<StoryGenerationResult | null>(null);
  const [lastRequest, setLastRequest] = useState<GenerateStoryRequest | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [openModelOptionsTrigger, setOpenModelOptionsTrigger] = useState(0);
  const [generationStatusMessage, setGenerationStatusMessage] = useState<string | null>(null);
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  // Load history on initial mount
  useEffect(() => {
    setHistoryItems(getHistoryItems());
  }, []);

  const handleGenerateStory = async (data: GenerateStoryRequest) => {
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    activeAbortControllerRef.current = controller;

    setIsLoading(true);
    setErrorMessage(null);
    setGenerationStatusMessage(null);
    setLastRequest(data);
    setResult(null);
    window.scrollTo({ top: 0, behavior: 'instant' });

    const selectedProvider = data.aiProvider || aiProvider || 'gemini';

    try {
      if (!apiKey || !apiKey.trim()) {
        throw new Error(
          selectedProvider === 'groq'
            ? 'Groq API key is required. Please apply your key under Model & API Options (console.groq.com/keys) before generating a breakdown.'
            : 'Gemini API key is required. Please apply your key under Model & API Options before generating a breakdown.'
        );
      }

      // Direct client-side generation using BYOK with user signal support and retry status callback
      const responseData = await generateStoryDirectly(
        data,
        apiKey.trim(),
        controller.signal,
        (msg) => setGenerationStatusMessage(msg)
      );
      setResult(responseData);

      // Save to local history
      const updatedHistory = addHistoryItem(data, responseData);
      setHistoryItems(updatedHistory);

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.message?.includes('cancelled')) {
        setIsLoading(false);
        return;
      }
      const errorMsg =
        err?.message ||
        (selectedProvider === 'groq'
          ? 'An unexpected failure occurred while connecting to Groq Cloud API.'
          : 'An unexpected failure occurred while connecting to Google Gemini.');
      // Ensure API keys are never exposed in error states
      const safeErrorMsg = apiKey && apiKey.length > 6 ? errorMsg.replaceAll(apiKey, '[REDACTED]') : errorMsg;
      setErrorMessage(safeErrorMsg);
    } finally {
      setIsLoading(false);
      activeAbortControllerRef.current = null;
    }
  };

  const handleCancelRequest = () => {
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
      activeAbortControllerRef.current = null;
    }
    setIsLoading(false);
    setErrorMessage(null);
  };

  const handleSelectFromHistory = (item: HistoryItem) => {
    setLastRequest(item.request);
    setResult(item.result);
    setErrorMessage(null);
    setActivePage('generator');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteHistoryItem = (id: string) => {
    const updated = deleteHistoryItem(id);
    setHistoryItems(updated);
  };

  const handleClearAllHistory = () => {
    const updated = clearAllHistory();
    setHistoryItems(updated);
  };

  const handleBackToEdit = () => {
    setIsLoading(false);
    setResult(null);
    setErrorMessage(null);
    setActivePage('generator');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReset = () => {
    setIsLoading(false);
    setResult(null);
    setLastRequest(null);
    setErrorMessage(null);
    setActivePage('generator');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDirectResult = (resultData: StoryGenerationResult, requestData: GenerateStoryRequest) => {
    setIsLoading(false);
    setErrorMessage(null);
    setLastRequest(requestData);
    setResult(resultData);
    const updatedHistory = addHistoryItem(requestData, resultData);
    setHistoryItems(updatedHistory);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartEpisodeDraft = (draftPayload: {
    story: string;
    characterStyle: string;
    format: 'short' | 'long';
    generationMode: 'video' | 'image';
    targetVideoDuration: number;
    platform: string;
    characterSheet?: Record<string, string>;
  }) => {
    setIsLoading(false);
    setResult(null);
    setErrorMessage(null);
    setLastRequest({
      story: draftPayload.story,
      characterStyle: draftPayload.characterStyle,
      format: draftPayload.format,
      platform: draftPayload.platform,
      durationMode: 'preset',
      durationSeconds: 48,
      generationMode: draftPayload.generationMode,
      targetVideoDuration: draftPayload.targetVideoDuration,
      beatMode: 'automatic',
      autoArchitectMode: false,
    });
    setActivePage('generator');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Live prompt revision handlers for assistant and storyboard
  const handleUpdateBeatPrompt = (sceneIndex: number, beatIndex: number, newPrompt: string) => {
    if (!result) return;
    const updatedScenes = result.scenes.map((scene) => {
      if (scene.index === sceneIndex) {
        const updatedBeats = scene.beats.map((beat) => {
          if (beat.beatIndex === beatIndex) {
            return { ...beat, imagePrompt: newPrompt };
          }
          return beat;
        });
        return { ...scene, beats: updatedBeats };
      }
      return scene;
    });
    const updatedResult: StoryGenerationResult = {
      ...result,
      scenes: updatedScenes,
    };
    setResult(updatedResult);
    const updatedHistory = updateHistoryResult(updatedResult, result.title);
    setHistoryItems(updatedHistory);
  };

  const handleUpdateThumbnailPrompt = (newPrompt: string) => {
    if (!result || !result.thumbnail) return;
    const updatedResult: StoryGenerationResult = {
      ...result,
      thumbnail: {
        ...result.thumbnail,
        compiledPrompt: newPrompt,
      },
    };
    setResult(updatedResult);
    const updatedHistory = updateHistoryResult(updatedResult, result.title);
    setHistoryItems(updatedHistory);
  };

  const handleUpdateCtaPrompt = (newPrompt: string) => {
    if (!result || !result.ctaPrompt) return;
    const updatedResult: StoryGenerationResult = {
      ...result,
      ctaPrompt: {
        ...result.ctaPrompt,
        compiledPrompt: newPrompt,
      },
    };
    setResult(updatedResult);
    const updatedHistory = updateHistoryResult(updatedResult, result.title);
    setHistoryItems(updatedHistory);
  };

  const isForbidden = activePage === 'error-403' || (activePage === 'generator' && errorMessage && isForbiddenError(errorMessage));

  return (
    <div className="min-h-screen flex flex-col bg-[#0C0C0B] text-[#F5F5F0] selection:bg-white selection:text-black relative font-narrative">
      {/* Subtle monochrome motion background layer */}
      <BackgroundEffect />

      <Header 
        activePage={activePage} 
        onNavigate={setActivePage} 
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenAssistant={() => setIsAssistantOpen(true)}
        historyCount={historyItems.length}
      />

      <main className="flex-1 w-full max-w-5xl mx-auto px-3 xs:px-4 sm:px-6 pt-6 sm:pt-14 pb-12 sm:pb-16 relative z-10">
        {isForbidden ? (
          <Forbidden403View
            errorMessage={errorMessage || undefined}
            onBackToEdit={handleBackToEdit}
            onOpenModelOptions={() => {
              handleBackToEdit();
              setOpenModelOptionsTrigger((prev) => prev + 1);
            }}
          />
        ) : activePage === 'generator' ? (
          isLoading ? (
            <ResultsSkeleton
              request={lastRequest}
              onBackToEdit={handleBackToEdit}
              onCancelRequest={handleCancelRequest}
              statusMessage={generationStatusMessage}
            />
          ) : errorMessage && lastRequest ? (
            <ResultsErrorView
              errorMessage={errorMessage}
              onBackToEdit={handleBackToEdit}
              onRetry={() => {
                if (lastRequest) handleGenerateStory(lastRequest);
              }}
              onOpenModelOptions={() => {
                handleBackToEdit();
                setOpenModelOptionsTrigger((prev) => prev + 1);
              }}
            />
          ) : result && lastRequest ? (
            <ResultsView
              result={result}
              format={lastRequest.format}
              platform={lastRequest.platform}
              onBackToEdit={handleBackToEdit}
              onReset={handleReset}
              onStartEpisodeDraft={handleStartEpisodeDraft}
            />
          ) : (
            <GeneratorForm
              onSubmit={handleGenerateStory}
              isLoading={isLoading}
              errorMessage={errorMessage}
              onNavigate={setActivePage}
              initialValues={lastRequest}
              openModelOptionsTrigger={openModelOptionsTrigger}
              onDirectResult={handleDirectResult}
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

      <Footer
        onNavigate={setActivePage}
        onOpenHelp={() => setIsHelpOpen(true)}
      />

      {/* Story History Modal (Web) / Drawer (Mobile) */}
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        items={historyItems}
        onSelectStory={handleSelectFromHistory}
        onDeleteItem={handleDeleteHistoryItem}
        onClearAll={handleClearAllHistory}
      />

      {/* User Guide & Free AI Directory Modal */}
      <HelpGuideModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />

      {/* Dedicated Project Assistant Drawer */}
      <AssistantChatDrawer
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        currentResult={result}
        format={lastRequest?.format}
        onUpdateBeatPrompt={handleUpdateBeatPrompt}
        onUpdateThumbnailPrompt={handleUpdateThumbnailPrompt}
        onUpdateCtaPrompt={handleUpdateCtaPrompt}
        onApplyStoryIdea={(idea) => {
          setIsAssistantOpen(false);
          setActivePage('generator');
          setResult(null);
          setLastRequest((prev) => ({
            story: idea,
            characterStyle: prev?.characterStyle || '',
            format: prev?.format || 'short',
            platform: prev?.platform || 'TikTok',
            durationMode: prev?.durationMode || 'automatic',
            generationMode: prev?.generationMode || 'image',
          }));
          setTimeout(() => {
            const inputEl = document.getElementById('story-input-box');
            if (inputEl) {
              inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              (inputEl as HTMLTextAreaElement).focus();
            }
          }, 150);
        }}
        onOpenModelOptions={() => {
          setActivePage('generator');
          setResult(null);
          setOpenModelOptionsTrigger((prev) => prev + 1);
        }}
      />

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
