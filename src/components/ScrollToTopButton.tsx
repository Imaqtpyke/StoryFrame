import { useState, useEffect } from 'react';
import { ChevronUp } from 'lucide-react';

export default function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show when user has scrolled down past 280px
      if (window.scrollY > 280) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Initial check
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (!isVisible) return null;

  return (
    <button
      type="button"
      id="scroll-to-top-button"
      onClick={scrollToTop}
      aria-label="Scroll to top of page"
      className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-50 p-2.5 min-w-[40px] min-h-[40px] bg-[#141412]/90 hover:bg-[#1E1E1C] active:bg-[#282826] text-white border border-white/20 hover:border-white transition-all shadow-xl backdrop-blur-sm group flex items-center justify-center focus:outline-none focus:ring-1 focus:ring-white"
    >
      <ChevronUp size={20} className="transition-transform duration-200 group-hover:-translate-y-0.5" />
    </button>
  );
}
