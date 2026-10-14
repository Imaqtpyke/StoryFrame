import { Beat, Scene, StyleProfile, StoryFormat, GenerationMode } from '../types';

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
  const baseImagePrompt = (beat.imagePrompt || '').trim();
  const shotType = beat.shotType || 'Medium shot';
  const cameraAngle = beat.cameraAngle || 'Eye-level';
  const cameraMovement = normalizeCameraMovement(beat.cameraMovement);
  const optics = beat.optics || '35mm anamorphic lens, f/2.8 aperture';
  const lighting = styleProfile?.lighting || 'natural cinematic lighting, 5600K balanced daylight';
  const artStyle = styleProfile?.artStyle || 'Cinematic photorealism';
  const aspectRatio = format === 'long' ? '16:9' : '9:16';

  let compiledText = '';
  let negativePrompt: string | undefined = undefined;
  const parameters: Record<string, string> = {};

  switch (targetModel) {
    case 'midjourney': {
      // Midjourney prefers: [Subject & Action], [Framing & Shot Type], [Lighting & Color], [Optics & Lens] --ar --v 6.1 --stylize
      const arFlag = format === 'long' ? '--ar 16:9' : '--ar 9:16';
      compiledText = `${baseImagePrompt}, ${shotType}, ${cameraAngle}, ${lighting}, shot on ${optics}, ${artStyle} ${arFlag} --v 6.1 --stylize 150`;
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
      compiledText = baseImagePrompt;
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
    });
  });

  return issues;
}
