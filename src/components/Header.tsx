import { ActivePage } from '../types';
import { History as HistoryIcon } from 'lucide-react';

interface HeaderProps {
  activePage: ActivePage;
  onNavigate: (page: ActivePage) => void;
  onOpenHistory: () => void;
  onOpenAssistant: () => void;
  historyCount?: number;
}

export default function Header({
  activePage: _activePage,
  onNavigate,
  onOpenHistory,
  onOpenAssistant,
  historyCount = 0,
}: HeaderProps) {
  return (
    <header className="w-full border-b border-white/10 bg-[#0C0C0B]/95 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-4">
        <button
          type="button"
          id="logo-brand-button"
          onClick={() => onNavigate('generator')}
          className="flex items-center space-x-2.5 text-left group focus:outline-none focus-visible:ring-1 focus-visible:ring-white rounded-[2px] min-h-[40px] py-1 px-1 -ml-1 cursor-pointer"
        >
          <div className="w-7 h-7 border border-white/80 flex items-center justify-center rounded-[2px] transition-colors group-hover:bg-white group-hover:text-black">
            <span className="text-xs font-bold font-serif leading-none">S</span>
          </div>
          <span className="text-base sm:text-lg font-normal font-display tracking-tight text-white">
            StoryFrame
          </span>
        </button>

        <nav className="flex items-center gap-1 sm:gap-2 font-display text-xs sm:text-sm">
          <button
            type="button"
            id="nav-assistant-btn"
            onClick={onOpenAssistant}
            className="min-h-[38px] inline-flex items-center px-2.5 sm:px-3 rounded-[3px] text-[#C4C4BE] hover:text-white hover:bg-white/[0.05] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white cursor-pointer"
            title="Open AI Assistant"
          >
            <span>AI Assistant</span>
          </button>

          <button
            type="button"
            id="nav-history-btn"
            onClick={onOpenHistory}
            className="min-h-[38px] inline-flex items-center gap-1.5 px-2.5 sm:px-3 rounded-[3px] border border-white/10 bg-[#141412] hover:border-white/25 hover:bg-[#1B1B19] text-[#EDEDE8] hover:text-white transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white cursor-pointer"
            title="View Previous Story Breakdowns"
          >
            <HistoryIcon className="w-3.5 h-3.5 text-[#9C9C96]" />
            <span>History</span>
            {historyCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 text-[10px] font-mono tabular-nums bg-white/12 text-white rounded-[2px] leading-none">
                {historyCount}
              </span>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
}
