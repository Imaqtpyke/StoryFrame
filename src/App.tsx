import { useState, useEffect } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import BackgroundEffect from './components/BackgroundEffect';
import GeneratorForm from './components/GeneratorForm';
import ResultsView from './components/ResultsView';
import LegalView from './components/LegalViews';
import ScrollToTopButton from './components/ScrollToTopButton';
import HistoryModal from './components/HistoryModal';
import HelpGuideModal from './components/HelpGuideModal';
import AssistantChatDrawer from './components/AssistantChatDrawer';
import { ApiKeyProvider, useApiKey } from './context/ApiKeyContext';
import { generateStoryDirectly } from './services/geminiClient';
import { getHistoryItems, addHistoryItem, deleteHistoryItem, clearAllHistory } from './services/historyStorage';
import { ActivePage, GenerateStoryRequest, HistoryItem, StoryGenerationResult } from './types';
import { Sparkles } from 'lucide-react';

function StoryFrameMain() {
  const { apiKey } = useApiKey();
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

  // Load history on initial mount
  useEffect(() => {
    setHistoryItems(getHistoryItems());
  }, []);

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

      // Save to local history
      const updatedHistory = addHistoryItem(data, responseData);
      setHistoryItems(updatedHistory);

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

      <Header 
        activePage={activePage} 
        onNavigate={setActivePage} 
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenAssistant={() => setIsAssistantOpen(true)}
        historyCount={historyItems.length}
      />

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
              onNavigate={setActivePage}
              initialValues={lastRequest}
              openModelOptionsTrigger={openModelOptionsTrigger}
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
        onApplyStoryIdea={(idea) => {
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
        }}
        onOpenModelOptions={() => {
          setActivePage('generator');
          setResult(null);
          setOpenModelOptionsTrigger((prev) => prev + 1);
        }}
      />

      {/* Floating Assistant Trigger Button */}
      <button
        type="button"
        id="floating-assistant-btn"
        onClick={() => setIsAssistantOpen(true)}
        className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-30 min-h-[44px] px-3.5 py-2 bg-[#121211]/95 hover:bg-[#1A1A18] text-white border border-white/20 hover:border-white/50 rounded-[2px] shadow-lg backdrop-blur-sm transition-all flex items-center space-x-2 text-xs font-editorial-meta uppercase tracking-wider group cursor-pointer"
        title="Ask StoryFrame Assistant"
      >
        <Sparkles className="w-3.5 h-3.5 text-white group-hover:scale-110 transition-transform" />
        <span className="hidden xs:inline">Assistant</span>
      </button>

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

