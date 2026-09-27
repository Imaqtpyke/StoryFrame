import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Send, 
  Trash2, 
  Sparkles, 
  HelpCircle, 
  Check, 
  Copy, 
  Key, 
  MessageSquare,
  ArrowRight
} from 'lucide-react';
import { AssistantChatMessage } from '../types';
import { 
  getStoredChatHistory, 
  saveStoredChatHistory, 
  clearStoredChatHistory, 
  sendChatMessage 
} from '../services/assistantChatService';
import { useApiKey } from '../context/ApiKeyContext';

interface AssistantChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyStoryIdea?: (idea: string) => void;
  onOpenModelOptions?: () => void;
}

const STARTER_PROMPTS = [
  { label: 'Who built this project?', query: 'Who built this project?' },
  { label: 'Zack D. Films story idea', query: 'Give me a captivating, curious story idea inspired by Zack D. Films.' },
  { label: 'Unique character style', query: 'Suggest 3 unique, cinematic character art styles for my story.' },
  { label: 'How does StoryFrame work?', query: 'Explain how StoryFrame converts stories into scenes and visual beats.' },
];

export default function AssistantChatDrawer({
  isOpen,
  onClose,
  onApplyStoryIdea,
  onOpenModelOptions,
}: AssistantChatDrawerProps) {
  const { apiKey } = useApiKey();
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [appliedId, setAppliedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load chat history from session on mount
  useEffect(() => {
    const saved = getStoredChatHistory();
    if (saved && saved.length > 0) {
      setMessages(saved);
    }
  }, []);

  // Save history on changes
  useEffect(() => {
    if (messages.length > 0) {
      saveStoredChatHistory(messages);
    }
  }, [messages]);

  // Scroll to bottom when messages update
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      // Auto-focus input on open
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 200);
    }
  }, [isOpen, messages, isSending]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setErrorMessage(null);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Escape key closes drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSend = async (textToSend?: string) => {
    const messageContent = (textToSend || inputText).trim();
    if (!messageContent || isSending) return;

    if (!apiKey || !apiKey.trim()) {
      setErrorMessage('A Gemini API key is required to talk with the assistant. Please add your key under Model Options in the generator.');
      return;
    }

    setErrorMessage(null);

    const userMessage: AssistantChatMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      role: 'user',
      content: messageContent,
      timestamp: Date.now(),
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInputText('');
    setIsSending(true);

    try {
      const reply = await sendChatMessage(messages, messageContent, apiKey);
      const assistantMessage: AssistantChatMessage = {
        id: `assistant-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        role: 'assistant',
        content: reply,
        timestamp: Date.now(),
      };
      setMessages([...newHistory, assistantMessage]);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not communicate with the assistant. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleClearHistory = () => {
    clearStoredChatHistory();
    setMessages([]);
    setErrorMessage(null);
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleApplyToGenerator = (id: string, text: string) => {
    if (onApplyStoryIdea) {
      onApplyStoryIdea(text);
      setAppliedId(id);
      setTimeout(() => setAppliedId(null), 2500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-xs cursor-pointer"
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="relative w-full sm:w-[440px] md:w-[480px] h-full bg-[#0C0C0B] border-l border-white/10 flex flex-col shadow-2xl z-10 font-narrative"
            role="dialog"
            aria-modal="true"
            aria-labelledby="assistant-drawer-title"
          >
            {/* Header */}
            <div className="px-4 sm:px-6 py-4 border-b border-white/10 bg-[#111110] flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 border border-white/30 flex items-center justify-center rounded-[2px] bg-[#1A1A18] text-white">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 id="assistant-drawer-title" className="text-base sm:text-lg font-display text-white tracking-tight">
                    StoryFrame Assistant
                  </h2>
                </div>
              </div>

              <div className="flex items-center space-x-1">
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    className="p-2 text-[#8C8C86] hover:text-white hover:bg-white/5 rounded-[2px] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Clear Chat History"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 text-[#8C8C86] hover:text-white hover:bg-white/5 rounded-[2px] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                  title="Close Assistant"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* API Key Missing Notice */}
            {!apiKey && (
              <div className="mx-4 mt-3 p-3 bg-[#181816] border border-amber-500/30 rounded-[2px] shrink-0 text-xs">
                <div className="flex items-start space-x-2.5">
                  <Key className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-[#E6E6DF] leading-relaxed">
                      To talk with the assistant, please configure your Gemini API key in the generator's Model Options.
                    </p>
                    {onOpenModelOptions && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenModelOptions();
                        }}
                        className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-mono text-white underline underline-offset-2 hover:text-[#D4D4D0] cursor-pointer"
                      >
                        <span>Configure Model & API Options</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Messages Body */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
              {messages.length === 0 ? (
                <div className="py-6 flex flex-col items-center text-center space-y-4">
                  <div className="w-12 h-12 border border-white/20 rounded-[2px] bg-[#141412] flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-[#A0A09A]" />
                  </div>
                  <div className="space-y-1 max-w-sm">
                    <h3 className="text-base font-display text-white">
                      Welcome to the StoryFrame Assistant
                    </h3>
                    <p className="text-xs text-[#9C9C96] leading-relaxed">
                      Ask any questions about this project, request fresh story concepts inspired by Zack D. Films, or explore unique visual styles.
                    </p>
                  </div>

                  {/* Starter Chips */}
                  <div className="w-full pt-3 text-left space-y-2">
                    <span className="font-editorial-meta text-[10px] text-[#7A7A74] tracking-widest block uppercase">
                      Suggested Inquiries
                    </span>
                    <div className="flex flex-col gap-2">
                      {STARTER_PROMPTS.map((starter) => (
                        <button
                          key={starter.label}
                          type="button"
                          onClick={() => handleSend(starter.query)}
                          disabled={isSending || !apiKey}
                          className="w-full text-left p-2.5 text-xs bg-[#121211] border border-white/10 hover:border-white/30 text-[#D4D4CE] hover:text-white rounded-[2px] transition-colors flex items-center justify-between group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="font-narrative">{starter.label}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-[#6E6E68] group-hover:text-white transition-colors" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-editorial-meta text-[9px] text-[#7A7A74] tracking-widest">
                        {msg.role === 'user' ? 'YOU' : 'STORYFRAME ASSISTANT'}
                      </span>
                    </div>

                    <div
                      className={`max-w-[92%] p-3.5 rounded-[2px] text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words ${
                        msg.role === 'user'
                          ? 'bg-[#1E1E1C] border border-white/20 text-white'
                          : 'bg-[#131312] border border-white/10 text-[#E8E8E2]'
                      }`}
                    >
                      {msg.content}

                      {/* Assistant message action buttons */}
                      {msg.role === 'assistant' && (
                        <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-[#8C8C86]">
                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={() => handleCopyText(msg.id, msg.content)}
                              className="inline-flex items-center gap-1 hover:text-white transition-colors p-1"
                              title="Copy response"
                            >
                              {copiedId === msg.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span className="text-emerald-400">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>

                            {onApplyStoryIdea && (
                              <button
                                type="button"
                                onClick={() => handleApplyToGenerator(msg.id, msg.content)}
                                className="inline-flex items-center gap-1 hover:text-white transition-colors p-1"
                                title="Fill into Generator Form"
                              >
                                {appliedId === msg.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span className="text-emerald-400">Applied</span>
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-3 h-3" />
                                    <span>Use in Generator</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}

              {/* Streaming / Loading Skeleton */}
              {isSending && (
                <div className="flex flex-col items-start space-y-1">
                  <span className="font-editorial-meta text-[9px] text-[#7A7A74] tracking-widest">
                    STORYFRAME ASSISTANT
                  </span>
                  <div className="p-3.5 bg-[#131312] border border-white/10 rounded-[2px] max-w-[85%] space-y-2">
                    <div className="flex items-center space-x-2 text-xs text-[#8C8C86]">
                      <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse" />
                      <span className="font-mono text-[11px]">Thinking with Gemini...</span>
                    </div>
                    <div className="space-y-1.5 w-48 sm:w-64 pt-1">
                      <div className="h-2 bg-white/10 rounded-[1px] animate-pulse" />
                      <div className="h-2 bg-white/10 rounded-[1px] animate-pulse w-4/5" />
                    </div>
                  </div>
                </div>
              )}

              {/* Error message callout */}
              {errorMessage && (
                <div className="p-3 bg-red-950/30 border border-red-500/40 rounded-[2px] text-xs text-red-200">
                  <p className="font-mono">{errorMessage}</p>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Footer Input Composer */}
            <div className="p-3 sm:p-4 border-t border-white/10 bg-[#111110] shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="space-y-2"
              >
                <div className="relative">
                  <textarea
                    ref={textareaRef}
                    rows={2}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isSending || !apiKey}
                    placeholder={
                      !apiKey
                        ? 'Please configure your Gemini API key to chat...'
                        : 'Ask about Zack D. Films ideas, character styles, or who built this...'
                    }
                    className="w-full bg-[#181816] border border-white/15 focus:border-white/50 text-white placeholder-[#6E6E68] text-base sm:text-xs p-2.5 rounded-[2px] focus:outline-none resize-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-narrative"
                  />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-[10px] text-[#6E6E68] hidden sm:inline">
                    Shift + Enter for new line
                  </span>
                  <button
                    type="submit"
                    disabled={!inputText.trim() || isSending || !apiKey}
                    className="min-h-[40px] px-4 py-1.5 bg-white text-black font-semibold text-xs tracking-wider uppercase font-editorial-meta rounded-[2px] border border-white hover:bg-[#EAEAE5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1.5 ml-auto"
                  >
                    <span>Send</span>
                    <Send className="w-3 h-3" />
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
