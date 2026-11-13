import { StyleProfile } from '../types';
import { Sparkles, Users, MapPin, Copy, Check } from 'lucide-react';

interface StyleAndCharactersProps {
  styleProfile?: StyleProfile;
  characterSheet?: Record<string, string>;
  locationSheet?: Record<string, string>;
  copiedIndex: string | null;
  onCopy: (text: string, identifier: string) => void;
  isModal?: boolean;
  onOpenReferencePacket?: (characterName?: string) => void;
}

export default function StyleAndCharactersSection({
  styleProfile,
  characterSheet,
  locationSheet,
  copiedIndex,
  onCopy,
  isModal = false,
  onOpenReferencePacket,
}: StyleAndCharactersProps) {
  const characterEntries = characterSheet ? Object.entries(characterSheet) : [];
  const locationEntries = locationSheet ? Object.entries(locationSheet) : [];

  if (!styleProfile && characterEntries.length === 0 && locationEntries.length === 0) {
    return null;
  }

  return (
    <div className="space-y-5 font-narrative text-[#F5F5F0]">
      {/* Story Style Profile Panel */}
      {styleProfile && (
        <div
          id={isModal ? 'modal-style-profile-panel' : 'style-profile-panel'}
          className="bg-[#121211] border border-white/10 rounded-[3px] p-4 sm:p-5 space-y-4"
        >
          <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div className="flex items-center space-x-2">
              <Sparkles size={15} className="text-white shrink-0" />
              <h3 className="font-display text-sm sm:text-base font-medium text-white">
                Visual Style Profile
              </h3>
            </div>
            <button
              type="button"
              id={isModal ? 'modal-copy-style-btn' : 'copy-style-profile-button'}
              onClick={() => {
                const styleText = `Art Style: ${styleProfile.artStyle}\nColor Palette: ${styleProfile.colorPalette}\nLighting: ${styleProfile.lighting}\nEra and Setting: ${styleProfile.eraAndSetting}`;
                onCopy(styleText, isModal ? 'modal-style-profile' : 'style-profile');
              }}
              className="inline-flex items-center font-display text-xs px-3 py-1.5 text-[#D4D4D0] hover:text-white bg-[#1a1a18] hover:bg-[#262624] border border-white/15 rounded-[3px] transition-colors whitespace-nowrap cursor-pointer"
            >
              {copiedIndex === (isModal ? 'modal-style-profile' : 'style-profile') ? (
                <>
                  <Check size={12} className="mr-1.5 text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy size={12} className="mr-1.5 text-[#9C9C96]" />
                  <span>Copy Style</span>
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-[#9C9C96] leading-relaxed font-narrative">
            Generated for this story to preserve genre tone and aesthetic continuity across every visual beat prompt.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="bg-[#0C0C0B] border border-white/10 rounded-[3px] p-3.5 space-y-1">
              <span className="font-editorial-meta text-[10px] text-[#8C8C86] block">
                ART STYLE
              </span>
              <p className="text-xs sm:text-sm text-[#F5F5F0] font-narrative leading-relaxed">
                {styleProfile.artStyle}
              </p>
            </div>

            <div className="bg-[#0C0C0B] border border-white/10 rounded-[3px] p-3.5 space-y-1">
              <span className="font-editorial-meta text-[10px] text-[#8C8C86] block">
                COLOR PALETTE
              </span>
              <p className="text-xs sm:text-sm text-[#F5F5F0] font-narrative leading-relaxed">
                {styleProfile.colorPalette}
              </p>
            </div>

            <div className="bg-[#0C0C0B] border border-white/10 rounded-[3px] p-3.5 space-y-1">
              <span className="font-editorial-meta text-[10px] text-[#8C8C86] block">
                LIGHTING &amp; ATMOSPHERE
              </span>
              <p className="text-xs sm:text-sm text-[#F5F5F0] font-narrative leading-relaxed">
                {styleProfile.lighting}
              </p>
            </div>

            <div className="bg-[#0C0C0B] border border-white/10 rounded-[3px] p-3.5 space-y-1">
              <span className="font-editorial-meta text-[10px] text-[#8C8C86] block">
                ERA &amp; SETTING
              </span>
              <p className="text-xs sm:text-sm text-[#F5F5F0] font-narrative leading-relaxed">
                {styleProfile.eraAndSetting}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Character Sheet Panel */}
      {characterEntries.length > 0 && (
        <div
          id={isModal ? 'modal-character-sheet-panel' : 'character-sheet-panel'}
          className="bg-[#121211] border border-white/10 rounded-[3px] p-4 sm:p-5 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-3 flex-wrap gap-2">
            <div className="flex items-center space-x-2">
              <Users size={15} className="text-white shrink-0" />
              <h3 className="font-display text-sm sm:text-base font-medium text-white">
                Character Continuity Sheet
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {onOpenReferencePacket && (
                <button
                  type="button"
                  id={`${isModal ? 'modal-' : ''}open-ref-packet-btn`}
                  onClick={() => onOpenReferencePacket()}
                  className="inline-flex items-center font-display text-xs px-3 py-1.5 text-white bg-[#1f1f1d] hover:bg-[#2a2a27] border border-white/20 rounded-[3px] transition-colors whitespace-nowrap cursor-pointer"
                  title="Generate multi-angle character reference prompts for Midjourney, Kling, and Runway"
                >
                  <Sparkles size={12} className="mr-1.5 text-amber-400" />
                  <span>Reference Packets</span>
                </button>
              )}
              <span className="stamp-chip text-[10px]">
                {characterEntries.length} {characterEntries.length === 1 ? 'CHARACTER' : 'CHARACTERS'}
              </span>
            </div>
          </div>

          <p className="text-xs text-[#9C9C96] leading-relaxed font-narrative">
            Fixed visual descriptions for recurring characters, reused across beat prompts to prevent visual drift.
          </p>

          <div className="grid grid-cols-1 gap-3 pt-1">
            {characterEntries.map(([charName, desc]) => {
              const copyId = isModal ? `modal-char-${charName}` : `char-${charName}`;
              const isCopied = copiedIndex === copyId;
              return (
                <div
                  key={charName}
                  id={`${isModal ? 'modal-' : ''}character-card-${charName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                  className="bg-[#0C0C0B] border border-white/10 rounded-[3px] p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="inline-block w-1.5 h-1.5 bg-white rounded-[1px]" />
                      <span className="font-display text-sm sm:text-base font-medium text-white tracking-tight">
                        {charName}
                      </span>
                    </div>

                    <button
                      type="button"
                      id={`${isModal ? 'modal-' : ''}copy-character-btn-${charName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                      onClick={() => onCopy(desc, copyId)}
                      className="inline-flex items-center font-display text-xs px-2.5 py-1 text-[#D4D4D0] hover:text-white bg-[#1c1c1a] hover:bg-[#262624] border border-white/15 rounded-[3px] transition-colors whitespace-nowrap cursor-pointer"
                    >
                      {isCopied ? (
                        <>
                          <Check size={11} className="mr-1 text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={11} className="mr-1 text-[#9C9C96]" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-xs sm:text-sm leading-relaxed text-[#E6E6E1] font-narrative selection:bg-white selection:text-black">
                    {desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Location Sheet Panel */}
      {locationEntries.length > 0 && (
        <div
          id={isModal ? 'modal-location-sheet-panel' : 'location-sheet-panel'}
          className="bg-[#121211] border border-white/10 rounded-[3px] p-4 sm:p-5 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center space-x-2">
              <MapPin size={15} className="text-white shrink-0" />
              <h3 className="font-display text-sm sm:text-base font-medium text-white">
                Location Continuity Sheet
              </h3>
            </div>
            <span className="stamp-chip text-[10px]">
              {locationEntries.length} {locationEntries.length === 1 ? 'LOCATION' : 'LOCATIONS'}
            </span>
          </div>

          <p className="text-xs text-[#9C9C96] leading-relaxed font-narrative">
            Fixed environment anchors reused across beat prompts for spatial and lighting continuity.
          </p>

          <div className="grid grid-cols-1 gap-3 pt-1">
            {locationEntries.map(([locationName, desc]) => {
              const copyId = isModal ? `modal-loc-${locationName}` : `loc-${locationName}`;
              const isCopied = copiedIndex === copyId;
              return (
                <div
                  key={locationName}
                  id={`${isModal ? 'modal-' : ''}location-card-${locationName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                  className="bg-[#0C0C0B] border border-white/10 rounded-[3px] p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="inline-block w-1.5 h-1.5 bg-white rounded-[1px]" />
                      <span className="font-display text-sm sm:text-base font-medium text-white tracking-tight">
                        {locationName}
                      </span>
                    </div>

                    <button
                      type="button"
                      id={`${isModal ? 'modal-' : ''}copy-location-btn-${locationName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                      onClick={() => onCopy(desc, copyId)}
                      className="inline-flex items-center font-display text-xs px-2.5 py-1 text-[#D4D4D0] hover:text-white bg-[#1c1c1a] hover:bg-[#262624] border border-white/15 rounded-[3px] transition-colors whitespace-nowrap cursor-pointer"
                    >
                      {isCopied ? (
                        <>
                          <Check size={11} className="mr-1 text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={11} className="mr-1 text-[#9C9C96]" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-xs sm:text-sm leading-relaxed text-[#E6E6E1] font-narrative selection:bg-white selection:text-black">
                    {desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
