import { Beat, Scene, StyleProfile, StoryFormat, GenerationMode, ThumbnailData, CtaPlatform, CtaModality, CtaEngagementType, CtaPromptData } from '../types';
import { extractGeographicAnchor } from './beatSplitting';
import {
  buildCompactCharacterAnchor,
  buildSharedContextIgnoreTokens,
  CHARACTER_ANCHOR_MAX_WORDS,
  computeVisualPromptSimilarity,
  expandEntityKeysInPrompt,
  hasDistinctMontageFocalSubject,
  isMonochromeStyle,
  normalizeUnicodeAndDashes,
  sanitizeMonochromeLighting,
  sanitizeSharedVisualStyle,
  sanitizeStyleForEra,
  stripLeadingOrientationPrefixes,
  stripTransientExpressionsAndPoses,
} from './beatProgressionEngine';

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
  cleaned = cleaned.replace(/\bswirling\s+vortex\s+of\b/gi, 'radiant spiral pattern of');
  cleaned = cleaned.replace(/\b(?:clouds?\s+)?swirls?\s+above\b/gi, 'dense curved storm-cloud formations hang frozen above');
  cleaned = cleaned.replace(/\bswirling\b/gi, 'frozen in curved spiral patterns');
  cleaned = cleaned.replace(/\bflickers?\b/gi, 'captured in a single frozen lightning strike');
  cleaned = cleaned.replace(/\bflickering\b/gi, 'captured in a single frozen illumination');
  cleaned = cleaned.replace(/\bchurns?\b/gi, 'has crisp frozen ripples');
  cleaned = cleaned.replace(/\bchurning\b/gi, 'crisp frozen ripples');
  cleaned = cleaned.replace(/\bstreaming\s+in\s+a\s+thin\s+ribbon\b/gi, 'suspended in a thin frozen ribbon');
  cleaned = cleaned.replace(/\bstreaming\b/gi, 'suspended mid-pour');
  cleaned = cleaned.replace(/\bpouring\b/gi, 'suspended mid-pour');
  cleaned = cleaned.replace(/\b(particles|embers|sparks|steam|mist|dust|smoke)\s+rising\b/gi, '$1 suspended mid-air');
  cleaned = cleaned.replace(/\bhovering\b/gi, 'hanging motionless');
  cleaned = cleaned.replace(/\bfluttering\s+in\s+(?:the\s+)?breeze\b/gi, 'frozen mid-billow');
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

  // 1. Resolve Style vs Casting Compatibility & strip hero pronoun wardrobe leaks from shared artStyle
  const rawArtStyle = sanitizeSharedVisualStyle(styleProfile?.artStyle || 'Cinematic photorealism') || 'Cinematic photorealism';
  const { prompt: promptWithoutStyleConflict, artStyle } = resolveStyleAndCastingCompatibility(rawBasePrompt, rawArtStyle);

  // 2. Sanitize kinetic process verbs for image mode and strip duplicate orientation prefix
  const sanitizedKinetic = isImageMode
    ? sanitizeKineticMotionForImage(promptWithoutStyleConflict)
    : promptWithoutStyleConflict;
  const baseImagePrompt = normalizeUnicodeAndDashes(stripLeadingOrientationPrefixes(sanitizedKinetic));

  const shotType = beat.shotType || 'Medium Shot';
  const cameraAngle = beat.cameraAngle || 'Eye-level';
  const cameraMovement = normalizeCameraMovement(beat.cameraMovement);
  const optics = beat.optics || '35mm anamorphic lens, f/2.8 aperture';
  const rawLighting = styleProfile?.lighting || 'natural cinematic lighting, 5600K balanced daylight';
  const lighting = isMonochromeStyle(styleProfile)
    ? sanitizeMonochromeLighting(rawLighting, styleProfile) || 'stark high-contrast chiaroscuro ink lighting with crisp cast shadows'
    : rawLighting;

  const parameters: Record<string, string> = {
    ar: aspectRatio,
  };

  let compiledText = '';
  let negativePrompt: string | undefined = undefined;

  // Build the unified, non-frugal prompt
  const components: string[] = [];

  // A. Orientation & Mode Declaration
  if (isImageMode) {
    components.push(`Generate a single still image of: ${orientationText}. Static frame. One exact moment in time. Crisp edges, zero camera movement, no motion blur, no video.`);
    negativePrompt = 'motion blur, animation, video, moving camera, timelapse, multiple frames, distorted limbs, extra fingers, text, watermark, low quality, artifacting';
  } else {
    const motionDirective = cameraMovement !== 'Static shot' && cameraMovement !== 'Static lock-off shot'
      ? `Continuous camera motion: ${cameraMovement} at smooth controlled velocity.`
      : `Static lock-off shot with steady camera positioning.`;
    components.push(`Generate a continuous video clip of: ${orientationText}. ${motionDirective}`);
    negativePrompt = 'sudden cuts, frame jitter, morphing, deformed hands, extra limbs, blur, low resolution, watermark, text overlays, warped faces';
  }

  // B. Framing & Angle (only add if baseImagePrompt doesn't already open with the exact shotType)
  const lowerBase = baseImagePrompt.toLowerCase();
  const alreadyOpensWithFraming = lowerBase.startsWith(shotType.toLowerCase());
  if (!alreadyOpensWithFraming) {
    components.push(`${shotType}, ${cameraAngle}.`);
  }

  // C. Core Visual Subject & Scene Action
  components.push(baseImagePrompt);

  // D. Atmospheric Lighting (if not already deeply described in base prompt)
  if (!lowerBase.includes('lighting:') && !lowerBase.includes('kelvin') && !lowerBase.includes('key light')) {
    components.push(`Atmospheric Lighting: ${lighting}.`);
  }

  // E. Optics & Lens Prescriptions (if not already embedded)
  if (!lowerBase.includes('shot on') && !lowerBase.includes('lens') && !lowerBase.includes('mm f/')) {
    components.push(`Optics: Shot on ${optics}, shallow depth of field, sharp foreground focus.`);
  }

  // F. Visual Style & Palette Continuity (if not already embedded)
  if (!lowerBase.includes('visual style:') && !lowerBase.includes(artStyle.toLowerCase().slice(0, 15))) {
    components.push(`Visual Style: ${artStyle}.`);
  }

  // G. Aspect ratio parameter flag (always guaranteed once at prompt end)
  if (!baseImagePrompt.includes('--ar')) {
    components.push(`${arFlag}`);
  }

  compiledText = normalizeUnicodeAndDashes(components.join(' '));
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
  characterSheet?: Record<string, string>,
  styleProfile?: StyleProfile
): LintIssue[] {
  const issues: LintIssue[] = [];
  const knownCharacters = Object.keys(characterSheet || {}).map((c) => c.toLowerCase());
  const isMono = isMonochromeStyle(styleProfile);

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

      // Rule L12: Shot Metadata vs Prompt Opening & Camera Angle Taxonomy Alignment Check
      const declaredShot = (beat.shotType || '').toLowerCase();
      const declaredAngle = (beat.cameraAngle || '').toLowerCase();
      const openingSnippet = stripLeadingOrientationPrefixes(beat.imagePrompt || '').slice(0, 80).toLowerCase();
      if (
        ((declaredShot.includes('close-up') || declaredShot.includes('macro')) &&
          /\b(?:extreme[-\s]*wide|birds[-\s]*eye\s+wide|wide\s+establishing)\b/i.test(openingSnippet)) ||
        (/\bclose-up\b/.test(declaredShot) &&
          !declaredShot.includes('medium') &&
          !declaredShot.includes('extreme') &&
          /\bmedium\s+close[-\s]*up\b/i.test(openingSnippet)) ||
        /\b(?:over[-\s]*the[-\s]*shoulder|ots|pov|point[-\s]*of[-\s]*view|close[-\s]*up|medium\s+shot|wide\s+shot)\b/i.test(declaredAngle)
      ) {
        issues.push({
          id: `L12-scene-${sceneIndex}-beat-${beatIndex}`,
          severity: 'warning',
          message: `Beat ${beatIndex}: Shot metadata (${beat.shotType}, ${beat.cameraAngle}) conflicts with framing/angle taxonomy in visual prompt prose.`,
          suggestion: 'Keep framing (e.g. OTS, Medium Close-Up) in shotType and vertical/tilt angles (eye-level, low-angle, high-angle) in cameraAngle.',
          sceneIndex,
          beatIndex,
        });
      }

      // Rule L13: Monochrome Bleed, Raw Variable Key, or Spoken-Text Fallback Leakage Check
      const rawPromptText = beat.imagePrompt || '';
      const hasMonoBleed =
        isMono &&
        /\b(?:\d{4}K\s+(?:warm|cool|cold)|cold\s+cyan|warm\s+tungsten|golden\s+amber)\b/i.test(rawPromptText);
      const hasFallbackLeak =
        /\b(?:turning point of|escalating stakes of)\b/i.test(rawPromptText) ||
        /\bDarkRoom\b|\bProtagonist\b/.test(rawPromptText);
      if (hasMonoBleed || hasFallbackLeak) {
        issues.push({
          id: `L13-scene-${sceneIndex}-beat-${beatIndex}`,
          severity: 'warning',
          message: hasMonoBleed
            ? `Beat ${beatIndex}: Chromatic lighting terms (Kelvin/cyan/warm) detected inside a monochrome style storyboard.`
            : `Beat ${beatIndex}: Unexpanded sheet key or fallback prose leak detected in prompt.`,
          suggestion: 'Run prompt hygiene normalization and monochrome lighting sanitization.',
          sceneIndex,
          beatIndex,
        });
      }
    });

    // Rule L10: Intra-Scene Near-Duplicate Beat Detection
    const sceneBeats = scene.beats || [];
    const ignoredLintTokens = buildSharedContextIgnoreTokens(styleProfile, undefined, characterSheet);
    for (let i = 0; i < sceneBeats.length; i++) {
      for (let j = i + 1; j < sceneBeats.length; j++) {
        const sim = computeVisualPromptSimilarity(
          sceneBeats[i].imagePrompt || '',
          sceneBeats[j].imagePrompt || '',
          ignoredLintTokens
        );
        const threshold = hasDistinctMontageFocalSubject(sceneBeats[i], sceneBeats[j]) ? 0.68 : 0.52;
        if (sim >= threshold) {
          issues.push({
            id: `L10-scene-${sceneIndex}-beat-${sceneBeats[j].beatIndex}`,
            severity: 'warning',
            message: `Scene ${sceneIndex} Beat ${sceneBeats[j].beatIndex}: Near-duplicate visual prompt detected (${Math.round(sim * 100)}% overlap with Beat ${sceneBeats[i].beatIndex}).`,
            suggestion: 'Give each visual beat a distinct camera perspective, physical action, or object state.',
            sceneIndex,
            beatIndex: sceneBeats[j].beatIndex,
          });
          break;
        }
      }
    }

    // Rule L11: Spoken Narration Completeness Check
    const normTokens = (str: string) =>
      str
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2);
    const narToks = normTokens(scene.narratorLine || '');
    const beatToks = new Set(normTokens(sceneBeats.map((b) => b.textSpan || '').join(' ')));
    if (narToks.length >= 6) {
      const missingCount = narToks.filter((t) => !beatToks.has(t)).length;
      if (missingCount > Math.max(2, Math.floor(narToks.length * 0.25))) {
        issues.push({
          id: `L11-scene-${sceneIndex}`,
          severity: 'warning',
          message: `Scene ${sceneIndex}: Spoken narration appears truncated (${missingCount} content words missing from beats).`,
          suggestion: 'Ensure every spoken clause in narratorLine is covered across the scene beats.',
          sceneIndex,
        });
      }
    }
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
  const hasExplicitSciFi =
    /\b(?:cyberpunk|sci-fi|scifi|neon|synthwave|hologram|android|cybernetic|spaceship|starship|outer\s+space|distant\s+future|far\s+future|future\s+world|futuristic|year\s+2\d{3}|robot)\b/i.test(
      combined
    );
  if (hasExplicitSciFi) {
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
    /\b(?:mortgage|loan\s+contract|prepayment\s+penalty|interest\s+payments|lender|finance|financial|banking|debt|credit)\b/i.test(
      combined
    )
  ) {
    return 'bold editorial headline serif with crisp high-contrast financial broadsheet weight';
  }
  if (
    combined.includes('miniature') ||
    combined.includes('diorama') ||
    combined.includes('soft-matte clay') ||
    combined.includes('sculpted clay')
  ) {
    return 'bold hand-crafted chunky display serif with clean tactile edges';
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

export function buildStoryDerivedHookFallback(storyText: string, events: string[] = []): string {
  const source = (events[events.length - 1] || storyText || '').trim();
  const stop = new Set(
    'the a an in on at to of and or is was were are that this with for from into over as by his her their its may must can'.split(
      ' '
    )
  );
  const words = source
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stop.has(w.toLowerCase()));
  const tailSlice = words.length > 5 ? words.slice(-4, -1) : words.slice(0, 3);
  const keywords = (tailSlice.length >= 2 ? tailSlice : words.slice(0, 3)).map((w) => w.toUpperCase());
  if (keywords.length >= 2) {
    return keywords.join(' ');
  }
  return 'WHAT HAPPENED NEXT';
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

  const isMono = isMonochromeStyle(params.styleProfile);
  const raw = params.rawThumbnail || {};
  const premiseSentences = (params.storyPremise || '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const derivedPremiseMoment =
    premiseSentences[premiseSentences.length - 1] ||
    premiseSentences[0] ||
    'The decisive turning point and central conflict of the story';
  const rawHeroMoment = (raw.heroMoment || derivedPremiseMoment).trim();
  const heroMoment = sanitizeMonochromeLighting(
    expandEntityKeysInPrompt(rawHeroMoment, params.characterSheet),
    params.styleProfile
  );
  const expression = (
    raw.expression || 'intense, emotionally charged, and readable at thumbnail scale'
  ).trim();
  const rawBgDescription = (
    raw.bgDescription || 'deep atmospheric background with strong contrast and dramatic depth separation'
  ).trim();
  const bgDescription = sanitizeMonochromeLighting(
    expandEntityKeysInPrompt(rawBgDescription, params.characterSheet),
    params.styleProfile
  );
  const rawAccentColor = (
    raw.accentColor || (isMono ? 'stark high-contrast white' : isWidescreen ? 'vibrant electric amber' : 'cold crimson')
  ).trim();
  const accentColor = isMono
    ? 'stark high-contrast white'
    : rawAccentColor;

  // Clean hook text: uppercase, max 4 words, derive from story premise instead of generic "SURVIVE"
  const storyFallbackHook = buildStoryDerivedHookFallback(params.storyPremise || '');
  let cleanHook = (raw.hookText || storyFallbackHook).replace(/["'’]/g, '').trim().toUpperCase();
  const hookWords = cleanHook.split(/\s+/).filter(Boolean);
  if (hookWords.length > 4) {
    cleanHook = hookWords.slice(0, 4).join(' ');
  }
  if (!cleanHook) cleanHook = storyFallbackHook;

  const rawStoryAdaptiveFont =
    raw.fontStyle && raw.fontStyle.trim().length > 0
      ? raw.fontStyle.trim()
      : inferStoryAdaptiveFont(params.styleProfile?.artStyle, params.storyPremise);
  const storyAdaptiveFont = rawStoryAdaptiveFont.replace(/[.,;:!?]+$/, '').trim();

  // Primary character extraction for identity lock (strip transient expressions so thumbnail emotion never clashes)
  const formatSheetSubjectName = (rawKey: string, capitalizeStart: boolean): string => {
    const trimmed = rawKey.trim();
    const hasCamelBoundary = /[a-z0-9][A-Z]/.test(trimmed) || /[A-Z]{2,}[a-z]/.test(trimmed);
    const spaced = trimmed
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const lower = spaced.toLowerCase();
    const isGenericRole =
      hasCamelBoundary ||
      /\b(?:protagonist|narrator|photographer|detective|soldier|scientist|survivor|child|mother|father|driver|archivist|diver|doctor|stranger|victim|hero|explorer|journalist|writer|teacher|student|guard|pilot|captain|officer|knight|king|queen|engineer|astronaut|astronauts|courier|nurse|surgeon|worker|researcher|operative|operatives|enforcers|guards|soldiers)\b$/i.test(
        lower
      );
    if (isGenericRole) {
      return capitalizeStart ? `The ${lower}` : `the ${lower}`;
    }
    return spaced;
  };

  const characters = Object.entries(params.characterSheet || {});
  let primaryCharClause = 'The protagonist';
  let primaryName = '';
  if (characters.length > 0) {
    const [name, desc] = characters[0];
    primaryName = name;
    const cleanIdentityDesc = (stripTransientExpressionsAndPoses(desc) || desc).replace(/[.!?]+$/, '').trim();
    const displayName = formatSheetSubjectName(name, true);
    primaryCharClause = `${displayName} (locked visual identity: ${cleanIdentityDesc})`;
  }

  // Safe zones and layout
  const subjectPlacement = isWidescreen
    ? 'Subject positioned in the left third, filling roughly 50% of the frame'
    : 'Subject centered in the upper-middle vertical band, filling roughly 55% of the frame';

  const textPlacement = isWidescreen
    ? 'in the upper-right third of the frame'
    : 'in the center-upper safe zone, above the hero shoulders';

  const safeZoneGuidance = isWidescreen
    ? 'Platform safe zone: strictly keep the bottom-right corner clear of text and faces for the YouTube timestamp duration badge; keep lower 10% clear for the scrub bar.'
    : 'Platform safe zone: keep the top 12% clear for header/profile icons, bottom 25% clear for captions/music titles, and right edge clear for like/comment buttons.';

  const rawAccentWithoutDirectives =
    accentColor
      .replace(/^intense\s+/i, '')
      .replace(/\s*rim\s+(?:lighting|light)\s*$/i, '')
      .trim() || accentColor;
  const cleanAccentColor = /^[A-Z][a-z]/.test(rawAccentWithoutDirectives)
    ? rawAccentWithoutDirectives[0].toLowerCase() + rawAccentWithoutDirectives.slice(1)
    : rawAccentWithoutDirectives;
  const rimLightPhrase = isMono
    ? 'stark pure-white rim lighting cutting through pitch-black cross-hatched shadows'
    : `intense ${cleanAccentColor} rim lighting separating the subject from the background`;

  const thumbEra: 'present' | 'flashback' = /\b(?:flashback|childhood|nine-year-old)\b/i.test(
    `${heroMoment} ${bgDescription}`
  )
    ? 'flashback'
    : 'present';

  const sharedThumbStyle = sanitizeSharedVisualStyle(params.styleProfile?.artStyle || 'Cinematic realistic') || 'Cinematic realistic';
  const cleanThumbArtStyle = (
    sanitizeStyleForEra(sharedThumbStyle, thumbEra) || sharedThumbStyle
  )
    .replace(/[.!?]+$/, '')
    .trim();
  const rawCleanPalette = (
    sanitizeStyleForEra(
      sanitizeMonochromeLighting(
        params.styleProfile?.colorPalette || 'high-contrast dramatic lighting',
        params.styleProfile
      ),
      thumbEra
    ) || 'high-contrast dramatic lighting'
  )
    .replace(/[.!?]+$/, '')
    .trim();
  const cleanPalette = /^[A-Z][a-z]/.test(rawCleanPalette)
    ? rawCleanPalette[0].toLowerCase() + rawCleanPalette.slice(1)
    : rawCleanPalette;

  const cleanExpression = expression.replace(/[.!?]+$/, '').trim();
  let cleanHeroMoment = heroMoment.replace(/[.!?]+$/, '').trim();
  const cleanBgDescription = bgDescription.replace(/[.!?]+$/, '').trim();

  // Expand secondary character mentions in Visual Conflict (e.g. "faces Rowan" -> "faces Adult Rowan (locked visual identity: ...)")
  if (characters.length > 1) {
    const isChildMoment = thumbEra === 'flashback';
    for (const [secName, secDesc] of characters.slice(1)) {
      if (!secDesc || secName === primaryName) continue;
      const isSecChild = /\b(?:child|nine-year-old|young\s+(?:boy|girl))\b/i.test(`${secName} ${secDesc}`);
      const isSecAdult = !isSecChild && /\b(?:adult|mid-thirties|thirties|forties|older)\b/i.test(`${secName} ${secDesc}`);
      if ((isChildMoment && isSecAdult) || (!isChildMoment && isSecChild)) continue;

      const compactSec = buildCompactCharacterAnchor(
        stripTransientExpressionsAndPoses(secDesc) || secDesc,
        CHARACTER_ANCHOR_MAX_WORDS
      );
      if (!compactSec) continue;

      const escapedFull = secName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const fullRegex = new RegExp(`\\b(${escapedFull})\\b(?!\\s*\\()`, 'i');
      if (fullRegex.test(cleanHeroMoment)) {
        cleanHeroMoment = cleanHeroMoment.replace(fullRegex, `$1 (${compactSec})`);
        continue;
      }

      // Check unambiguous personal token (e.g. "Rowan" from "Adult Rowan")
      const ageStripped = secName
        .replace(/^(?:Adult|Child|Young|Older|The)\s+/i, '')
        .trim();
      if (ageStripped.length >= 3) {
        const escapedShort = ageStripped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const shortRegex = new RegExp(`\\b(${escapedShort})\\b(?!\\s*\\()`, 'i');
        if (shortRegex.test(cleanHeroMoment)) {
          cleanHeroMoment = cleanHeroMoment.replace(shortRegex, `${secName} (${compactSec})`);
        }
      }
    }
  }

  const bgAlreadyHasRimOrSeparating = /\b(?:rim\s+light|rim\s+lighting|separat(?:ing|ion))\b/i.test(
    cleanBgDescription
  );
  const bgLightingSentence = bgAlreadyHasRimOrSeparating
    ? `Background setting: ${cleanBgDescription}, accented with deep shadows and ${cleanAccentColor} highlights.`
    : `Deep shadows, ${rimLightPhrase}: ${cleanBgDescription}.`;

  // Full compiled prompt with typography
  const compiledPrompt = normalizeUnicodeAndDashes([
    `STATIC THUMBNAIL IMAGE ONLY. Single high-impact cover frame. No animation, video, camera movement, or motion blur.`,
    `Framed in ${aspectRatio} aspect ratio for a high-CTR ${targetPlatform} cover.`,
    `Style continuity: ${cleanThumbArtStyle}, ${cleanPalette}.`,
    `Hero Subject: ${primaryCharClause}, expression: ${cleanExpression}. ${subjectPlacement}.`,
    `Visual Conflict: Climactic turning point: ${cleanHeroMoment}. ${bgLightingSentence}`,
    `${safeZoneGuidance}`,
    `Typography & Text Overlay: Graphic headline text "${cleanHook}" rendered in ${storyAdaptiveFont}, in bold uppercase with a thick dark outline and high-contrast fill, positioned ${textPlacement}. Text appears exactly once, perfectly spelled, perfectly legible at small mobile thumbnail scale. No other lettering, subtitles, dialogue, or watermarks.`,
    `--ar ${aspectRatio}`,
  ].join(' '));

  // Clean plate prompt without typography (for Canva / Photoshop editors)
  const cleanPlatePrompt = normalizeUnicodeAndDashes([
    `STATIC THUMBNAIL IMAGE ONLY. Single high-impact background plate. No animation, video, camera movement, or motion blur.`,
    `Framed in ${aspectRatio} aspect ratio for a ${targetPlatform} cover.`,
    `Style continuity: ${cleanThumbArtStyle}, ${cleanPalette}.`,
    `Hero Subject: ${primaryCharClause}, expression: ${cleanExpression}. ${subjectPlacement}.`,
    `Visual Conflict: Climactic turning point: ${cleanHeroMoment}. ${bgLightingSentence}`,
    `${safeZoneGuidance}`,
    `Negative Space & Clean Plate: Clean negative space ${textPlacement} left completely empty without any text, lettering, words, watermarks, or logos, designed as a clean text-free background plate for custom graphic overlay.`,
    `--ar ${aspectRatio}`,
  ].join(' '));

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

/**
 * Infers a high-engagement, story-adaptive CTA question designed to provoke comments
 */
export function inferStoryAdaptiveCtaQuestion(storyPremise?: string, characterName?: string): {
  primaryQuestion: string;
  alternateQuestions: string[];
} {
  const text = (storyPremise || '').toLowerCase();
  const rawChar = characterName ? characterName.trim() : 'the protagonist';
  const char = rawChar.toLowerCase() === 'protagonist' ? 'the protagonist' : rawChar;

  // Horror / Supernatural / Mirror / Psychological Suspense (evaluated BEFORE incidental moral words like "lie")
  if (
    /\b(?:horror|creature|monster|shadow|dark|fear|haunt|escape|trap|mirror|reflection|entity|mimic|warden|unblinking|smiling|never smiled|parallel universe|staring back|half-second late|nightmare|doppelganger|creep|whisper|grin)\b/i.test(
      text
    )
  ) {
    const isMirrorHorror = /\b(?:mirror|reflection|mimic|doppelganger|staring back|half-second late)\b/i.test(text);
    if (isMirrorHorror) {
      return {
        primaryQuestion: 'Would you dare look into the mirror tonight, or cover every glass surface in your home?',
        alternateQuestions: [
          'At what exact moment did you realize the reflection was no longer copying movements?',
          'What would you do if your own reflection stayed behind smiling after you stepped away?',
          'Do you believe mirrors reflect this world, or trap something watching from the other side?',
          'Would you smash the glass right away, or freeze in place?',
        ],
      };
    }

    return {
      primaryQuestion: 'Would you have stayed behind, or fled the moment things went dark?',
      alternateQuestions: [
        'What would you have done differently to survive?',
        'Would you open that door if your life depended on it?',
        `Was ${char}'s survival luck or calculated strategy?`,
        'Would you enter the darkness to save a companion?',
      ],
    };
  }

  // Explicit high-stakes binary dilemma ("must choose: sell the truth or broadcast it")
  const explicitChoiceMatch = (storyPremise || '').match(
    /\b(?:must choose|forced to choose|has to choose|choose between)[:\s]+([^,.!?]+?\s+or\s+[^,.!?]+)/i
  );
  if (explicitChoiceMatch && explicitChoiceMatch[1]) {
    const rawChoice = explicitChoiceMatch[1].trim().replace(/[.!?]+$/, '');
    const questionPrefix = /^(?:between|whether)\b/i.test(rawChoice)
      ? `Which side would you pick: ${rawChoice}?`
      : `Would you ${rawChoice}?`;
    return {
      primaryQuestion: questionPrefix,
      alternateQuestions: [
        `What would you have chosen in ${char}'s position?`,
        'Is safety worth silence, or should the truth always go public?',
        'Would you take the payoff and walk away, or risk everything to expose it?',
        'What do you think happens next after this choice?',
      ],
    };
  }

  const isSciFiPremise =
    /\b(?:ai|robot|space|cyber|cyberpunk|dystopian|simulation|alien|tech|technology|memory-chip|hologram|neon|enforcers|android|neural)\b/i.test(
      text
    ) ||
    /\b(?:distant\s+future|far\s+future|future\s+world|year\s+2\d{3}|time\s+travel)\b/i.test(text);

  const isFuturisticSciFi =
    /\b(?:cyber|cyberpunk|dystopian|simulation|alien|memory-chip|hologram|neon|enforcers|android|neural|robot|ai)\b/i.test(
      text
    );

  // Documentary / Historical / Space / Science Pioneer (evaluated before generic Sci-Fi "space" or default fallback)
  if (
    !isFuturisticSciFi &&
    /\b(?:19\d\d|18\d\d|17\d\d|16\d\d|nasa|apollo|moon landing|lunar|astronaut|history|historic|historical|historian|pioneer|invented|invention|discovered|scientist|swedish|mission|century|archival|true story|real-life|world war)\b/i.test(
      text
    )
  ) {
    return {
      primaryQuestion: 'Did you already know the story behind this historic moment, or was it new to you?',
      alternateQuestions: [
        'Which unsung pioneer from history deserves a spotlight next?',
        'How different would today look if this moment had turned out differently?',
        'What detail from this true story surprised you the most?',
        'Should more real-life history stories be told like this?',
      ],
    };
  }

  // Finance / Banking / Compliance / Mortgage / Contract Trap / Consumer Protection
  if (
    !isFuturisticSciFi &&
    /\b(?:mortgage|prepayment\s+penalty|loan\s+contract|home\s+loan|lender|lenders|interest\s+payments|principal|zero-penalty|credit\s+score|credit\s+card|hidden\s+fee|penalty\s+fee|clear\s+your\s+debt|out\s+of\s+debt|deposit|deposits|structuring|currency\s+transaction|suspicious\s+activity|anti-money\s+laundering|asset\s+seizures?|frozen\s+accounts?|federal\s+disclosures?|federal\s+crime|compliance\s+officers?|reporting\s+rules)\b/i.test(
      text
    )
  ) {
    const isDepositBanking = /\b(?:deposit|deposits|structuring|currency\s+transaction|suspicious\s+activity|anti-money\s+laundering|asset\s+seizures?|frozen\s+accounts?)\b/i.test(
      text
    );
    if (isDepositBanking) {
      return {
        primaryQuestion: 'Did you know splitting cash deposits under $10,000 can still trigger a federal bank flag?',
        alternateQuestions: [
          'Would you keep large cash savings at home, or deposit everything at once with full paperwork?',
          'Have you ever had a bank freeze or flag a normal cash transaction without warning?',
          'Should banks be required to notify customers before filing an automated report?',
          'What financial reporting rule surprised you the most?',
        ],
      };
    }
    return {
      primaryQuestion: 'Did you check your own loan contract for a hidden penalty clause before signing?',
      alternateQuestions: [
        'Have you ever been hit with an unexpected early-payoff fee or contract fine?',
        'Should prepayment penalty clauses be banned in home loan contracts?',
        'How many borrowers actually read the fine print before signing on the dotted line?',
        'What financial trap caught you by surprise the hardest?',
      ],
    };
  }

  // Emotional Reunion / Forgiveness / Bond Decision (before loose "truth" Mystery trigger)
  const isHardMystery = /\b(?:murder|killer|detective|clue|suspect|crime scene|whodunit|forensic|autopsy)\b/i.test(text);
  if (
    !isHardMystery &&
    /\b(?:must decide|decide whether|old bond|promise to reunite|reunite|reunion|returns changed|childhood friend|forgive|let go|second chance|survive the truth)\b/i.test(
      text
    )
  ) {
    return {
      primaryQuestion: `Should ${char} trust that old bond again, or walk away?`,
      alternateQuestions: [
        'Can a childhood promise survive twenty years of secrets and distance?',
        `What would you have decided in ${char}'s shoes at that threshold?`,
        'When someone returns changed, do you open the door or keep it shut?',
        'Would you forgive the past to save the bond, or protect yourself?',
      ],
    };
  }

  // Mystery / Detective / Secret (do not let incidental "truth" hijack Sci-Fi or emotional reunion dilemmas)
  if (
    text.includes('mystery') ||
    text.includes('clue') ||
    text.includes('secret') ||
    text.includes('detective') ||
    text.includes('murder') ||
    ((text.includes('hidden') || text.includes('truth')) && !isSciFiPremise)
  ) {
    return {
      primaryQuestion: 'Did you spot the single clue before the reveal, or were you blindsided?',
      alternateQuestions: [
        `What was ${char}'s fatal tactical mistake?`,
        'Who do you believe was secretly behind everything?',
        'Would you have figured out the secret in time?',
        'Did the ending leave questions that still need answering?',
      ],
    };
  }

  // Betrayal / Revenge / Moral Dilemma / Sacrifice / Loyalty
  if (
    /\b(?:betray|betrayal|revenge|lie|lies|lied|lying|trust|moral|sacrifice|justice|crime)\b/i.test(text)
  ) {
    return {
      primaryQuestion: 'Who was truly in the wrong here? Drop your verdict below.',
      alternateQuestions: [
        'Would you ever forgive what was done?',
        'Did the punishment fit the crime, or go too far?',
        `Would you have made the exact same sacrifice as ${char}?`,
        'Was this justified revenge or pure cruelty?',
      ],
    };
  }

  // Sci-Fi / AI / Tech / Space / Future / Cyber
  if (isSciFiPremise) {
    return {
      primaryQuestion: 'Would you accept this technology if it was offered to you today?',
      alternateQuestions: [
        'Is humanity heading toward this exact reality?',
        'Would you upload your consciousness or remain behind?',
        `Was ${char}'s discovery a miracle or a catastrophe?`,
        'Could society ever recover from an outcome like this?',
      ],
    };
  }

  // Fantasy / Magic / Kingdom / Myth / Power
  if (
    text.includes('magic') ||
    text.includes('dragon') ||
    text.includes('spell') ||
    text.includes('kingdom') ||
    text.includes('king') ||
    text.includes('queen') ||
    text.includes('power') ||
    text.includes('curse')
  ) {
    return {
      primaryQuestion: 'If you possessed this power, how would you have used it?',
      alternateQuestions: [
        'Was the curse broken, or did it merely take a new form?',
        `Did ${char} make the right pact in the end?`,
        'Which realm or faction would you pledge loyalty to?',
        'What price would you pay for that knowledge?',
      ],
    };
  }

  // Nostalgic / Memory / Comfort Sanctuary / Spirit Folklore
  if (
    /\b(?:restores?\s+mortal\s+memor(?:y|ies)|forgotten\s+memor(?:y|ies)|lost\s+memor(?:y|ies)|nostalg|warm\s+broth|ramen|lantern|wandering\s+ghosts?|spirits?\s+and\s+wandering|comfort\s+food|healing\s+meal)\b/i.test(
      text
    )
  ) {
    return {
      primaryQuestion:
        'If one warm meal could bring back any forgotten memory, which moment from your life would you choose?',
      alternateQuestions: [
        'Who is someone from your past you wish could sit beside you for one quiet midnight meal?',
        'Do you think forgotten memories fade away, or wait quietly until something brings them back?',
        'What scent or comfort dish instantly unlocks your clearest memory?',
        'Would you rather revisit your happiest memory once, or heal a quiet regret?',
      ],
    };
  }

  // General / Viral short-form engagement default
  return {
    primaryQuestion: `What would you have chosen in ${char}'s position? Tell us below.`,
    alternateQuestions: [
      'Did they make the right call at the end, or a huge mistake?',
      'How would you have handled this turning point?',
      'Do you believe there was another way out?',
      'What do you predict happens in Episode 2?',
    ],
  };
}

/**
 * Compiles a production-grade, safe-zone compliant CTA Outro prompt
 * Adaptable across TikTok, YouTube Shorts, and General platforms,
 * as well as Text-to-Image (T2I) and Text-to-Video (T2V) modalities.
 */
export function compileCtaPrompt(params: {
  storyPremise?: string;
  styleProfile?: StyleProfile;
  characterSheet?: Record<string, string>;
  format?: StoryFormat;
  platform?: CtaPlatform;
  modality?: CtaModality;
  questionText?: string;
  engagementType?: CtaEngagementType;
}): CtaPromptData {
  const platform = params.platform || 'tiktok';
  const modality = params.modality || 'video';
  const engagementType = params.engagementType || 'question';

  const isWidescreen = params.format === 'long';
  const aspectRatio: '16:9' | '9:16' = isWidescreen ? '16:9' : '9:16';

  // Primary character extraction for identity lock (expression-free)
  const formatCtaRoleName = (rawKey: string): string => {
    const trimmed = rawKey.trim();
    const hasCamelBoundary = /[a-z0-9][A-Z]/.test(trimmed) || /[A-Z]{2,}[a-z]/.test(trimmed);
    const spaced = trimmed
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const lower = spaced.toLowerCase();
    const isGenericRole =
      hasCamelBoundary ||
      /\b(?:protagonist|narrator|photographer|detective|soldier|scientist|survivor|child|mother|father|driver|archivist|diver|doctor|stranger|victim|hero|explorer|journalist|writer|teacher|student|guard|pilot|captain|officer|knight|king|queen|engineer|astronaut|astronauts|courier|nurse|surgeon|worker|researcher|operative|operatives|enforcers|guards|soldiers|chef|cook|baker|keeper|owner|master|vendor|merchant|waiter|barista|bartender|host|elder|monk|priest|witch|wizard|healer|guardian|warden|ghost|spirit|patron|traveler|wanderer|blacksmith|clockmaker|tinker|shoemaker|tailor|librarian|caretaker|watchman)\b$/i.test(
        lower
      );
    return isGenericRole ? `the ${lower}` : spaced;
  };

  const characters = Object.entries(params.characterSheet || {});
  let primaryCharName = 'the protagonist';
  let primaryCharClause = 'the protagonist';
  if (characters.length > 0) {
    const [rawName, rawDesc] = characters[0];
    const cleanDesc = (stripTransientExpressionsAndPoses(rawDesc) || rawDesc).replace(/[.!?]+$/, '').trim();
    const formattedName = formatCtaRoleName(rawName);
    primaryCharName = formattedName;
    primaryCharClause = `${formattedName} (locked visual identity: ${cleanDesc})`;
  }

  // Question resolution (strip production age prefixes like "Adult " / "Young " so the viewer question reads naturally)
  const ctaQuestionSubject = primaryCharName.replace(/^(?:Adult|Young|Old|Older|Teen|Child|Elder)\s+/i, '').trim() || primaryCharName;
  const { primaryQuestion, alternateQuestions } = inferStoryAdaptiveCtaQuestion(params.storyPremise, ctaQuestionSubject);
  const activeQuestion =
    params.questionText && params.questionText.trim().length > 0
      ? params.questionText.trim()
      : primaryQuestion;

  const isMono = isMonochromeStyle(params.styleProfile);
  const rawArtStyle = sanitizeSharedVisualStyle(params.styleProfile?.artStyle || 'Cinematic realistic') || 'Cinematic realistic';
  const artStyle = (sanitizeStyleForEra(rawArtStyle, 'present') || rawArtStyle).replace(/[.!?]+$/, '').trim();
  const rawPalette = params.styleProfile?.colorPalette || 'high-contrast dramatic lighting, rich atmospheric haze';
  const rawColorPalette = (
    sanitizeStyleForEra(
      sanitizeMonochromeLighting(rawPalette, params.styleProfile),
      'present'
    ) || sanitizeMonochromeLighting(rawPalette, params.styleProfile)
  )
    .replace(/[.!?]+$/, '')
    .trim();
  const colorPalette = /^[A-Z][a-z]/.test(rawColorPalette)
    ? rawColorPalette[0].toLowerCase() + rawColorPalette.slice(1)
    : rawColorPalette;
  const rawLighting =
    params.styleProfile?.lighting || 'deep directional key light with saturated rim backlight';
  const staticSafeLighting =
    modality === 'image'
      ? sanitizeStyleForEra(
          rawLighting
            .replace(/,?\s*\b(?:transitioning|shifting|fading|morphing)\s+to\b[^.;]*/gi, '')
            .replace(/,\s*$/, '')
            .trim() || rawLighting,
          'present'
        )
      : sanitizeStyleForEra(rawLighting, 'present');
  const lighting = (
    isMono
      ? sanitizeMonochromeLighting(staticSafeLighting, params.styleProfile) ||
        'stark chiaroscuro contrast lighting with deep ink shadows'
      : staticSafeLighting || rawLighting
  )
    .replace(/[.!?]+$/, '')
    .trim();

  // Platform specific safe zone rules & UI annotations
  let platformLabel = 'TikTok';
  let safeZoneGuidance = '';
  let uiCalloutGuidance = '';
  let cleanPlateGuidance = '';

  if (platform === 'tiktok') {
    platformLabel = 'TikTok 9:16 Vertical';
    safeZoneGuidance =
      'TikTok safe zone layout: Keep the right 18% completely empty to avoid overlap with vertical like, comment, bookmark, and share icon buttons. Keep the bottom 22% clear for account name, video caption lines, and audio disc. Keep top 12% clear for search and feed tabs.';

    if (engagementType === 'question') {
      uiCalloutGuidance = `UI Engagement Callout: Center safe-zone graphic card displaying the intriguing question "${activeQuestion}" in bold readable sans-serif, with a subtle dark backdrop bar. Below the question, an action tag: "Drop your verdict in the comments". Positioned safely in the center vertical band (y: 35% to 65%), strictly clear of the right icon column and bottom caption area.`;
    } else if (engagementType === 'follow_subscribe') {
      uiCalloutGuidance = `UI Engagement Callout: Center safe-zone graphic card displaying "${activeQuestion}" with a prominent follow badge: "[+] Follow for more" and comment cue "What would you do?", positioned in the safe center-left quadrant, strictly clear of the right action rail and bottom caption.`;
    } else {
      uiCalloutGuidance = `UI Engagement Callout: Center safe-zone graphic card displaying the moral dilemma "${activeQuestion}" with voting tags "[Option A] vs [Option B] · Comment your choice", positioned in the center vertical safe zone.`;
    }

    cleanPlateGuidance =
      'Clean Plate & Negative Space: Center safe-zone (x: 10% to 80%, y: 30% to 70%) kept completely empty with clean atmospheric depth and dark vignette. No text, letters, question marks, logos, or UI buttons anywhere in frame, designed as a pristine background plate for editors to overlay questions and stickers in CapCut or Premiere.';
  } else if (platform === 'youtube_shorts') {
    platformLabel = 'YouTube Shorts 9:16 Vertical';
    safeZoneGuidance =
      'YouTube Shorts safe zone layout: Keep the bottom 20% strictly clear of text and focal faces for the channel avatar, channel name, and subscribe button. Keep the right 15% clear for engagement icons (thumbs up, comments, share, remix). Keep top 10% clear.';

    if (engagementType === 'question') {
      uiCalloutGuidance = `UI Engagement Callout: Upper-middle safe zone graphic displaying "${activeQuestion}" in high-contrast clean typography with sharp drop shadow. Below it, a subtle prompt line: "Share your thoughts in the comments · Subscribe for more stories".`;
    } else if (engagementType === 'follow_subscribe') {
      uiCalloutGuidance = `UI Engagement Callout: Upper-middle safe zone displaying "${activeQuestion}" along with a clean "Subscribe" action indicator and bell reminder, placed safely above the lower 25% boundary.`;
    } else {
      uiCalloutGuidance = `UI Engagement Callout: Centered safe zone displaying "${activeQuestion}" with interactive prompt: "Drop your verdict below · Subscribe for the sequel".`;
    }

    cleanPlateGuidance =
      'Clean Plate & Negative Space: Center and upper-center safe zone kept completely empty with atmospheric lighting. Zero text, no typography, no watermarks, no channel logos, engineered as a clean plate for native Shorts text and sticker tools.';
  } else {
    // General / Multi-platform
    platformLabel = isWidescreen ? 'General Widescreen 16:9' : 'General Portrait 9:16';
    safeZoneGuidance =
      'Universal safe zone layout: Maintain 10% margin clearance on all four borders. Balanced cinematic composition compatible with Instagram Reels, X video, web embeds, and horizontal players.';

    uiCalloutGuidance = `UI Engagement Callout: High-contrast centered outro title card displaying "${activeQuestion}" in crisp modern editorial typography, with a sleek interactive subline: "Comment your thoughts below · Follow for the next chapter". Positioned in the central safe zone with subtle dark backdrop backing for maximum cross-platform legibility.`;
    cleanPlateGuidance =
      'Clean Plate & Negative Space: Central viewing area left spacious and free of any printed text, typography, logos, or graphics, designed as a universal text-free background plate for cross-platform editors.';
  }

  // Modality specific instruction
  let modalityHeader = '';
  let visualActionClause = '';

  const inlineLighting = /^[A-Z][a-z]/.test(lighting)
    ? lighting[0].toLowerCase() + lighting.slice(1)
    : lighting;

  const isWarmOrBittersweet =
    /\b(?:warm|gentle|bittersweet|memor(?:y|ies)|nostalg|cozy|healing|broth|chibi|kind|peaceful|restore|restores|spirits?)\b/i.test(
      `${params.storyPremise || ''} ${artStyle} ${lighting}`
    ) &&
    !/\b(?:horror|murder|killer|trap|betray|revenge|entity|mimic|monster|survival|crime|penalty|seizure|arrest)\b/i.test(
      `${params.storyPremise || ''}`
    );

  if (modality === 'video') {
    modalityHeader = `CINEMATIC 3-SECOND OUTRO VIDEO LOOP. ${platformLabel} moving video plate. Continuous seamless atmospheric loop. No jump cuts, no flashing strobes.`;
    visualActionClause = `Camera motion: slow subtle cinematic dolly in pushing slowly toward ${primaryCharClause}. Atmospheric ambient dust particles drift through ${inlineLighting}. ${
      isWarmOrBittersweet
        ? 'The subject holds a gentle, knowing gaze directly into the camera lens with quiet bittersweet warmth.'
        : 'The subject holds a lingering, unresolved, emotionally resonant gaze directly into the camera lens, breaking the fourth wall in quiet suspense as the scene holds tension.'
    }`;
  } else {
    modalityHeader = `STATIC OUTRO FRAME ONLY. ${platformLabel} closing freeze frame. Single ${
      isWarmOrBittersweet ? 'expressive' : 'high-tension'
    } still image. Zero camera movement, no motion blur, no video, no multiple frames.`;
    const ctaBackdropPhrase = /\bseparat(?:ion|ing)\b/i.test(inlineLighting)
      ? `${inlineLighting} against atmospheric background shadows`
      : `${inlineLighting} separating the hero from atmospheric background shadows`;
    visualActionClause = isWarmOrBittersweet
      ? `Composition: Freeze-frame closing portrait of ${primaryCharClause} holding a warm, knowing stillness, soft expressive eyes meeting the lens with gentle bittersweet emotion. Shallow depth of field, sharp focus on facial expression, ${ctaBackdropPhrase}.`
      : `Composition: Freeze-frame closing portrait of ${primaryCharClause} locked in an intense climactic pause, eyes meeting the lens with deep emotional gravity. Shallow depth of field, sharp cinematic focus on facial expression, ${ctaBackdropPhrase}.`;
  }

  // Full compiled prompt with typography (universal clean flags without legacy --style raw --v 6.1)
  const compiledPrompt = normalizeUnicodeAndDashes([
    modalityHeader,
    `Framed in ${aspectRatio} aspect ratio for high-retention short-form outro engagement.`,
    `Style continuity: ${artStyle}, ${colorPalette}.`,
    visualActionClause,
    safeZoneGuidance,
    uiCalloutGuidance,
    `--ar ${aspectRatio}`,
  ].join(' '));

  // Clean plate prompt (background only, text-free)
  const cleanPlatePrompt = normalizeUnicodeAndDashes([
    modalityHeader,
    `Framed in ${aspectRatio} aspect ratio for high-retention short-form outro engagement.`,
    `Style continuity: ${artStyle}, ${colorPalette}.`,
    visualActionClause,
    safeZoneGuidance,
    cleanPlateGuidance,
    `--ar ${aspectRatio}`,
  ].join(' '));

  return {
    questionText: activeQuestion,
    alternateQuestions,
    engagementType,
    platform,
    modality,
    aspectRatio,
    compiledPrompt,
    cleanPlatePrompt,
  };
}
