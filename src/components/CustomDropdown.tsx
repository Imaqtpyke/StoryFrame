import { useState, useRef, useEffect, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  badgeColor?: 'default' | 'emerald' | 'amber' | 'blue';
  description?: string;
  icon?: ReactNode;
}

interface CustomDropdownProps {
  id: string;
  label: string;
  options: DropdownOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  disabled?: boolean;
  headerBadge?: string;
  helperText?: string;
}

export default function CustomDropdown({
  id,
  label,
  options,
  selectedValue,
  onSelect,
  disabled = false,
  headerBadge,
  helperText,
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedOption = options.find((opt) => opt.value === selectedValue) || options[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const getBadgeClass = (color?: string) => {
    switch (color) {
      case 'emerald':
        return 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30';
      case 'amber':
        return 'bg-amber-950/60 text-amber-300 border border-amber-500/30';
      case 'blue':
        return 'bg-blue-950/60 text-blue-300 border border-blue-500/30';
      default:
        return 'bg-white/10 text-[#EDEDE8] border border-white/15';
    }
  };

  return (
    <div className="relative w-full font-narrative" ref={containerRef} id={`dropdown-container-${id}`}>
      <div className="flex items-center justify-between mb-1.5 sm:mb-2">
        <label
          htmlFor={`dropdown-btn-${id}`}
          className="block font-editorial-meta text-[10px] sm:text-[11px] text-[#9C9C96]"
        >
          {label.toUpperCase()}
        </label>
        {headerBadge && (
          <span className="font-editorial-meta text-[9px] text-emerald-400 tracking-wider">
            {headerBadge}
          </span>
        )}
      </div>

      <button
        type="button"
        id={`dropdown-btn-${id}`}
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full flex items-center justify-between px-3.5 sm:px-4 py-2.5 min-h-[46px] bg-[#0E0E0D] hover:bg-[#151513] text-[#F5F5F0] border transition-all text-left focus:outline-none rounded-[3px] disabled:opacity-50 text-xs sm:text-sm font-narrative shadow-sm ${
          isOpen ? 'border-white bg-[#161614] ring-1 ring-white/10' : 'border-white/15 hover:border-white/30'
        }`}
      >
        <div className="flex items-center space-x-2.5 truncate min-w-0 pr-1">
          {selectedOption?.icon && (
            <span className="shrink-0 text-white/80">{selectedOption.icon}</span>
          )}
          <span className="truncate font-medium font-narrative text-[#F5F5F0]">
            {selectedOption ? selectedOption.label : 'Select an option'}
          </span>
          {selectedOption?.badge && (
            <span
              className={`shrink-0 text-[9px] font-editorial-meta font-medium px-1.5 py-0.5 rounded-[2px] tracking-wider ${getBadgeClass(
                selectedOption.badgeColor
              )}`}
            >
              {selectedOption.badge}
            </span>
          )}
          {selectedOption?.sublabel && (
            <span className="ml-1 font-editorial-meta text-[9px] sm:text-[10px] text-[#9C9C96] hidden md:inline">
              ({selectedOption.sublabel})
            </span>
          )}
        </div>
        <ChevronDown
          size={14}
          className={`ml-1.5 sm:ml-2 text-[#9C9C96] transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-white' : ''
          }`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.99 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#121211] border border-white/20 shadow-2xl rounded-[3px] overflow-hidden py-1.5 max-h-80 overflow-y-auto font-narrative"
            role="listbox"
            id={`dropdown-listbox-${id}`}
          >
            {options.map((opt) => {
              const isSelected = opt.value === selectedValue;
              return (
                <button
                  type="button"
                  key={opt.value}
                  id={`dropdown-item-${id}-${opt.value}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onSelect(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-start justify-between px-3.5 sm:px-4 py-2.5 text-xs sm:text-sm text-left transition-colors ${
                    isSelected
                      ? 'bg-[#1F1F1C] text-white'
                      : 'text-[#D4D4D0] hover:bg-[#1A1A18] hover:text-white'
                  }`}
                >
                  <div className="flex items-start space-x-2.5 min-w-0 pr-2">
                    {opt.icon && (
                      <span className="shrink-0 mt-0.5 text-white/80">{opt.icon}</span>
                    )}
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center space-x-2 flex-wrap">
                        <span className={`font-narrative ${isSelected ? 'font-semibold text-white' : 'font-medium'}`}>
                          {opt.label}
                        </span>
                        {opt.badge && (
                          <span
                            className={`text-[8.5px] font-editorial-meta font-medium px-1.5 py-0.5 rounded-[2px] tracking-wider shrink-0 ${getBadgeClass(
                              opt.badgeColor
                            )}`}
                          >
                            {opt.badge}
                          </span>
                        )}
                        {opt.sublabel && (
                          <span className="font-editorial-meta text-[9px] text-[#8E8E88]">
                            ({opt.sublabel})
                          </span>
                        )}
                      </div>
                      {opt.description && (
                        <p className="text-[11px] text-[#9C9C96] mt-0.5 font-narrative leading-relaxed">
                          {opt.description}
                        </p>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <span className="shrink-0 text-white mt-1 ml-2">
                      <Check size={14} className="stroke-[2.5]" />
                    </span>
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {helperText && (
        <p className="text-[10px] sm:text-[11px] text-[#888882] font-narrative mt-1.5 leading-relaxed">
          {helperText}
        </p>
      )}
    </div>
  );
}
