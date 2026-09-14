import { StyleProfile } from '../types';
import { Sparkles, Users, MapPin, Copy, Check } from 'lucide-react';

interface StyleAndCharactersProps {
  styleProfile?: StyleProfile;
  characterSheet?: Record<string, string>;
  locationSheet?: Record<string, string>;
  copiedIndex: string | null;
  onCopy: (text: string, identifier: string) => void;
  isModal?: boolean;
}

export default function StyleAndCharactersSection({
  styleProfile,
  characterSheet,
  locationSheet,
  copiedIndex,
  onCopy,
  isModal = false,
}: StyleAndCharactersProps) {
  const characterEntries = characterSheet ? Object.entries(characterSheet) : [];
  const locationEntries = locationSheet ? Object.entries(locationSheet) : [];

  if (!styleProfile && characterEntries.length === 0 && locationEntries.length === 0) {
    return null;
  }

  return (
    <div className="space-y-5 sm:space-y-7 font-narrative text-[#F5F5F0]">
      {/* Story Style Profile Panel with Corner Accent Brackets */}
      {styleProfile && (
        <div
          id={isModal ? 'modal-style-profile-panel' : 'style-profile-panel'}
          className="bg-[#111110] border border-white/10 p-4 sm:p-6 md:p-7 space-y-4 corner-bracket-container shadow-2xl"
        >
          <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3 sm:pb-4">
            <div className="flex items-center space-x-2.5">
              <Sparkles size={16} className="text-white shrink-0" />
              <h3 className="font-editorial-meta text-xs sm:text-sm font-semibold text-white">
                VISUAL STYLE PROFILE
              </h3>
            </div>
            <button
              type="button"
              id={isModal ? 'modal-copy-style-btn' : 'copy-style-profile-button'}
              onClick={() => {
                const styleText = `Art Style: ${styleProfile.artStyle}\nColor Palette: ${styleProfile.colorPalette}\nLighting: ${styleProfile.lighting}\nEra and Setting: ${styleProfile.eraAndSetting}`;
                onCopy(styleText, isModal ? 'modal-style-profile' : 'style-profile');
              }}
              className="inline-flex items-center font-editorial-meta text-[9px] sm:text-[10px] px-2 sm:px-2.5 py-1 text-[#D4D4D0] hover:text-white bg-[#1a1a18] hover:bg-[#262624] border border-white/15 transition-colors whitespace-nowrap min-h-[28px]"
            >
              {copiedIndex === (isModal ? 'modal-style-profile' : 'style-profile') ? (
                <>
                  <Check size={11} className="mr-1 text-white sm:w-3 sm:h-3" />
                  <span>COPIED</span>
                </>
              ) : (
                <>
                  <Copy size={11} className="mr-1 text-[#9C9C96] sm:w-3 sm:h-3" />
                  <span>COPY STYLE</span>
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-[#9C9C96] leading-relaxed font-narrative">
            Generated specifically for this story to adapt dynamically to its genre, tone, and visual continuity. Appended onto every visual beat prompt.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-1">
            <div className="bg-[#171715] border border-white/5 p-3 sm:p-4 space-y-1">
              <span className="font-editorial-meta text-[9px] sm:text-[10px] text-[#8C8C86] block">
                ART STYLE
              </span>
              <p className="text-xs sm:text-sm text-[#F5F5F0] font-narrative leading-relaxed">
                {styleProfile.artStyle}
              </p>
            </div>

            <div className="bg-[#171715] border border-white/5 p-3 sm:p-4 space-y-1">
              <span className="font-editorial-meta text-[9px] sm:text-[10px] text-[#8C8C86] block">
                COLOR PALETTE
              </span>
              <p className="text-xs sm:text-sm text-[#F5F5F0] font-narrative leading-relaxed">
                {styleProfile.colorPalette}
              </p>
            </div>

            <div className="bg-[#171715] border border-white/5 p-3 sm:p-4 space-y-1">
              <span className="font-editorial-meta text-[9px] sm:text-[10px] text-[#8C8C86] block">
                LIGHTING &amp; ATMOSPHERE
              </span>
              <p className="text-xs sm:text-sm text-[#F5F5F0] font-narrative leading-relaxed">
                {styleProfile.lighting}
              </p>
            </div>

            <div className="bg-[#171715] border border-white/5 p-3 sm:p-4 space-y-1">
              <span className="font-editorial-meta text-[9px] sm:text-[10px] text-[#8C8C86] block">
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
          className="bg-[#111110] border border-white/10 p-4 sm:p-6 md:p-7 space-y-4 corner-bracket-container shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-3 sm:pb-4">
            <div className="flex items-center space-x-2.5">
              <Users size={16} className="text-white shrink-0" />
              <h3 className="font-editorial-meta text-xs sm:text-sm font-semibold text-white">
                CHARACTER CONTINUITY SHEET
              </h3>
            </div>
            <span className="stamp-chip text-[9px]">
              {characterEntries.length} {characterEntries.length === 1 ? 'CHARACTER' : 'CHARACTERS'}
            </span>
          </div>

          <p className="text-xs text-[#9C9C96] leading-relaxed font-narrative">
            Fixed visual descriptions for recurring characters, reused across visual beat prompts to guarantee character continuity.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:gap-4 pt-1">
            {characterEntries.map(([charName, desc]) => {
              const copyId = isModal ? `modal-char-${charName}` : `char-${charName}`;
              const isCopied = copiedIndex === copyId;
              return (
                <div
                  key={charName}
                  id={`${isModal ? 'modal-' : ''}character-card-${charName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                  className="bg-[#171715] border border-white/5 p-3.5 sm:p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="inline-block w-1.5 h-1.5 bg-white" />
                      <span className="font-display text-sm sm:text-base font-medium text-white tracking-tight">
                        {charName}
                      </span>
                    </div>

                    <button
                      type="button"
                      id={`${isModal ? 'modal-' : ''}copy-character-btn-${charName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                      onClick={() => onCopy(desc, copyId)}
                      className="inline-flex items-center font-editorial-meta text-[9px] sm:text-[10px] px-2 sm:px-2.5 py-1 text-[#D4D4D0] hover:text-white bg-[#222220] hover:bg-[#2d2d29] border border-white/15 transition-colors whitespace-nowrap min-h-[28px]"
                    >
                      {isCopied ? (
                        <>
                          <Check size={11} className="mr-1 text-white sm:w-3 sm:h-3" />
                          <span>COPIED</span>
                        </>
                      ) : (
                        <>
                          <Copy size={11} className="mr-1 text-[#9C9C96] sm:w-3 sm:h-3" />
                          <span>COPY</span>
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
          className="bg-[#111110] border border-white/10 p-4 sm:p-6 md:p-7 space-y-4 corner-bracket-container shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-3 sm:pb-4">
            <div className="flex items-center space-x-2.5">
              <MapPin size={16} className="text-white shrink-0" />
              <h3 className="font-editorial-meta text-xs sm:text-sm font-semibold text-white">
                LOCATION CONTINUITY SHEET
              </h3>
            </div>
            <span className="stamp-chip text-[9px]">
              {locationEntries.length} {locationEntries.length === 1 ? 'LOCATION' : 'LOCATIONS'}
            </span>
          </div>

          <p className="text-xs text-[#9C9C96] leading-relaxed font-narrative">
            Fixed visual descriptions for recurring locations, reused across visual beat prompts to guarantee environmental continuity.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:gap-4 pt-1">
            {locationEntries.map(([locationName, desc]) => {
              const copyId = isModal ? `modal-loc-${locationName}` : `loc-${locationName}`;
              const isCopied = copiedIndex === copyId;
              return (
                <div
                  key={locationName}
                  id={`${isModal ? 'modal-' : ''}location-card-${locationName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                  className="bg-[#171715] border border-white/5 p-3.5 sm:p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="inline-block w-1.5 h-1.5 bg-white" />
                      <span className="font-display text-sm sm:text-base font-medium text-white tracking-tight">
                        {locationName}
                      </span>
                    </div>

                    <button
                      type="button"
                      id={`${isModal ? 'modal-' : ''}copy-location-btn-${locationName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                      onClick={() => onCopy(desc, copyId)}
                      className="inline-flex items-center font-editorial-meta text-[9px] sm:text-[10px] px-2 sm:px-2.5 py-1 text-[#D4D4D0] hover:text-white bg-[#222220] hover:bg-[#2d2d29] border border-white/15 transition-colors whitespace-nowrap min-h-[28px]"
                    >
                      {isCopied ? (
                        <>
                          <Check size={11} className="mr-1 text-white sm:w-3 sm:h-3" />
                          <span>COPIED</span>
                        </>
                      ) : (
                        <>
                          <Copy size={11} className="mr-1 text-[#9C9C96] sm:w-3 sm:h-3" />
                          <span>COPY</span>
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
