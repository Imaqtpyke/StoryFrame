import { ActivePage } from '../types';

interface HeaderProps {
  activePage: ActivePage;
  onNavigate: (page: ActivePage) => void;
}

export default function Header({ activePage, onNavigate }: HeaderProps) {
  return (
    <header className="w-full border-b border-white/10 bg-[#0C0C0B]/90 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
        <button
          type="button"
          id="logo-brand-button"
          onClick={() => onNavigate('generator')}
          className="flex items-center space-x-2 sm:space-x-2.5 text-left group focus:outline-none min-h-[44px] py-1"
        >
          <div className="w-7 h-7 border border-white flex items-center justify-center rounded-[1px] transition-colors group-hover:bg-white group-hover:text-black">
            <span className="text-xs font-bold font-serif leading-none">S</span>
          </div>
          <span className="text-base sm:text-lg font-normal font-display tracking-tight text-white">
            StoryFrame
          </span>
        </button>

        <nav className="flex items-center space-x-3 sm:space-x-6 text-[9px] sm:text-sm uppercase font-editorial-meta">
          <button
            type="button"
            id="nav-generator-btn"
            onClick={() => onNavigate('generator')}
            className={`min-h-[38px] sm:min-h-[44px] inline-flex items-center px-1 tracking-wider sm:tracking-widest transition-colors ${
              activePage === 'generator' ? 'text-white font-medium' : 'text-[#8C8C86] hover:text-white'
            }`}
          >
            Generator
          </button>
        </nav>
      </div>
    </header>
  );
}
