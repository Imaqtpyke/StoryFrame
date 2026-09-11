import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface CustomDropdownProps {
  id: string;
  label: string;
  options: DropdownOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  disabled?: boolean;
}

export default function CustomDropdown({
  id,
  label,
  options,
  selectedValue,
  onSelect,
  disabled = false,
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

  return (
    <div className="relative w-full font-narrative" ref={containerRef} id={`dropdown-container-${id}`}>
      <label
        htmlFor={`dropdown-btn-${id}`}
        className="block font-editorial-meta text-[10px] sm:text-[11px] text-[#9C9C96] mb-1.5 sm:mb-2"
      >
        {label.toUpperCase()}
      </label>
      <button
        type="button"
        id={`dropdown-btn-${id}`}
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 bg-[#121211] hover:bg-[#161614] text-[#F5F5F0] border border-white/10 transition-colors text-left focus:outline-none focus:border-white disabled:opacity-50 text-xs sm:text-base min-h-[36px] sm:min-h-[44px]"
      >
        <span className="truncate min-w-0 pr-1 font-narrative">
          {selectedOption ? selectedOption.label : 'Select an option'}
          {selectedOption?.sublabel && (
            <span className="ml-1.5 font-editorial-meta text-[9px] sm:text-[10px] text-[#9C9C96] hidden md:inline">({selectedOption.sublabel})</span>
          )}
        </span>
        <ChevronDown
          size={14}
          className={`ml-1 sm:ml-2 text-[#9C9C96] transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#161614] border border-white/20 shadow-2xl overflow-hidden py-1 max-h-64 overflow-y-auto font-narrative"
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
                  className={`w-full flex items-center justify-between px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-left transition-colors min-h-[36px] sm:min-h-[40px] ${
                    isSelected
                      ? 'bg-[#222220] text-white font-medium'
                      : 'text-[#D4D4D0] hover:bg-[#1f1f1d] hover:text-white'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-narrative">{opt.label}</span>
                    {opt.sublabel && (
                      <span className="font-editorial-meta text-[9px] sm:text-[10px] text-[#9C9C96] mt-0.5">{opt.sublabel}</span>
                    )}
                  </div>
                  {isSelected && <Check size={13} className="text-white shrink-0 ml-2" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
