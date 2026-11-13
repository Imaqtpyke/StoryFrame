import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HistoryItem } from '../types';
import {
  X,
  History,
  Trash2,
  Film,
  Clock,
  Sparkles,
  ExternalLink,
  AlertTriangle,
  Search,
  Clapperboard,
  Image as ImageIcon,
} from 'lucide-react';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: HistoryItem[];
  onSelectStory: (item: HistoryItem) => void;
  onDeleteItem: (id: string) => void;
  onClearAll: () => void;
}

type ModeFilter = 'all' | 'image' | 'video';

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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');

  useEffect(() => {
    const checkScreen = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkScreen();
    window.addEventListener('resize', checkScreen);
    return () => window.removeEventListener('resize', checkScreen);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      const itemMode = item.result.generationMode === 'video' || item.request.generationMode === 'video' ? 'video' : 'image';
      if (modeFilter !== 'all' && itemMode !== modeFilter) {
        return false;
      }
      if (!query) return true;
      return (
        item.storyTitle.toLowerCase().includes(query) ||
        (item.request.characterStyle || '').toLowerCase().includes(query) ||
        (item.request.platform || '').toLowerCase().includes(query)
      );
    });
  }, [items, searchQuery, modeFilter]);

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

  const renderFilterBar = () => (
    <div className="px-4 sm:px-6 py-3 border-b border-white/10 bg-[#141412] flex flex-col sm:flex-row sm:items-center gap-2.5 shrink-0">
      <div className="relative flex-1">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7D7D76]" />
        <input
          type="text"
          id="history-search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search story titles, styles, or platforms..."
          className="w-full pl-9 pr-8 py-2 bg-[#0C0C0B] border border-white/15 focus:border-white rounded-[3px] text-xs sm:text-sm text-white placeholder:text-[#666660] focus:outline-none"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8C8C86] hover:text-white cursor-pointer"
            aria-label="Clear search"
          >
            <X size={13} />
          </button>
        )}
      </div>

      <div className="inline-flex p-0.5 bg-[#0C0C0B] border border-white/15 rounded-[3px] shrink-0">
        {(['all', 'image', 'video'] as ModeFilter[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setModeFilter(mode)}
            className={`px-3 py-1.5 text-xs font-display rounded-[2px] transition-colors cursor-pointer ${
              modeFilter === mode
                ? 'bg-white text-black font-semibold'
                : 'text-[#9C9C96] hover:text-white'
            }`}
          >
            {mode === 'all' ? 'All' : mode === 'image' ? 'Image' : 'Video'}
          </button>
        ))}
      </div>
    </div>
  );

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

        {isMobile ? (
          <motion.div
            id="history-drawer-mobile"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed inset-y-0 right-0 w-[92vw] max-w-[380px] h-full bg-[#111110] border-l border-white/15 flex flex-col z-50 shadow-2xl text-[#F5F5F0]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-heading"
          >
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#161614]">
              <div className="flex items-center space-x-2">
                <History className="w-4 h-4 text-white" />
                <h2 id="history-heading" className="text-sm font-medium font-display tracking-tight text-white">
                  Story History
                </h2>
                {items.length > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-mono tabular-nums bg-white/10 text-white rounded-[2px] leading-none">
                    {items.length}
                  </span>
                )}
              </div>
              <button
                type="button"
                id="close-history-drawer-mobile"
                onClick={onClose}
                className="w-8 h-8 rounded-[3px] flex items-center justify-center text-[#8C8C86] hover:text-white hover:bg-white/10 transition-colors focus:outline-none cursor-pointer"
                aria-label="Close history"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {items.length > 0 && renderFilterBar()}

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
                    className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white text-xs font-display rounded-[3px] cursor-pointer"
                  >
                    Yes, Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white text-xs font-display rounded-[3px] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-16 text-center px-4">
                  <div className="w-12 h-12 rounded-[3px] bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                    <History className="w-6 h-6 text-[#7D7D76]" />
                  </div>
                  <p className="text-sm font-medium text-white font-display">No Saved Breakdowns</p>
                  <p className="text-xs text-[#8C8C86] mt-1 max-w-[220px]">
                    Generate a story breakdown and your scene prompts will be saved here automatically.
                  </p>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <p className="text-sm text-white font-display">No matching stories found</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setModeFilter('all');
                    }}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-display rounded-[3px] cursor-pointer"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                filteredItems.map((item) => {
                  const isItemVideo = item.result.generationMode === 'video' || item.request.generationMode === 'video';
                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-[3px] bg-[#181816] border border-white/10 hover:border-white/25 transition-all text-left"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <span className="text-[11px] font-mono text-[#8C8C86] flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(item.timestamp)}
                          </span>
                          <h3 className="text-sm font-medium text-white font-display line-clamp-2 mt-0.5 leading-snug">
                            {item.storyTitle}
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteItem(item.id);
                          }}
                          className="p-1.5 text-[#7D7D76] hover:text-red-400 hover:bg-white/5 rounded-[3px] transition-colors cursor-pointer"
                          title="Delete this history item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <span
                          className={`stamp-chip text-[9px] ${
                            isItemVideo
                              ? 'bg-amber-950/60 text-amber-300 border-amber-700/60'
                              : 'bg-[#121211] border-white/10'
                          }`}
                        >
                          {isItemVideo ? 'Video' : 'Image'}
                        </span>
                        <span className="stamp-chip text-[9px] bg-[#121211] border-white/10">
                          {item.request.format === 'short' ? '9:16 Short' : '16:9 Long'}
                        </span>
                        <span className="stamp-chip text-[9px] bg-[#121211] border-white/10">
                          {item.result.scenes.length} Scenes
                        </span>
                      </div>

                      {item.request.characterStyle && (
                        <p className="text-xs text-[#8C8C86] truncate mt-1.5 italic font-narrative">
                          Style: {item.request.characterStyle}
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          onSelectStory(item);
                          onClose();
                        }}
                        className="w-full mt-2.5 py-2 px-3 bg-white text-black hover:bg-[#E5E5E0] text-xs font-medium font-display rounded-[3px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <span>Load Breakdown</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {items.length > 0 && (
              <div className="p-3 border-t border-white/10 bg-[#161614] flex items-center justify-between text-xs">
                <span className="text-xs text-[#8C8C86] font-mono tabular-nums">
                  {filteredItems.length} of {items.length} shown
                </span>
                <button
                  type="button"
                  id="clear-all-history-mobile"
                  onClick={() => setShowClearConfirm(true)}
                  className="text-xs text-red-400 hover:text-red-300 font-display flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All</span>
                </button>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            id="history-modal-desktop"
            initial={{ scale: 0.98, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.98, opacity: 0, y: 8 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-3xl max-h-[85vh] bg-[#121210] border border-white/15 rounded-[4px] shadow-2xl flex flex-col z-50 overflow-hidden text-[#F5F5F0] mx-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-heading-desktop"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#161614]">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-[3px] bg-white/10 border border-white/15 flex items-center justify-center">
                  <History className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 id="history-heading-desktop" className="text-base font-medium font-display tracking-tight text-white flex items-center gap-2">
                    <span>Story History &amp; Saved Breakdowns</span>
                    {items.length > 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] font-mono tabular-nums bg-white text-black font-bold rounded-[2px]">
                        {items.length}
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-[#8C8C86] font-narrative">
                    Search, filter, and reopen any breakdown stored in your browser.
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="close-history-modal-desktop"
                onClick={onClose}
                className="w-8 h-8 rounded-[3px] flex items-center justify-center text-[#8C8C86] hover:text-white hover:bg-white/10 transition-colors focus:outline-none cursor-pointer"
                aria-label="Close history modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {items.length > 0 && renderFilterBar()}

            {showClearConfirm && (
              <div className="px-6 py-2.5 bg-red-950/40 border-b border-red-500/20 text-xs text-red-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span>Delete all {items.length} saved story breakdowns from local browser storage?</span>
                </div>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClearAll();
                      setShowClearConfirm(false);
                    }}
                    className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs font-display font-medium rounded-[3px] transition-colors cursor-pointer"
                  >
                    Confirm Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-xs font-display rounded-[3px] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {items.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-center px-4">
                  <div className="w-12 h-12 rounded-[3px] bg-white/5 border border-white/10 flex items-center justify-center mb-3.5">
                    <History className="w-6 h-6 text-[#7D7D76]" />
                  </div>
                  <h3 className="text-base font-medium text-white font-display">No History Records Yet</h3>
                  <p className="text-xs sm:text-sm text-[#8C8C86] mt-1.5 max-w-sm font-narrative">
                    When you generate a storyboard and narrator script, it is automatically saved here for instant access.
                  </p>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="py-14 flex flex-col items-center justify-center text-center space-y-3">
                  <p className="text-sm font-display text-white">No breakdowns match your search or filter</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setModeFilter('all');
                    }}
                    className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-display rounded-[3px] cursor-pointer"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                filteredItems.map((item) => {
                  const totalBeats = item.result.scenes.reduce(
                    (acc, scene) => acc + (scene.beats?.length || 0),
                    0
                  );
                  const isItemVideo = item.result.generationMode === 'video' || item.request.generationMode === 'video';
                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-[3px] bg-[#181816] border border-white/10 hover:border-white/25 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#1B1B19]"
                    >
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 text-xs font-mono text-[#8C8C86] flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#7D7D76]" />
                            {formatDate(item.timestamp)}
                          </span>
                          <span className="text-white/20">/</span>
                          <span className="text-white/75">
                            {item.request.format === 'short' ? '9:16 Vertical' : '16:9 Widescreen'}
                          </span>
                          <span className="text-white/20">/</span>
                          <span className="text-[#A8A8A2]">
                            {item.request.platform || 'General'}
                          </span>
                        </div>

                        <h3 className="text-sm sm:text-base font-medium text-white font-display line-clamp-2 leading-snug">
                          {item.storyTitle}
                        </h3>

                        <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
                          <span
                            className={`stamp-chip text-[10px] inline-flex items-center gap-1 ${
                              isItemVideo
                                ? 'bg-amber-950/60 text-amber-300 border-amber-700/60'
                                : 'bg-[#121211] border-white/15'
                            }`}
                          >
                            {isItemVideo ? <Clapperboard className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                            <span>{isItemVideo ? 'Text to Video' : 'Text to Image'}</span>
                          </span>
                          <span className="stamp-chip text-[10px] bg-[#121211] border-white/10 inline-flex items-center gap-1 tabular-nums">
                            <Film className="w-3 h-3 text-[#9C9C96]" />
                            {item.result.scenes.length} Scenes ({totalBeats} Beats)
                          </span>
                          {item.result.totalDurationSeconds > 0 && (
                            <span className="stamp-chip text-[10px] bg-[#121211] border-white/10 text-emerald-400 inline-flex items-center gap-1 tabular-nums">
                              <Sparkles className="w-3 h-3 text-emerald-400/80" />
                              {item.result.totalDurationSeconds}s runtime
                            </span>
                          )}
                          {item.request.characterStyle && (
                            <span className="text-xs text-[#9C9C96] truncate max-w-xs font-narrative italic">
                              {item.request.characterStyle}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectStory(item);
                            onClose();
                          }}
                          className="px-3.5 py-2 bg-white text-black hover:bg-[#E5E5E0] text-xs font-semibold font-display rounded-[3px] flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <span>Load Breakdown</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteItem(item.id)}
                          className="p-2 text-[#7D7D76] hover:text-red-400 hover:bg-white/5 rounded-[3px] transition-colors cursor-pointer"
                          title="Delete this record"
                          aria-label="Delete saved breakdown"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {items.length > 0 && (
              <div className="px-6 py-3.5 border-t border-white/10 bg-[#161614] flex items-center justify-between text-xs">
                <span className="text-xs text-[#8C8C86] font-mono tabular-nums">
                  Showing {filteredItems.length} of {items.length} saved {items.length === 1 ? 'breakdown' : 'breakdowns'}
                </span>
                <button
                  type="button"
                  id="clear-all-history-desktop"
                  onClick={() => setShowClearConfirm(true)}
                  className="text-xs text-red-400 hover:text-red-300 font-display flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All History</span>
                </button>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
}
