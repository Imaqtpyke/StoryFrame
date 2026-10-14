import { StyleProfile } from '../types';

export interface CharacterIdentity {
  name: string;
  summary: string;
  ageBracket?: string;
  biometricFeatures?: string;
  signatureWardrobe?: string;
  lightingInteraction?: string;
}

export interface CharacterReferencePacket {
  characterName: string;
  identitySummary: string;
  frontPortraitPrompt: string;
  threeQuarterPrompt: string;
  fullBodyActionPrompt: string;
  midjourneyCrefAdvice: string;
  videoModelAnchorTags: string[];
}

/**
 * Parses character description text into structured attributes
 */
export function parseCharacterIdentity(name: string, description: string): CharacterIdentity {
  const desc = description.trim();
  
  return {
    name,
    summary: desc,
    ageBracket: desc.match(/\b(\d{1,2}|early|mid|late\s+\d{0,2}s?)\s*(?:years? old|yo|-year-old)?\b/i)?.[0] || 'adult',
    biometricFeatures: desc,
    signatureWardrobe: desc.match(/(?:wearing|in|dressed in|outfit:?)\s*([^,.]+)/i)?.[1]?.trim(),
    lightingInteraction: 'key light highlights bone structure, natural skin pore texture, balanced eye catchlights',
  };
}

/**
 * Generates an immutable multi-angle character reference packet
 * suitable for generating reference sheets in Midjourney, Flux, Kling, or Runway.
 */
export function generateCharacterReferencePacket(
  characterName: string,
  rawDescription: string,
  styleProfile?: StyleProfile,
  format: 'short' | 'long' = 'short'
): CharacterReferencePacket {
  const arFlag = format === 'long' ? '--ar 16:9' : '--ar 9:16';
  const artStyle = styleProfile?.artStyle || 'Cinematic photorealism';
  const lighting = styleProfile?.lighting || 'clean studio softbox lighting, 5600K';
  const cleanDesc = rawDescription.replace(/\s+/g, ' ').trim();

  // Three canonical reference angles
  const frontPortraitPrompt = `Front-facing headshot portrait of ${cleanDesc}. Neutral expression, looking directly into camera, eye-level lens, sharp focus on facial bone structure and eyes, ${lighting}, ${artStyle} ${arFlag} --v 6.1 --stylize 120`;

  const threeQuarterPrompt = `Three-quarter angle medium close-up of ${cleanDesc}. Gentle profile turn, natural posture, showing hair volume and shoulder wardrobe details, ${lighting}, 85mm portrait lens, f/2.0 aperture, ${artStyle} ${arFlag} --v 6.1 --stylize 120`;

  const fullBodyActionPrompt = `Full-body dynamic standing shot of ${cleanDesc}. Visible footwear and signature garments, grounded weight distribution, natural contrapposto stance, environment background blurred, ${lighting}, 50mm lens, ${artStyle} ${arFlag} --v 6.1 --stylize 120`;

  const midjourneyCrefAdvice = `Generate the Front Portrait first until you love the face. Then copy that image URL and use it with '--cref <IMAGE_URL> --cw 80' across all subsequent shots to lock character likeness.`;

  // Key distinctive anchor words to repeat across all video model prompts
  const words = cleanDesc.split(/[,.\s]+/).filter((w) => w.length > 3);
  const videoModelAnchorTags = Array.from(new Set(words)).slice(0, 8);

  return {
    characterName,
    identitySummary: cleanDesc,
    frontPortraitPrompt,
    threeQuarterPrompt,
    fullBodyActionPrompt,
    midjourneyCrefAdvice,
    videoModelAnchorTags,
  };
}
