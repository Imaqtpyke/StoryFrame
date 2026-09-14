import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HistoryItem } from '../types';
import { 
  X, 
  History, 
  Trash2, 
  Film, 
  Clock, 
  Layers, 
  Sparkles, 
  ExternalLink, 
  AlertTriangle 
} from 'lucide-react';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: HistoryItem[];
  onSelectStory: (item: HistoryItem) => void;
  onDeleteItem: (id: string) => void;
  onClearAll: () => void;
}

export default function HistoryModal({
  isOpen,
  onClose,
  items,
  onSelectStory,
  onDeleteItem,
  onClearAll,
}: HistoryModalProps) {
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);

  // Responsive screen detection
  useEffect(() => {
    const checkScreen = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkScreen();
    window.addEventListener('resize', checkScreen);
    return () => window.removeEventListener('resize', checkScreen);
  }, []);

  // Keyboard escape handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock background scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setShowClearConfirm(false);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const formatDate = (timestamp: number) => {
    try {
      const now = Date.now();
      const diffMinutes = Math.floor((now - timestamp) / 60000);
      if (diffMinutes < 1) return 'Just now';
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      
      const date = new Date(timestamp);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
      });
    } catch {
      return 'Recently';
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop Overlay */}
        <motion.div
          id="history-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          aria-hidden="true"
        />

        {/* Desktop Centered Modal vs Mobile Right Slide-in Drawer */}
        {isMobile ? (
          /* Mobile: Slide-in Drawer from the Right */
          <motion.div
            id="history-drawer-mobile"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed inset-y-0 right-0 w-[90vw] max-w-[360px] h-full bg-[#111110] border-l border-white/15 flex flex-col z-50 shadow-2xl text-[#F5F5F0]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-heading"
          >
            {/* Drawer Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#161614]">
              <div className="flex items-center space-x-2">
                <History className="w-4 h-4 text-white" />
                <h2 id="history-heading" className="text-sm font-medium font-display tracking-tight text-white">
                  Story History
                </h2>
                {items.length > 0 && (
                  <span className="px-1.5 py-0.2 text-[10px] font-mono bg-white/10 text-white rounded-full">
                    {items.length}
                  </span>
                )}
              </div>
              <button
                type="button"
                id="close-history-drawer-mobile"
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#8C8C86] hover:text-white hover:bg-white/10 transition-colors focus:outline-none"
                aria-label="Close history"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Clear confirm banner */}
            {showClearConfirm && (
              <div className="p-3 bg-red-950/40 border-b border-red-500/20 text-xs text-red-200 flex items-center justify-between">
                <span>Clear all {items.length} saved stories?</span>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClearAll();
                      setShowClearConfirm(false);
                    }}
                    className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-[10px] uppercase font-mono rounded"
                  >
                    Yes, Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white text-[10px] uppercase font-mono rounded"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-16 text-center px-4">
                  <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                    <History className="w-6 h-6 text-[#7D7D76]" />
                  </div>
                  <p className="text-sm font-medium text-white font-display">No Saved Breakdowns</p>
                  <p className="text-xs text-[#8C8C86] mt-1 max-w-[220px]">
                    Breakdown a story and your scene prompts will automatically appear here.
                  </p>
                </div>
              ) : (
                items.map((item) => {
                  const totalBeats = item.result.scenes.reduce(
                    (acc, scene) => acc + (scene.beats?.length || 0),
                    0
                  );
                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-[2px] bg-[#181816] border border-white/10 hover:border-white/25 transition-all text-left group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-mono text-[#8C8C86] flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {formatDate(item.timestamp)}
                          </span>
                          <h3 className="text-xs font-medium text-white font-display line-clamp-2 mt-0.5 leading-snug">
                            {item.storyTitle}
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteItem(item.id);
                          }}
                          className="p-1.5 text-[#7D7D76] hover:text-red-400 hover:bg-white/5 rounded-[2px] transition-colors focus:outline-none"
                          title="Delete this history item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap gap-1.5 mt-2 text-[10px] font-mono text-[#A8A8A2]">
                        <span className="stamp-chip text-[9px] bg-[#121211] border-white/10">
                          {item.request.format === 'short' ? '9:16 Short' : '16:9 Long'}
                        </span>
                        <span className="stamp-chip text-[9px] bg-[#121211] border-white/10">
                          {item.request.platform || 'General'}
                        </span>
                        <span className="stamp-chip text-[9px] bg-[#121211] border-white/10">
                          {item.result.scenes.length} Scenes
                        </span>
                        {item.result.totalDurationSeconds > 0 && (
                          <span className="stamp-chip text-[9px] bg-[#121211] border-white/10 text-emerald-400">
                            {item.result.totalDurationSeconds}s
                          </span>
                        )}
                      </div>

                      {/* Character style snippet if available */}
                      {item.request.characterStyle && (
                        <p className="text-[10px] text-[#7D7D76] truncate mt-1.5 italic font-narrative">
                          Style: {item.request.characterStyle}
                        </p>
                      )}

                      {/* Action Button */}
                      <button
                        type="button"
                        onClick={() => {
                          onSelectStory(item);
                          onClose();
                        }}
                        className="w-full mt-2.5 py-1.5 px-2 bg-white text-black hover:bg-[#E5E5E0] text-[11px] font-medium font-editorial-meta tracking-wide rounded-[2px] flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <span>VIEW BREAKDOWN</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Drawer Footer */}
            {items.length > 0 && (
              <div className="p-3 border-t border-white/10 bg-[#161614] flex items-center justify-between text-xs">
                <span className="text-[11px] text-[#8C8C86] font-mono">
                  {items.length} {items.length === 1 ? 'story' : 'stories'} saved
                </span>
                <button
                  type="button"
                  id="clear-all-history-mobile"
                  onClick={() => setShowClearConfirm(true)}
                  className="text-[11px] text-red-400 hover:text-red-300 font-mono flex items-center gap-1 focus:outline-none"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear All
                </button>
              </div>
            )}
          </motion.div>
        ) : (
          /* Web/Desktop: Centered Modal Dialog */
          <motion.div
            id="history-modal-desktop"
            initial={{ scale: 0.98, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.98, opacity: 0, y: 8 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-2xl max-h-[85vh] bg-[#121210] border border-white/15 rounded-[2px] shadow-2xl flex flex-col z-50 overflow-hidden text-[#F5F5F0] mx-4 corner-bracket-container"
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-heading-desktop"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#161614]">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-[2px] bg-white/10 border border-white/10 flex items-center justify-center">
                  <History className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 id="history-heading-desktop" className="text-base font-medium font-display tracking-tight text-white flex items-center gap-2">
                    Story History &amp; Previous Breakdowns
                    {items.length > 0 && (
                      <span className="stamp-chip text-[9px] bg-white text-black font-bold">
                        {items.length}
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-[#8C8C86] font-narrative">
                    Revisit, review, and re-export your previously generated cinematic breakdowns.
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="close-history-modal-desktop"
                onClick={onClose}
                className="w-8 h-8 rounded-[2px] flex items-center justify-center text-[#8C8C86] hover:text-white hover:bg-white/10 transition-colors focus:outline-none"
                aria-label="Close history modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Clear confirm banner */}
            {showClearConfirm && (
              <div className="px-6 py-2.5 bg-red-950/40 border-b border-red-500/20 text-xs text-red-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span>Are you sure you want to delete all {items.length} saved story breakdowns?</span>
                </div>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClearAll();
                      setShowClearConfirm(false);
                    }}
                    className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white text-xs font-mono rounded-[2px] transition-colors"
                  >
                    Confirm Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white text-xs font-mono rounded-[2px] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Modal Body: Scrollable list */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {items.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-center px-4">
                  <div className="w-14 h-14 rounded-[2px] bg-white/5 border border-white/10 flex items-center justify-center mb-3.5">
                    <History className="w-7 h-7 text-[#7D7D76]" />
                  </div>
                  <h3 className="text-base font-medium text-white font-display">No History Records Yet</h3>
                  <p className="text-xs text-[#8C8C86] mt-1.5 max-w-sm font-narrative">
                    Whenever you break down a story into scenes and narrator scripts, it will automatically be archived here for instant recall.
                  </p>
                </div>
              ) : (
                items.map((item) => {
                  const totalBeats = item.result.scenes.reduce(
                    (acc, scene) => acc + (scene.beats?.length || 0),
                    0
                  );
                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-[2px] bg-[#181816] border border-white/10 hover:border-white/25 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:bg-[#1A1A18]"
                    >
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-[#8C8C86] flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#7D7D76]" />
                            {formatDate(item.timestamp)}
                          </span>
                          <span className="text-white/20">•</span>
                          <span className="text-xs font-mono text-white/70">
                            {item.request.format === 'short' ? '9:16 Vertical' : '16:9 Widescreen'}
                          </span>
                          <span className="text-white/20">•</span>
                          <span className="text-xs font-mono text-[#A8A8A2]">
                            {item.request.platform || 'General'}
                          </span>
                        </div>

                        <h3 className="text-sm font-medium text-white font-display line-clamp-2 leading-relaxed">
                          {item.storyTitle}
                        </h3>

                        {/* Metadata Pills */}
                        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#A8A8A2] pt-1">
                          <span className="stamp-chip text-[10px] bg-[#121211] border-white/10 flex items-center gap-1">
                            <Film className="w-3 h-3 text-[#9C9C96]" />
                            {item.result.scenes.length} Scenes ({totalBeats} Beats)
                          </span>
                          {item.result.totalDurationSeconds > 0 && (
                            <span className="stamp-chip text-[10px] bg-[#121211] border-white/10 text-emerald-400 flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-emerald-400/80" />
                              {item.result.totalDurationSeconds}s total runtime
                            </span>
                          )}
                          {item.request.characterStyle && (
                            <span className="stamp-chip text-[10px] bg-[#121211] border-white/10 text-[#9C9C96] truncate max-w-xs font-narrative normal-case">
                              {item.request.characterStyle}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectStory(item);
                            onClose();
                          }}
                          className="px-3.5 py-2 bg-white text-black hover:bg-[#E5E5E0] text-xs font-medium font-editorial-meta uppercase tracking-wider rounded-[2px] flex items-center gap-1.5 transition-all shadow-sm focus:outline-none"
                        >
                          <span>Load Breakdown</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteItem(item.id)}
                          className="p-2 text-[#7D7D76] hover:text-red-400 hover:bg-white/5 rounded-[2px] transition-colors focus:outline-none"
                          title="Delete this record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            {items.length > 0 && (
              <div className="px-6 py-3.5 border-t border-white/10 bg-[#161614] flex items-center justify-between text-xs">
                <span className="text-xs text-[#8C8C86] font-mono">
                  {items.length} {items.length === 1 ? 'breakdown' : 'breakdowns'} stored in local browser history
                </span>
                <button
                  type="button"
                  id="clear-all-history-desktop"
                  onClick={() => setShowClearConfirm(true)}
                  className="text-xs text-red-400 hover:text-red-300 font-mono flex items-center gap-1.5 focus:outline-none transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear All History
                </button>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
}
