import { Beat, Scene, StyleProfile, StoryFormat, GenerationMode, ThumbnailData } from '../types';
import { extractGeographicAnchor } from './beatSplitting';

export type TargetModel = 'universal' | 'midjourney' | 'kling' | 'runway' | 'luma';

export interface CompiledPrompt {
  targetModel: TargetModel;
  promptText: string;
  negativePrompt?: string;
  parameters?: Record<string, string>;
  budgetWordCount: number;
  wordCount: number;
}

export interface LintIssue {
  id: string;
  severity: 'warning' | 'info';
  message: string;
  suggestion?: string;
  sceneIndex: number;
  beatIndex?: number;
}

/**
 * Normalizes camera movement into standard cinematic terms
 */
export function normalizeCameraMovement(movement?: string): string {
  if (!movement || movement.trim() === '') return 'Static shot';
  const lower = movement.toLowerCase();
  if (lower.includes('dolly in') || lower.includes('push in')) return 'Slow dolly in';
  if (lower.includes('dolly out') || lower.includes('pull out')) return 'Slow dolly out';
  if (lower.includes('pan left')) return 'Smooth pan left';
  if (lower.includes('pan right')) return 'Smooth pan right';
  if (lower.includes('tilt up')) return 'Subtle tilt up';
  if (lower.includes('tilt down')) return 'Subtle tilt down';
  if (lower.includes('tracking') || lower.includes('truck')) return 'Lateral tracking shot';
  if (lower.includes('crane') || lower.includes('pedestal')) return 'Vertical crane movement';
  if (lower.includes('orbital') || lower.includes('orbit')) return '360 degree orbital arc';
  if (lower.includes('static')) return 'Static lock-off shot';
  return movement.trim();
}

/**
 * Sanitizes kinetic process verbs into frozen-state descriptions for still images
 */
export function sanitizeKineticMotionForImage(prompt: string): string {
  let cleaned = prompt;

  // Replace process verbs with frozen static states
  cleaned = cleaned.replace(/\b(?:clouds?\s+)?swirls?\s+above\b/gi, 'dense curved storm-cloud formations hang frozen above');
  cleaned = cleaned.replace(/\bswirling\b/gi, 'frozen in curved spiral patterns');
  cleaned = cleaned.replace(/\bflickers?\b/gi, 'captured in a single frozen lightning strike');
  cleaned = cleaned.replace(/\bflickering\b/gi, 'captured in a single frozen illumination');
  cleaned = cleaned.replace(/\bchurns?\b/gi, 'has crisp frozen ripples');
  cleaned = cleaned.replace(/\bchurning\b/gi, 'crisp frozen ripples');
  cleaned = cleaned.replace(/\bstreaming\s+in\s+a\s+thin\s+ribbon\b/gi, 'suspended in a thin frozen ribbon');
  cleaned = cleaned.replace(/\bstreaming\b/gi, 'suspended mid-pour');
  cleaned = cleaned.replace(/\bpouring\b/gi, 'suspended mid-pour');
  cleaned = cleaned.replace(/\bhovering\b/gi, 'hanging motionless');
  cleaned = cleaned.replace(/\bfluid\s+motion\b/gi, 'hand-drawn line work');
  cleaned = cleaned.replace(/\bliquid\s+motion\b/gi, 'frozen liquid details');
  cleaned = cleaned.replace(/\bmoving\b/gi, 'static');

  return cleaned;
}

/**
 * Resolves style and casting compatibility:
 * If prompt indicates no characters or an empty environment/cartography, strip character-specific clauses from the style.
 */
export function resolveStyleAndCastingCompatibility(prompt: string, artStyle: string): { prompt: string; artStyle: string } {
  const lowerPrompt = prompt.toLowerCase();
  const hasNoCharacters =
    lowerPrompt.includes('no characters') ||
    lowerPrompt.includes('empty scene') ||
    lowerPrompt.includes('focus on harbor setting') ||
    lowerPrompt.includes('focus on liquid') ||
    lowerPrompt.includes('focus on terrifying atmosphere') ||
    lowerPrompt.includes('no people') ||
    lowerPrompt.includes('no figures') ||
    lowerPrompt.includes('globe') ||
    lowerPrompt.includes('cartograph') ||
    lowerPrompt.includes('topographic') ||
    lowerPrompt.includes('border line') ||
    lowerPrompt.includes('location pin');

  let sanitizedArtStyle = artStyle;
  let sanitizedPrompt = prompt;

  if (hasNoCharacters) {
    sanitizedArtStyle = sanitizedArtStyle
      .replace(/\s*with\s+exaggerated\s+stretchy\s+animal\s+characters/gi, '')
      .replace(/\s*with\s+stretchy\s+animal\s+characters/gi, '')
      .replace(/\s*with\s+anthropomorphic\s+characters/gi, '')
      .replace(/\s*with\s+characters/gi, '')
      .trim();

    sanitizedPrompt = sanitizedPrompt
      .replace(/\s*with\s+exaggerated\s+stretchy\s+animal\s+characters/gi, '')
      .replace(/\s*with\s+stretchy\s+animal\s+characters/gi, '')
      .replace(/\s*with\s+anthropomorphic\s+characters/gi, '')
      .trim();
  }

  return { prompt: sanitizedPrompt, artStyle: sanitizedArtStyle };
}

/**
 * Compiles a visual beat into a unified production-grade prompt.
 * Synthesizes orientation, framing, subject action, environment, lighting, optics, and aspect ratio flags.
 */
export function compileBeatPrompt(
  beat: Beat,
  scene: Scene,
  styleProfile: StyleProfile | undefined,
  targetModel?: TargetModel,
  format: StoryFormat = 'short',
  generationMode: GenerationMode = 'video'
): CompiledPrompt {
  const rawBasePrompt = (beat.imagePrompt || '').trim();
  const isImageMode = generationMode === 'image';
  const isWidescreen = format === 'long';
  const aspectRatio: '16:9' | '9:16' = isWidescreen ? '16:9' : '9:16';
  const arFlag = `--ar ${aspectRatio}`;
  const orientationText = isWidescreen
    ? 'Cinematic 16:9 widescreen composition'
    : 'Vertical 9:16 portrait composition';

  // 1. Resolve Style vs Casting Compatibility
  const rawArtStyle = styleProfile?.artStyle || 'Cinematic photorealism';
  const { prompt: promptWithoutStyleConflict, artStyle } = resolveStyleAndCastingCompatibility(rawBasePrompt, rawArtStyle);

  // 2. Sanitize kinetic process verbs for image mode
  let baseImagePrompt = isImageMode
    ? sanitizeKineticMotionForImage(promptWithoutStyleConflict)
    : promptWithoutStyleConflict;

  const shotType = beat.shotType || 'Medium shot';
  const cameraAngle = beat.cameraAngle || 'Eye-level';
  const cameraMovement = normalizeCameraMovement(beat.cameraMovement);
  const optics = beat.optics || '35mm anamorphic lens, f/2.8 aperture';
  const lighting = styleProfile?.lighting || 'natural cinematic lighting, 5600K balanced daylight';

  const parameters: Record<string, string> = {
    ar: aspectRatio,
    style: 'raw',
    v: '6.1',
  };

  let compiledText = '';
  let negativePrompt: string | undefined = undefined;

  // Build the unified, non-frugal prompt
  const components: string[] = [];

  // A. Orientation & Mode Declaration
  if (isImageMode) {
    components.push(`STATIC STILL FRAME ONLY: ${orientationText}. One exact frozen moment in time, crisp edges, zero camera movement, no motion blur, no video.`);
    negativePrompt = 'motion blur, animation, video, moving camera, timelapse, multiple frames, distorted limbs, extra fingers, text, watermark, low quality, artifacting';
  } else {
    const motionDirective = cameraMovement !== 'Static shot' && cameraMovement !== 'Static lock-off shot'
      ? `Continuous camera motion: ${cameraMovement} at smooth controlled velocity.`
      : `Static lock-off shot with steady camera positioning.`;
    components.push(`CONTINUOUS CINEMATIC VIDEO SHOT: ${orientationText}. ${motionDirective}`);
    negativePrompt = 'sudden cuts, frame jitter, morphing, deformed hands, extra limbs, blur, low resolution, watermark, text overlays, warped faces';
  }

  // B. Framing & Angle
  components.push(`${shotType}, ${cameraAngle}.`);

  // C. Core Visual Subject & Scene Action
  components.push(baseImagePrompt);

  // D. Atmospheric Lighting (if not already deeply described in base prompt)
  if (!baseImagePrompt.toLowerCase().includes('lighting:') && !baseImagePrompt.toLowerCase().includes('kelvin') && !baseImagePrompt.toLowerCase().includes('key light')) {
    components.push(`Atmospheric Lighting: ${lighting}.`);
  }

  // E. Optics & Lens Prescriptions (if not already embedded)
  if (!baseImagePrompt.toLowerCase().includes('shot on') && !baseImagePrompt.toLowerCase().includes('lens') && !baseImagePrompt.toLowerCase().includes('mm f/')) {
    components.push(`Optics: Shot on ${optics}, shallow depth of field, sharp foreground focus.`);
  }

  // F. Visual Style & Palette Continuity (if not already embedded)
  if (!baseImagePrompt.toLowerCase().includes('visual style:') && !baseImagePrompt.toLowerCase().includes(artStyle.toLowerCase().slice(0, 15))) {
    components.push(`Visual Style: ${artStyle}.`);
  }

  // G. Aspect ratio parameter flag (always guaranteed at prompt end)
  if (!baseImagePrompt.includes('--ar')) {
    components.push(`${arFlag} --style raw --v 6.1`);
  }

  compiledText = components.join(' ').replace(/\s+/g, ' ').trim();
  const wordCount = compiledText.split(/\s+/).filter(Boolean).length;
  const budgetWordCount = 110;

  return {
    targetModel: 'universal',
    promptText: compiledText,
    negativePrompt,
    parameters,
    budgetWordCount,
    wordCount,
  };
}

/**
 * Deterministic Storyboard Linter (Rules L01 - L06)
 * Scans beats and scenes for common AI generation pitfalls
 */
export function lintStoryboard(
  scenes: Scene[],
  characterSheet?: Record<string, string>
): LintIssue[] {
  const issues: LintIssue[] = [];
  const knownCharacters = Object.keys(characterSheet || {}).map((c) => c.toLowerCase());

  scenes.forEach((scene) => {
    const sceneIndex = scene.index;
    const narratorWords = (scene.narratorLine || '').split(/\s+/).filter(Boolean).length;
    const sceneDuration = scene.estimatedSeconds || 5;

    // Rule L02: Scene Pacing Check (standard spoken rate is ~2.3 words/second or 140 WPM)
    const requiredSpokenSeconds = Math.round((narratorWords / 2.3) * 10) / 10;
    if (requiredSpokenSeconds > sceneDuration + 1.5 && narratorWords > 12) {
      issues.push({
        id: `L02-scene-${sceneIndex}`,
        severity: 'warning',
        message: `Scene ${sceneIndex} pacing: Narration (${narratorWords} words) requires ~${requiredSpokenSeconds}s, but scene is allocated ${sceneDuration}s.`,
        suggestion: `Consider extending scene duration to ${Math.ceil(requiredSpokenSeconds)}s or tightening narration.`,
        sceneIndex,
      });
    }

    (scene.beats || []).forEach((beat) => {
      const beatIndex = beat.beatIndex;
      const move = (beat.cameraMovement || '').toLowerCase();
      const prompt = (beat.imagePrompt || '').toLowerCase();

      // Rule L01: Multiple conflicting camera movements in single beat
      const hasDollyIn = move.includes('dolly in') || move.includes('push in') || prompt.includes('dolly in');
      const hasDollyOut = move.includes('dolly out') || move.includes('pull back') || prompt.includes('dolly out');
      const hasPanLeft = move.includes('pan left') || prompt.includes('pan left');
      const hasPanRight = move.includes('pan right') || prompt.includes('pan right');

      if ((hasDollyIn && hasDollyOut) || (hasPanLeft && hasPanRight)) {
        issues.push({
          id: `L01-scene-${sceneIndex}-beat-${beatIndex}`,
          severity: 'warning',
          message: `Beat ${beatIndex}: Conflicting camera movements detected in a single shot (${beat.cameraMovement}).`,
          suggestion: 'Choose one dominant camera vector (e.g., either push in or pull back, not both).',
          sceneIndex,
          beatIndex,
        });
      }

      // Rule L04: Prompt length budget
      const wordCount = (beat.imagePrompt || '').split(/\s+/).filter(Boolean).length;
      if (wordCount > 130) {
        issues.push({
          id: `L04-scene-${sceneIndex}-beat-${beatIndex}`,
          severity: 'info',
          message: `Beat ${beatIndex}: Prompt length (${wordCount} words) is unusually high.`,
          suggestion: 'High-density visual prompts perform best between 75-110 words.',
          sceneIndex,
          beatIndex,
        });
      }

      // Rule L05: Missing lighting context
      if (!prompt.includes('light') && !prompt.includes('sun') && !prompt.includes('shadow') && !prompt.includes('glow')) {
        issues.push({
          id: `L05-scene-${sceneIndex}-beat-${beatIndex}`,
          severity: 'info',
          message: `Beat ${beatIndex}: Lighting direction is unspecified.`,
          suggestion: 'Add lighting guidance (e.g. key light 5600K, rim light, golden hour) to prevent flat renders.',
          sceneIndex,
          beatIndex,
        });
      }

      // Rule L07: Style vs Casting Contradiction
      if (prompt.includes('no characters') && (prompt.includes('animal characters') || prompt.includes('stretchy animal'))) {
        issues.push({
          id: `L07-scene-${sceneIndex}-beat-${beatIndex}`,
          severity: 'warning',
          message: `Beat ${beatIndex}: Contradictory casting directives detected ('no characters' paired with character-based style).`,
          suggestion: 'Use resolveStyleAndCastingCompatibility to ensure empty scenes do not inject animal or mascot rules.',
          sceneIndex,
          beatIndex,
        });
      }

      // Rule L08: Premature Information Leakage
      const spokenText = (beat.textSpan || '').toLowerCase();
      if ((spokenText.includes('pour tea') || spokenText.includes('if you pour')) && !spokenText.includes('harbor') && prompt.includes('harbor')) {
        issues.push({
          id: `L08-scene-${sceneIndex}-beat-${beatIndex}`,
          severity: 'warning',
          message: `Beat ${beatIndex}: Potential premature reveal. Destination ('harbor') is depicted before narration spoken phrase reaches it.`,
          suggestion: 'Withhold the destination until the reveal beat to protect dramatic narrative suspense.',
          sceneIndex,
          beatIndex,
        });
      }

      // Rule L09: Geographic Cartographic Focus Check
      const geoAnchor = extractGeographicAnchor(beat.textSpan || '');
      const wordCountSpan = (beat.textSpan || '').split(/\s+/).filter(Boolean).length;
      if (geoAnchor && wordCountSpan <= 3) {
        const hasMapOrGlobe =
          prompt.includes('globe') ||
          prompt.includes('map') ||
          prompt.includes('cartograph') ||
          prompt.includes('border') ||
          prompt.includes('pin') ||
          prompt.includes('flag');
        if (!hasMapOrGlobe) {
          issues.push({
            id: `L09-scene-${sceneIndex}-beat-${beatIndex}`,
            severity: 'info',
            message: `Beat ${beatIndex}: Spoken geographic entity ('${geoAnchor.entityName}') lacks cartographic environment focus (globe, map, border, or flag).`,
            suggestion: 'Anchor country and nationality beats with tactile maps, border highlights, pins, or national flags.',
            sceneIndex,
            beatIndex,
          });
        }
      }
    });
  });

  return issues;
}

/**
 * Adapts typography and font treatment to the narrative genre, tone, and character style
 */
export function inferStoryAdaptiveFont(styleText = '', narrativeText = ''): string {
  const combined = `${styleText} ${narrativeText}`.toLowerCase();

  if (
    combined.includes('zombie') ||
    combined.includes('horror') ||
    combined.includes('apocalypse') ||
    combined.includes('survival') ||
    combined.includes('decay') ||
    combined.includes('infection')
  ) {
    return 'distressed weathered stencil sans-serif with textured rugged edges';
  }
  if (
    combined.includes('cyberpunk') ||
    combined.includes('sci-fi') ||
    combined.includes('neon') ||
    combined.includes('future') ||
    combined.includes('space') ||
    combined.includes('robot')
  ) {
    return 'sleek futuristic geometric sans-serif with subtle luminous neon edging';
  }
  if (
    combined.includes('medieval') ||
    combined.includes('dark fantasy') ||
    combined.includes('gothic') ||
    combined.includes('ancient') ||
    combined.includes('castle') ||
    combined.includes('sword')
  ) {
    return 'chiseled archaic roman serif with carved stone texture and sharp serifs';
  }
  if (
    combined.includes('rubber hose') ||
    combined.includes('claymation') ||
    combined.includes('cartoon') ||
    combined.includes('1930') ||
    combined.includes('playful')
  ) {
    return 'playful hand-lettered bold cartoon bubble serif with vintage curved letterforms';
  }
  if (
    combined.includes('documentary') ||
    combined.includes('historical') ||
    combined.includes('archival') ||
    combined.includes('investigative') ||
    combined.includes('19th') ||
    combined.includes('18th') ||
    combined.includes('century') ||
    /\b1[89]\d\d\b/.test(combined)
  ) {
    return 'bold editorial headline serif with classic broadsheet typography';
  }
  if (combined.includes('anime') || combined.includes('manga') || combined.includes('ink')) {
    return 'ultra-heavy condensed industrial grotesque with high-impact angular cuts';
  }
  if (
    combined.includes('noir') ||
    combined.includes('detective') ||
    combined.includes('crime') ||
    combined.includes('mystery')
  ) {
    return 'dossier stamp sans-serif with dramatic cast-shadow letterforms';
  }

  // Default clean high-CTR display typography
  return 'ultra-bold condensed heavy sans-serif with clean sharp outlines';
}

/**
 * Compiles a production-grade, safe-zone compliant thumbnail prompt and clean plate prompt
 */
export function compileThumbnailPrompt(params: {
  rawThumbnail?: Partial<ThumbnailData>;
  styleProfile: StyleProfile;
  characterSheet?: Record<string, string>;
  storyPremise?: string;
  format?: StoryFormat;
  platform?: string;
}): ThumbnailData {
  const isWidescreen =
    params.format === 'long' ||
    (params.platform &&
      params.platform.toLowerCase().includes('youtube') &&
      !params.platform.toLowerCase().includes('shorts'));
  const aspectRatio: '16:9' | '9:16' = isWidescreen ? '16:9' : '9:16';
  const targetPlatform = isWidescreen ? 'YouTube Widescreen' : 'TikTok / Shorts / Reels';

  const raw = params.rawThumbnail || {};
  const heroMoment = (
    raw.heroMoment || 'The climactic turning point and central conflict of the story'
  ).trim();
  const expression = (
    raw.expression || 'intense, emotionally charged, and readable at thumbnail scale'
  ).trim();
  const bgDescription = (
    raw.bgDescription || 'deep atmospheric background with strong contrast and dramatic depth separation'
  ).trim();
  const accentColor = (
    raw.accentColor || (isWidescreen ? 'vibrant electric amber' : 'cold crimson')
  ).trim();

  // Clean hook text: uppercase, max 4 words, no stray punctuation
  let cleanHook = (raw.hookText || 'SURVIVE').replace(/["'’]/g, '').trim().toUpperCase();
  const hookWords = cleanHook.split(/\s+/).filter(Boolean);
  if (hookWords.length > 4) {
    cleanHook = hookWords.slice(0, 4).join(' ');
  }
  if (!cleanHook) cleanHook = 'SURVIVE';

  const storyAdaptiveFont =
    raw.fontStyle && raw.fontStyle.trim().length > 0
      ? raw.fontStyle.trim()
      : inferStoryAdaptiveFont(params.styleProfile?.artStyle, params.storyPremise);

  // Primary character extraction for identity lock
  const characters = Object.entries(params.characterSheet || {});
  let primaryCharClause = 'The protagonist';
  if (characters.length > 0) {
    const [name, desc] = characters[0];
    primaryCharClause = `${name} (locked visual identity: ${desc})`;
  }

  // Safe zones and layout
  const subjectPlacement = isWidescreen
    ? 'subject positioned in the left third, filling roughly 50% of the frame'
    : 'subject centered in the upper-middle vertical band, filling roughly 55% of the frame';

  const textPlacement = isWidescreen
    ? 'in the upper-right third of the frame'
    : 'in the center-upper safe zone, above the hero shoulders';

  const safeZoneGuidance = isWidescreen
    ? 'Platform safe zone: strictly keep the bottom-right corner clear of text and faces for the YouTube timestamp duration badge; keep lower 10% clear for the scrub bar.'
    : 'Platform safe zone: keep the top 12% clear for header/profile icons, bottom 25% clear for captions/music titles, and right edge clear for like/comment buttons.';

  // Full compiled prompt with typography
  const compiledPrompt = [
    `STATIC THUMBNAIL IMAGE ONLY. Single high-impact cover frame. No animation, video, camera movement, or motion blur.`,
    `Framed in ${aspectRatio} aspect ratio for a high-CTR ${targetPlatform} cover.`,
    `Style continuity: ${params.styleProfile?.artStyle || 'Cinematic realistic'}, ${params.styleProfile?.colorPalette || 'high-contrast dramatic lighting'}.`,
    `Hero Subject: ${primaryCharClause}, expression ${expression}. ${subjectPlacement}.`,
    `Visual Conflict: Climactic turning point: ${heroMoment}. Deep shadows, intense ${accentColor} rim lighting from behind separating the subject from a dark simplified background: ${bgDescription}.`,
    `${safeZoneGuidance}`,
    `Typography & Text Overlay: Graphic headline text "${cleanHook}" rendered in ${storyAdaptiveFont}, in bold uppercase with a thick dark outline and high-contrast fill, positioned ${textPlacement}. Text appears exactly once, perfectly spelled, perfectly legible at small mobile thumbnail scale. No other lettering, subtitles, dialogue, or watermarks.`,
    `--ar ${aspectRatio} --style raw --s 150 --v 6.1`,
  ].join(' ');

  // Clean plate prompt without typography (for Canva / Photoshop editors)
  const cleanPlatePrompt = [
    `STATIC THUMBNAIL IMAGE ONLY. Single high-impact background plate. No animation, video, camera movement, or motion blur.`,
    `Framed in ${aspectRatio} aspect ratio for a ${targetPlatform} cover.`,
    `Style continuity: ${params.styleProfile?.artStyle || 'Cinematic realistic'}, ${params.styleProfile?.colorPalette || 'high-contrast dramatic lighting'}.`,
    `Hero Subject: ${primaryCharClause}, expression ${expression}. ${subjectPlacement}.`,
    `Visual Conflict: Climactic turning point: ${heroMoment}. Deep shadows, intense ${accentColor} rim lighting from behind separating the subject from a dark simplified background: ${bgDescription}.`,
    `${safeZoneGuidance}`,
    `Negative Space & Clean Plate: Clean negative space ${textPlacement} left completely empty without any text, lettering, words, watermarks, or logos, designed as a clean text-free background plate for custom graphic overlay.`,
    `--ar ${aspectRatio} --style raw --s 150 --v 6.1`,
  ].join(' ');

  return {
    heroMoment,
    expression,
    bgDescription,
    accentColor,
    hookText: cleanHook,
    fontStyle: storyAdaptiveFont,
    alternateHooks: raw.alternateHooks || [],
    compiledPrompt,
    cleanPlatePrompt,
    aspectRatio,
    targetPlatform,
  };
}
