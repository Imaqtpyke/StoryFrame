import { Beat, Scene, StyleProfile, StoryFormat, GenerationMode } from '../types';
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
 * Compiles a visual beat into target-model-specific prompt syntax.
 */
export function compileBeatPrompt(
  beat: Beat,
  scene: Scene,
  styleProfile: StyleProfile | undefined,
  targetModel: TargetModel,
  format: StoryFormat = 'short',
  generationMode: GenerationMode = 'video'
): CompiledPrompt {
  const rawBasePrompt = (beat.imagePrompt || '').trim();
  const isImageMode = generationMode === 'image';

  // 1. Resolve Style vs Casting Compatibility
  const rawArtStyle = styleProfile?.artStyle || 'Cinematic photorealism';
  const { prompt: promptWithoutStyleConflict, artStyle } = resolveStyleAndCastingCompatibility(rawBasePrompt, rawArtStyle);

  // 2. Sanitize kinetic process verbs for image mode
  const baseImagePrompt = isImageMode
    ? sanitizeKineticMotionForImage(promptWithoutStyleConflict)
    : promptWithoutStyleConflict;

  const shotType = beat.shotType || 'Medium shot';
  const cameraAngle = beat.cameraAngle || 'Eye-level';
  const cameraMovement = normalizeCameraMovement(beat.cameraMovement);
  const optics = beat.optics || '35mm anamorphic lens, f/2.8 aperture';
  const lighting = styleProfile?.lighting || 'natural cinematic lighting, 5600K balanced daylight';
  const aspectRatio = format === 'long' ? '16:9' : '9:16';

  let compiledText = '';
  let negativePrompt: string | undefined = undefined;
  const parameters: Record<string, string> = {};

  switch (targetModel) {
    case 'midjourney': {
      // Midjourney prefers: [Subject & Action], [Framing & Shot Type], [Lighting & Color], [Optics & Lens] --ar --v 6.1 --stylize
      const arFlag = format === 'long' ? '--ar 16:9' : '--ar 9:16';
      if (isImageMode) {
        compiledText = `Generate a single still image: ${baseImagePrompt}, ${shotType}, ${cameraAngle}, ${lighting}, shot on ${optics}, ${artStyle} ${arFlag} --v 6.1 --stylize 150`;
        negativePrompt = '--no motion, animation, video, moving camera, text, watermark';
      } else {
        compiledText = `${baseImagePrompt}, ${shotType}, ${cameraAngle}, ${lighting}, shot on ${optics}, ${artStyle} ${arFlag} --v 6.1 --stylize 150`;
      }
      parameters['ar'] = aspectRatio;
      parameters['v'] = '6.1';
      parameters['stylize'] = '150';
      break;
    }

    case 'kling': {
      // Kling AI prefers natural language imperative action with explicit motion verbs and camera control
      const motionAction = cameraMovement !== 'Static lock-off shot'
        ? `Cinematic camera: ${cameraMovement} with controlled speed.`
        : `Locked-off tripod shot with zero camera drift.`;
      
      compiledText = `${motionAction} ${shotType}, ${cameraAngle}. ${baseImagePrompt}. Lighting: ${lighting}. High kinetic stability, realistic motion physics, photorealistic textures.`;
      negativePrompt = 'morphing, jitter, deformed hands, extra limbs, frame jitter, flickering, sudden cuts, blur, low resolution';
      break;
    }

    case 'runway': {
      // Runway Gen-3 Alpha benefits from structured sections: Camera: ... Subject: ... Lighting: ...
      const cameraPart = cameraMovement !== 'Static lock-off shot'
        ? `Camera: ${cameraMovement}, ${cameraAngle}, ${shotType}.`
        : `Camera: Static shot, ${shotType}.`;
      
      compiledText = `${cameraPart} Subject: ${baseImagePrompt} Lighting and Atmosphere: ${lighting}. Optics: ${optics}. Pacing: smooth cinematic tempo, high-fidelity physical interaction.`;
      break;
    }

    case 'luma': {
      // Luma Dream Machine responds well to clear start-frame subject descriptions with transition hints
      const motionProgression = beat.transitionHint
        ? `Beginning with ${shotType}, transitioning smoothly: ${beat.transitionHint}.`
        : `Fluid camera motion: ${cameraMovement}.`;
      
      compiledText = `${shotType} of ${baseImagePrompt}. ${motionProgression} Atmosphere: ${lighting}. Clean spatial continuity, stable subject geometry, photorealistic render.`;
      break;
    }

    case 'universal':
    default: {
      if (isImageMode) {
        compiledText = `Generate a single still image of: ${baseImagePrompt}. Static frame. One exact moment in time. No animation, no camera movement, no video.`;
        negativePrompt = 'motion, animation, video, timelapse, moving camera, GIF, multiple frames, text, watermark';
      } else {
        compiledText = `Generate a continuous video clip of: ${baseImagePrompt}. Dynamic continuous video shot.`;
        negativePrompt = 'morphing, jitter, deformed hands, sudden cuts, blur, low resolution, watermark, text overlays';
      }
      break;
    }
  }

  // Deduplicate extra spaces
  compiledText = compiledText.replace(/\s+/g, ' ').trim();
  const wordCount = compiledText.split(/\s+/).filter(Boolean).length;
  const budgetWordCount = targetModel === 'runway' || targetModel === 'kling' ? 75 : 95;

  return {
    targetModel,
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
      if (wordCount > 90) {
        issues.push({
          id: `L04-scene-${sceneIndex}-beat-${beatIndex}`,
          severity: 'info',
          message: `Beat ${beatIndex}: Prompt length (${wordCount} words) is high for generative video clips.`,
          suggestion: 'Video models (Kling, Runway) attend best to prompts between 40-75 words.',
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
