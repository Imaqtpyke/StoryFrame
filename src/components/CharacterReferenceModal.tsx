import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Check, User, Sparkles, BookOpen, Layers } from 'lucide-react';
import { StyleProfile } from '../types';
import { generateCharacterReferencePacket, CharacterReferencePacket } from '../services/characterContinuity';

interface CharacterReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  characterSheet: Record<string, string>;
  styleProfile?: StyleProfile;
  format?: 'short' | 'long';
}

export default function CharacterReferenceModal({
  isOpen,
  onClose,
  characterSheet,
  styleProfile,
  format = 'short',
}: CharacterReferenceModalProps) {
  const characters = Object.entries(characterSheet || {});
  const [selectedCharName, setSelectedCharName] = useState<string>(characters[0]?.[0] || '');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (characters.length > 0 && !selectedCharName) {
      setSelectedCharName(characters[0][0]);
    }
  }, [characters, selectedCharName]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || characters.length === 0) return null;

  const currentDesc = characterSheet[selectedCharName] || '';
  const packet: CharacterReferencePacket = generateCharacterReferencePacket(
    selectedCharName,
    currentDesc,
    styleProfile,
    format
  );

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopyFullPacket = () => {
    const text = `# Character Reference Packet: ${packet.characterName}
Identity Summary: ${packet.identitySummary}

## Angle 1: Front-Facing Portrait (Face & Expression Anchor)
${packet.frontPortraitPrompt}

## Angle 2: Three-Quarter Medium Angle (Hair, Jawline & Silhouette)
${packet.threeQuarterPrompt}

## Angle 3: Full-Body Action Stance (Wardrobe & Biomechanics)
${packet.fullBodyActionPrompt}

## Video Model Consistency Keywords
${packet.videoModelAnchorTags.join(', ')}

## Continuity Instructions
${packet.midjourneyCrefAdvice}
`;
    handleCopy(text, 'full-packet');
  };

  return createPortal(
    <div
      id="character-reference-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reference-packet-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl max-h-[90vh] bg-[#121210] border border-white/20 rounded-lg shadow-2xl flex flex-col overflow-hidden font-narrative text-[#F5F5F0]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-[#171715] border-b border-white/10 shrink-0">
          <div className="flex items-center space-x-2.5">
            <User size={18} className="text-white shrink-0" />
            <div>
              <h3 id="reference-packet-title" className="font-display text-sm sm:text-base font-medium text-white">
                Character Reference Packet
              </h3>
              <p className="text-[10px] sm:text-xs text-[#9C9C96] font-narrative">
                Multi-angle prompt formulas to lock character likeness in Midjourney, Kling, and Runway.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#9C9C96] hover:text-white hover:bg-white/10 rounded-md transition-colors"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Character Tab Selector */}
        {characters.length > 1 && (
          <div className="flex items-center gap-1 px-4 sm:px-6 py-2 bg-[#0E0E0D] border-b border-white/5 overflow-x-auto shrink-0 scrollbar-none">
            {characters.map(([name]) => (
              <button
                key={name}
                type="button"
                onClick={() => setSelectedCharName(name)}
                className={`px-3 py-1 text-xs font-display font-medium rounded-md transition-colors whitespace-nowrap ${
                  selectedCharName === name
                    ? 'bg-white text-black font-semibold'
                    : 'text-[#A0A09A] hover:text-white hover:bg-white/5'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5">
          {/* Identity Summary Card */}
          <div className="p-3.5 bg-[#171715] border border-white/10 rounded-md space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-editorial-meta text-[10px] text-[#8C8C86] uppercase tracking-wider">
                Character Identity Blueprint
              </span>
              <span className="font-editorial-meta text-[10px] text-[#A0A09A]">
                {packet.characterName}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#E6E6E1] leading-relaxed">
              {packet.identitySummary}
            </p>
          </div>

          {/* Reference Angle 1: Front Portrait */}
          <div className="bg-[#171715] border border-white/10 rounded-md p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-editorial-meta text-[10px] text-white font-medium uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={12} className="text-white" />
                <span>Angle 1: Front-Facing Headshot (Face Reference)</span>
              </span>
              <button
                type="button"
                onClick={() => handleCopy(packet.frontPortraitPrompt, 'front-portrait')}
                className="inline-flex items-center text-[10px] font-editorial-meta px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded transition-colors"
              >
                {copiedId === 'front-portrait' ? (
                  <>
                    <Check size={11} className="mr-1" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={11} className="mr-1" />
                    <span>Copy Prompt</span>
                  </>
                )}
              </button>
            </div>
            <p className="p-2.5 bg-[#0A0A09] border border-white/5 rounded font-mono text-xs text-[#D8D8D2] leading-relaxed select-all">
              {packet.frontPortraitPrompt}
            </p>
          </div>

          {/* Reference Angle 2: Three-Quarter Medium Shot */}
          <div className="bg-[#171715] border border-white/10 rounded-md p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-editorial-meta text-[10px] text-white font-medium uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={12} className="text-white" />
                <span>Angle 2: Three-Quarter Profile (Silhouette &amp; Hair)</span>
              </span>
              <button
                type="button"
                onClick={() => handleCopy(packet.threeQuarterPrompt, 'three-quarter')}
                className="inline-flex items-center text-[10px] font-editorial-meta px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded transition-colors"
              >
                {copiedId === 'three-quarter' ? (
                  <>
                    <Check size={11} className="mr-1" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={11} className="mr-1" />
                    <span>Copy Prompt</span>
                  </>
                )}
              </button>
            </div>
            <p className="p-2.5 bg-[#0A0A09] border border-white/5 rounded font-mono text-xs text-[#D8D8D2] leading-relaxed select-all">
              {packet.threeQuarterPrompt}
            </p>
          </div>

          {/* Reference Angle 3: Full-Body Action Stance */}
          <div className="bg-[#171715] border border-white/10 rounded-md p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-editorial-meta text-[10px] text-white font-medium uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen size={12} className="text-white" />
                <span>Angle 3: Full-Body Standing (Wardrobe &amp; Posture)</span>
              </span>
              <button
                type="button"
                onClick={() => handleCopy(packet.fullBodyActionPrompt, 'full-body')}
                className="inline-flex items-center text-[10px] font-editorial-meta px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded transition-colors"
              >
                {copiedId === 'full-body' ? (
                  <>
                    <Check size={11} className="mr-1" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={11} className="mr-1" />
                    <span>Copy Prompt</span>
                  </>
                )}
              </button>
            </div>
            <p className="p-2.5 bg-[#0A0A09] border border-white/5 rounded font-mono text-xs text-[#D8D8D2] leading-relaxed select-all">
              {packet.fullBodyActionPrompt}
            </p>
          </div>

          {/* Best Practices Note */}
          <div className="p-3 bg-[#111110] border border-white/10 rounded-md space-y-1 text-xs text-[#A8A8A2] leading-relaxed">
            <span className="font-medium text-white block">Workflow Best Practice:</span>
            <span>
              Generate the <strong>Angle 1 Front Headshot</strong> first in Midjourney or Flux. Once you get an image you love, copy its direct image link and append <code className="text-white bg-white/10 px-1 py-0.5 rounded">--cref &lt;IMAGE_URL&gt; --cw 80</code> onto all story beats. For Kling and Runway, upload the rendered front portrait as an initial character reference frame.
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-3 bg-[#171715] border-t border-white/10 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-editorial-meta text-[#8C8C86]">
            3 REFERENCE ANGLES PREPARED
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyFullPacket}
              className="px-3.5 py-1.5 bg-white text-black hover:bg-neutral-200 text-xs font-display font-medium rounded-md transition-colors shadow-sm inline-flex items-center gap-1.5"
            >
              {copiedId === 'full-packet' ? (
                <>
                  <Check size={12} className="text-black" />
                  <span>Full Packet Copied</span>
                </>
              ) : (
                <>
                  <Copy size={12} className="text-black" />
                  <span>Copy Full Packet</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-[#222220] hover:bg-[#2d2d2a] text-[#E6E6E1] text-xs font-display rounded-md transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
