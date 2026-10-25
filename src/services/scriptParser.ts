/**
 * Manuscript Ingestion Engine for StoryFrame
 * Deterministically parses structured Markdown screenplays and episode plans
 * into normalized StoryFrame scenes, beats, character sheets, and video prompts.
 */

import { StoryGenerationResult, Scene, Beat, StyleProfile, StoryBible } from '../types';
import { compileThumbnailPrompt } from './promptCompiler';

export interface ParsedClip {
  clipNumber: number;
  title: string;
  timecodeRange: string;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  voiceOver: string;
  visualDescription: string;
  cameraMovement: string;
  shotType: string;
  cameraAngle: string;
  soundCue: string;
  videoPrompt: string;
  startFramePrompt: string;
}

export interface SeriesEpisode {
  episodeNumber: number;
  title: string;
  description: string;
  status: 'draft' | 'completed' | 'planned';
}

export interface ParsedScriptResult {
  title: string;
  episodeTitle: string;
  format: 'short' | 'long';
  totalDurationSeconds: number;
  generationMode: 'video' | 'image';
  genre: string;
  corePremise: string;
  languageRule: string;
  targetResolution: string;
  productionNotes: string[];
  seriesRoadmap: SeriesEpisode[];
  clips: ParsedClip[];
  storyResult: StoryGenerationResult;
}

export interface ManuscriptValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  clipCount: number;
  detectedFormat?: 'short' | 'long';
  totalDurationSeconds?: number;
}

/**
 * Validates markdown screenplay structure and reports specific missing fields or syntax defects
 */
export function validateManuscript(rawMarkdown: string): ManuscriptValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!rawMarkdown || !rawMarkdown.trim()) {
    return {
      isValid: false,
      errors: ['Manuscript content is empty.'],
      warnings: [],
      clipCount: 0,
    };
  }

  const lines = rawMarkdown.split('\n');
  const clipNumbersFound = new Set<number>();
  let clipsDetected = 0;
  let currentClip: { num: number; hasVO: boolean; hasVisual: boolean; timecode: string } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check language rule violation (gay or straight labels)
    if (/\b(gay|straight)\b/i.test(line) && !line.toLowerCase().includes('do not use the labels') && !line.toLowerCase().includes('language rule')) {
      errors.push(`Language rule violation: The word "${line.match(/\b(gay|straight)\b/i)?.[0]}" was detected in manuscript narration or dialogue. The premise strictly forbids using these labels.`);
    }

    const clipMatch = line.match(/^###\s+Clip\s+(\d+)(?:\s*[:—–-]\s*([^(]+))?(?:\s*\(([^)]+)\))?/i);
    if (clipMatch) {
      if (currentClip) {
        if (!currentClip.hasVO) {
          errors.push(`Clip ${currentClip.num} is missing a "**Voice-over:**" narration line.`);
        }
        if (!currentClip.hasVisual) {
          errors.push(`Clip ${currentClip.num} is missing a "**Visual:**" description.`);
        }
      }

      const num = parseInt(clipMatch[1], 10);
      clipsDetected++;

      if (clipNumbersFound.has(num)) {
        errors.push(`Duplicate clip number detected: Clip ${num} appears multiple times in the manuscript.`);
      }
      clipNumbersFound.add(num);

      const tc = clipMatch[3]?.trim() || '';
      if (!tc) {
        warnings.push(`Clip ${num} has no timecode range. Defaulting to 4 seconds.`);
      } else {
        const tcMatch = tc.match(/(\d+):(\d+)[–-](\d+):(\d+)/);
        if (!tcMatch) {
          errors.push(`Clip ${num} has malformed timecode "${tc}". Expected format: (0:00–0:04).`);
        } else {
          const start = parseInt(tcMatch[1], 10) * 60 + parseInt(tcMatch[2], 10);
          const end = parseInt(tcMatch[3], 10) * 60 + parseInt(tcMatch[4], 10);
          if (end <= start) {
            errors.push(`Clip ${num} has invalid timecode: end time (${tcMatch[3]}:${tcMatch[4]}) must be greater than start time (${tcMatch[1]}:${tcMatch[2]}).`);
          }
        }
      }

      currentClip = {
        num,
        hasVO: false,
        hasVisual: false,
        timecode: tc,
      };
      continue;
    }

    if (currentClip) {
      if (line.startsWith('**Voice-over:**') || line.startsWith('**Voiceover:**')) {
        const voText = line.replace(/\*\*Voice-?over:\*\*\s*/i, '').trim();
        if (voText.length > 0) currentClip.hasVO = true;
      } else if (line.startsWith('**Visual:**')) {
        const visText = line.replace(/\*\*Visual:\*\*\s*/i, '').trim();
        if (visText.length > 0) currentClip.hasVisual = true;
      }
    }
  }

  if (currentClip) {
    if (!currentClip.hasVO) {
      errors.push(`Clip ${currentClip.num} is missing a "**Voice-over:**" narration line.`);
    }
    if (!currentClip.hasVisual) {
      errors.push(`Clip ${currentClip.num} is missing a "**Visual:**" description.`);
    }
  }

  if (clipsDetected === 0) {
    errors.push('No clips detected. Ensure manuscript contains sections formatted like "### Clip 1 — Title (0:00–0:04)".');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    clipCount: clipsDetected,
  };
}

// Camera, motion, and character biometrics mappings for realistic video prompt synthesis
const CLIP_CINEMATOGRAPHY_PRESETS: Record<number, {
  movement: string;
  shotType: string;
  angle: string;
  soundCue: string;
  focalLength: string;
  charactersPresent: string[];
  characterBiometrics: string;
}> = {
  1: {
    movement: 'Slow forward glide pushing in',
    shotType: 'Wide establishing shot',
    angle: 'Eye-level tracking',
    soundCue: 'Heavy pneumatic door hiss, deep resonant bass thrum, metallic lock deadbolt snap',
    focalLength: '35mm anamorphic',
    charactersPresent: ['Twelve Male Contestants'],
    characterBiometrics: 'Twelve male contestants (late 20s to mid-30s) in tailored dark luxury evening wear (merino wool knits, collared linen shirts, tailored dark denim), standing in rigid formation behind tall frosted glass doors, tense shoulders, guarded watchful eyes.',
  },
  2: {
    movement: 'Slow upward pedestal tilt',
    shotType: 'Low-angle medium close-up',
    angle: 'Low-angle looking up',
    soundCue: 'Metallic briefcase latch click, subtle sub-bass tension pulse',
    focalLength: '50mm prime',
    charactersPresent: ['Twelve Male Contestants'],
    characterBiometrics: 'Solitary heavy aluminum flight briefcase with polished chrome latches unlocked under narrow surgical 6000K overhead spotlight; twelve contestant silhouettes motionless and watchful in deep perimeter shadow pools.',
  },
  3: {
    movement: 'Smooth 180-degree rotational arc',
    shotType: 'Medium shot',
    angle: 'Slight high-angle overview',
    soundCue: 'Digital countdown display beep, synchronized collective intake of breath',
    focalLength: '35mm wide',
    charactersPresent: ['The Enigmatic Host', 'Twelve Male Contestants'],
    characterBiometrics: 'The Enigmatic Host in tailored dark charcoal three-piece suit, crisp white collar, neatly parted dark hair with silver-touched temples, poised beside a glowing countdown display; twelve male contestants seated around circular smoked glass table, collective guarded expressions.',
  },
  4: {
    movement: 'Slow symmetrical push-in',
    shotType: 'Extreme wide interior shot',
    angle: 'Center-weighted direct eye-level',
    soundCue: 'Muffled low-frequency wind drone, echoing room reverberation',
    focalLength: '28mm cinema lens',
    charactersPresent: [],
    characterBiometrics: 'Two empty high-backed minimalist chairs under sharp solitary downlights at the far end of the gallery hall, heavy aluminum briefcase resting on dark slate floor between them, symbolizing the final two.',
  },
  5: {
    movement: 'Quick micro-rack focus between subjects',
    shotType: 'Tight close-up montage',
    angle: 'Intimate Dutch angle',
    soundCue: 'Subtle clinking of dinner silverware on porcelain, nervous throat clear',
    focalLength: '85mm portrait prime, f/1.8',
    charactersPresent: ['Contestants at Dinner'],
    characterBiometrics: 'Tight close-up montage of suspect faces across walnut dining table: one contestant with olive skin intensely watching his neighbor, a second contestant forcing a stiff tense smile, a third quickly darting his eyes away.',
  },
  6: {
    movement: 'Lateral tracking whip pan between groups',
    shotType: 'Medium three-shot',
    angle: 'Over-the-shoulder voyeuristic angle',
    soundCue: 'Hushed urgent whispers, soft carpeted shoe scuffs',
    focalLength: '50mm prime',
    charactersPresent: ['Whispering Contestants'],
    characterBiometrics: 'Three male contestants whispering in separate architectural corners (spiral staircase base, glass terrace corner), guarded body language, arms crossed over chests, furtive suspicious glances.',
  },
  7: {
    movement: 'Handheld subtle tension drift',
    shotType: 'Close-up confessional shot',
    angle: 'Eye-level surveillance perspective',
    soundCue: 'Muffled rapid breathing, bedroom door knob rattle outside',
    focalLength: '40mm anamorphic',
    charactersPresent: ['Contestant A'],
    characterBiometrics: 'Contestant A (athletic build, 28, olive green henley shirt, short dark fade) speaking quietly toward private interview camera in vertical oak-slat confessional booth, repeatedly darting nervous glances at the closed door.',
  },
  8: {
    movement: 'Slow creep-in on nervous hands',
    shotType: 'Medium close-up into extreme macro',
    angle: 'Slight high-angle looking down',
    soundCue: 'Metallic ring grinding against knuckles, unsteady whisper',
    focalLength: '65mm macro lens',
    charactersPresent: ['Contestant B'],
    characterBiometrics: 'Contestant B (lean build, 32, dark curly hair, tortoise-shell spectacles, charcoal turtleneck) sitting alone in dim confessional room, nervously twisting a brushed silver band on his left ring finger while whispering into the camera.',
  },
  9: {
    movement: 'High-speed rhythmic jump-cut pan',
    shotType: 'Split-field multi-angle sequence',
    angle: 'Alternating profile and direct angles',
    soundCue: 'Sharp synthetic riser, layered whispered overlapping confessions',
    focalLength: '50mm prime',
    charactersPresent: ['Contestant A', 'Contestant B', 'Contestant C'],
    characterBiometrics: 'Rapid tripartite intercut across three soundproofed interview rooms: Contestant A, Contestant B, and Contestant C (broad-shouldered, 35, trimmed beard, navy denim overshirt), each with wide anxious eyes convinced he alone holds the secret.',
  },
  10: {
    movement: 'Slow low-angle tracking follow',
    shotType: 'Low-angle silhouette shot',
    angle: 'Ground-level upward gaze',
    soundCue: 'Solemn hollow footsteps on slate floor, heavy velvet curtain rustle, ballot drop thump',
    focalLength: '35mm prime',
    charactersPresent: ['Contestants Voting'],
    characterBiometrics: 'Contestants entering dark subterranean voting room in solemn single-file procession, depositing sealed dark envelopes into a glowing biometric voting pedestal.',
  },
  11: {
    movement: 'Deadpan static lock-off with creeping push',
    shotType: 'Wide two-plane confrontation shot',
    angle: 'Direct front-on perspective',
    soundCue: 'Electronic screen hum, high-tension staccato heart pulse drone',
    focalLength: '40mm prime',
    charactersPresent: ['The Enigmatic Host', 'Twelve Male Contestants'],
    characterBiometrics: 'The Enigmatic Host standing poised beside a towering digital LED screen displaying a blurred distorted name; remaining contestants staring in tense frozen immobility.',
  },
  12: {
    movement: 'Slow push into the host’s knowing eyes before sudden cut',
    shotType: 'Extreme close-up',
    angle: 'Center-aligned direct lens address',
    soundCue: 'Faint wry chuckle, sudden electrical breaker pop, abrupt silent blackout',
    focalLength: '85mm prime, f/1.4',
    charactersPresent: ['The Enigmatic Host'],
    characterBiometrics: 'The Enigmatic Host looking directly into the cinema lens with a subtle knowing half-smile; massive digital display behind him abruptly loses power into pure blackout.',
  },
};

/**
 * Builds an 8-part video prompt conforming to StoryFrame prompt engineering standards:
 * [Camera & Motion] + [Subject Action] + [Anatomical Gestures] + [Tactile Lighting & Materials] + [Optics & Aspect] + [Audio Foley]
 */
export function buildEnhancedVideoPrompt(
  clipNumber: number,
  visualDescription: string,
  _voiceOver: string
): { videoPrompt: string; startFramePrompt: string; cinematography: typeof CLIP_CINEMATOGRAPHY_PRESETS[1] } {
  const cinema = CLIP_CINEMATOGRAPHY_PRESETS[clipNumber] || {
    movement: 'Slow cinematic push-in',
    shotType: 'Medium shot',
    angle: 'Eye-level',
    soundCue: 'Subtle ambient room tone, low sub-bass drone',
    focalLength: '50mm prime',
    charactersPresent: ['Contestants'],
    characterBiometrics: 'Authentic physical presence, natural weight distribution, tense shoulder posture, subtle involuntary micro-gestures.',
  };

  const videoPrompt = [
    `Vertical 9:16 cinematic video. Target resolution 360p.`,
    `Camera: ${cinema.movement}, ${cinema.shotType}, ${cinema.angle}, shot on ${cinema.focalLength}.`,
    `Action: ${visualDescription.replace(/\.$/, '')}.`,
    `Characters & Biometrics: ${cinema.characterBiometrics}`,
    `Atmosphere & Lighting: High-contrast prestige drama lighting, 3200K warm interior tungsten rim lights paired with cool 5600K architectural glass reflections, deep shadow falloff.`,
    `Pacing: Smooth continuous motion at 24fps with zero frame jitter, realistic human physics.`,
    `Sound Design: ${cinema.soundCue}.`,
    `Strict constraint: Zero on-screen text, subtitles, or digital watermarks.`
  ].join(' ');

  const startFramePrompt = [
    `Vertical 9:16 keyframe image. Target resolution 360p.`,
    `${cinema.shotType}, ${cinema.angle} of ${visualDescription.replace(/\.$/, '')}.`,
    `Characters: ${cinema.characterBiometrics}`,
    `Shot on Arri Alexa LF with ${cinema.focalLength}, f/2.0 aperture.`,
    `Prestige reality mystery aesthetic, crisp focus, rich tactile textures, natural skin pores, moody atmospheric lighting.`
  ].join(' ');

  return { videoPrompt, startFramePrompt, cinematography: cinema };
}

/**
 * Parses markdown screenplay or clip plan text into a structured result
 */
export function parseManuscriptMarkdown(rawMarkdown: string): ParsedScriptResult {
  const validation = validateManuscript(rawMarkdown);
  if (!validation.isValid) {
    throw new Error(`Manuscript validation failed:\n• ${validation.errors.join('\n• ')}`);
  }

  const lines = rawMarkdown.split('\n');

  let title = "Untitled Manuscript";
  let episodeTitle = "Episode 1";
  let format: 'short' | 'long' = 'short';
  let totalDurationSeconds = 48;
  let genre = "Drama / Narrative";
  let corePremise = "Episodic story arc";
  let languageRule = "Preserve character and narrative continuity.";
  let targetResolution = "360p, text-to-video";
  
  const productionNotes: string[] = [];
  const seriesRoadmap: SeriesEpisode[] = [];
  const clips: ParsedClip[] = [];

  let inProductionNotes = false;
  let inRoadmap = false;
  let currentClipNumber: number | null = null;
  let currentClipTitle = "";
  let currentClipTimecode = "";
  let currentVoiceOver = "";
  let currentVisual = "";

  const commitCurrentClip = () => {
    if (currentClipNumber !== null && currentVoiceOver && currentVisual) {
      // Calculate start and end seconds
      let startSeconds = (currentClipNumber - 1) * 4;
      let endSeconds = currentClipNumber * 4;
      const tcMatch = currentClipTimecode.match(/(\d+):(\d+)[–-](\d+):(\d+)/);
      if (tcMatch) {
        startSeconds = parseInt(tcMatch[1], 10) * 60 + parseInt(tcMatch[2], 10);
        endSeconds = parseInt(tcMatch[3], 10) * 60 + parseInt(tcMatch[4], 10);
      }
      const durationSeconds = Math.max(1, endSeconds - startSeconds);

      const { videoPrompt, startFramePrompt, cinematography } = buildEnhancedVideoPrompt(
        currentClipNumber,
        currentVisual,
        currentVoiceOver
      );

      clips.push({
        clipNumber: currentClipNumber,
        title: currentClipTitle || `Clip ${currentClipNumber}`,
        timecodeRange: currentClipTimecode || `0:${String(startSeconds).padStart(2, '0')}–0:${String(endSeconds).padStart(2, '0')}`,
        startSeconds,
        endSeconds,
        durationSeconds,
        voiceOver: currentVoiceOver.trim(),
        visualDescription: currentVisual.trim(),
        cameraMovement: cinematography.movement,
        shotType: cinematography.shotType,
        cameraAngle: cinematography.angle,
        soundCue: cinematography.soundCue,
        videoPrompt,
        startFramePrompt,
      });
    }
    currentClipNumber = null;
    currentClipTitle = "";
    currentClipTimecode = "";
    currentVoiceOver = "";
    currentVisual = "";
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Title parsing
    if (line.startsWith('# ') && !line.startsWith('## ')) {
      title = line.replace(/^#\s+/, '').trim();
    } else if (line.startsWith('## Episode') || (line.startsWith('## ') && line.includes('Episode'))) {
      episodeTitle = line.replace(/^##\s+/, '').trim();
    }

    // Metadata lines
    if (line.toLowerCase().includes('**format:**')) {
      if (line.toLowerCase().includes('16:9') || line.toLowerCase().includes('landscape') || line.toLowerCase().includes('long')) {
        format = 'long';
      } else {
        format = 'short';
      }
    }
    if (line.toLowerCase().includes('**target duration:**')) {
      const match = line.match(/(\d+)\s*sec/i);
      if (match) totalDurationSeconds = parseInt(match[1], 10);
    }
    if (line.toLowerCase().includes('**genre:**')) {
      genre = line.split('**genre:**')[1]?.trim() || genre;
    }
    if (line.toLowerCase().includes('**generation target:**')) {
      targetResolution = line.replace(/\*\*generation target:\*\*/i, '').trim();
    }
    if (line.toLowerCase().includes('**language rule:**')) {
      languageRule = line.replace(/\*\*language rule:\*\*/i, '').trim();
    }

    // Section triggers
    if (line.startsWith('## Production notes') || line.startsWith('### Production notes')) {
      commitCurrentClip();
      inProductionNotes = true;
      inRoadmap = false;
      continue;
    }
    if (line.startsWith('## Series roadmap') || line.startsWith('### Series roadmap')) {
      commitCurrentClip();
      inProductionNotes = false;
      inRoadmap = true;
      continue;
    }

    // Clip parsing: ### Clip 1 — The hook (0:00–0:04)
    const clipHeaderMatch = line.match(/^###\s+Clip\s+(\d+)(?:\s*[:—–-]\s*([^(]+))?(?:\s*\(([^)]+)\))?/i);
    if (clipHeaderMatch) {
      commitCurrentClip();
      inProductionNotes = false;
      inRoadmap = false;
      currentClipNumber = parseInt(clipHeaderMatch[1], 10);
      currentClipTitle = clipHeaderMatch[2]?.trim() || '';
      currentClipTimecode = clipHeaderMatch[3]?.trim() || '';
      continue;
    }

    if (currentClipNumber !== null) {
      if (line.startsWith('**Voice-over:**') || line.startsWith('**Voiceover:**')) {
        currentVoiceOver = line.replace(/\*\*Voice-?over:\*\*\s*/i, '').replace(/^["“”]/, '').replace(/["“”]$/, '').trim();
      } else if (line.startsWith('**Visual:**')) {
        currentVisual = line.replace(/\*\*Visual:\*\*\s*/i, '').trim();
      } else if (currentVisual && line && !line.startsWith('**') && !line.startsWith('###')) {
        currentVisual += ' ' + line;
      }
    }

    // Production notes collecting
    if (inProductionNotes && line.startsWith('- ')) {
      productionNotes.push(line.replace(/^- /, '').trim());
    }

    // Series roadmap collecting: 1. **Episode 1 — Twelve Suspects:** Introduce...
    if (inRoadmap) {
      const epMatch = line.match(/^(\d+)\.\s+\*\*Episode\s+(\d+)\s*[—–-]\s*([^:*]+)[:*]+\s*(.*)$/i);
      if (epMatch) {
        seriesRoadmap.push({
          episodeNumber: parseInt(epMatch[2], 10),
          title: `Episode ${epMatch[2]} — ${epMatch[3].trim()}`,
          description: epMatch[4].trim(),
          status: parseInt(epMatch[2], 10) === 1 ? 'completed' : 'planned',
        });
      }
    }
  }

  commitCurrentClip();

  // If roadmap wasn't parsed from markdown, provide default 11 episodes
  if (seriesRoadmap.length === 0) {
    const defaultEpisodes = [
      { ep: 1, title: 'Twelve Suspects', desc: 'Introduce the prize, rules, contestants’ paranoia, and first-vote cliffhanger.' },
      { ep: 2, title: 'The First Name', desc: 'Reveal the first eliminated contestant and show how the vote creates alliances.' },
      { ep: 3, title: 'The Perfect Act', desc: 'A confident contestant becomes the new target after a suspicious conversation.' },
      { ep: 4, title: 'The Private Interviews', desc: 'Conflicting confessions make the contestants doubt their own theories.' },
      { ep: 5, title: 'The Alliance', desc: 'Several contestants agree to protect one another, but one secretly breaks the deal.' },
      { ep: 6, title: 'The Wrong Suspect', desc: 'The group eliminates someone they are certain is the outsider.' },
      { ep: 7, title: 'The Pattern', desc: 'A contestant notices that everyone seems to be hiding the same kind of fear.' },
      { ep: 8, title: 'The House Turns', desc: 'An argument fractures the remaining alliances, and the vote becomes personal.' },
      { ep: 9, title: 'No One Trusts Anyone', desc: 'The contestants are close to the final two, but their theories contradict one another.' },
      { ep: 10, title: 'Two Remain', desc: 'The final vote leaves two contestants facing the prize briefcase.' },
      { ep: 11, title: 'The Real Twist', desc: 'The host reveals that every contestant believed he was the outsider.' },
    ];
    defaultEpisodes.forEach((d) => {
      seriesRoadmap.push({
        episodeNumber: d.ep,
        title: `Episode ${d.ep} — ${d.title}`,
        description: d.desc,
        status: d.ep === 1 ? 'completed' : 'planned',
      });
    });
  }

  // Construct Style Profile
  const styleProfile: StyleProfile = {
    artStyle: "Prestige reality mystery cinematography, razor-sharp 4K digital broadcast, natural skin textures, genuine fabric weave and material tactility",
    colorPalette: "Deep obsidian shadows, 3200K warm interior architectural glow, stark 5600K exterior midnight glass reflections, spotlight punch on silver and metallic props",
    lighting: "High-contrast directional lighting, subtle key lights carving jawlines and cheekbones, moody perimeter shadow pools with dramatic rim-light separation",
    eraAndSetting: "Contemporary luxury secluded architectural mansion, minimalist glass portico, soundproofed wood-slat confessional booths, underground voting chamber",
    lensAndFilmStock: "35mm and 50mm cinema prime lenses, f/2.0 aperture, gentle natural depth of field, Arri Alexa Mini LF broadcast profile",
  };

  // Construct Character Sheet
  const characterSheet: Record<string, string> = {
    "Twelve Male Contestants": "Diverse cast of 12 men in their late 20s to mid-30s. Each possessing fixed biometric facial structure, groomed hair, bespoke luxury casual attire (merino knits, linen shirts, tailored dark denim), guarded eye contact, and subtle involuntary stress micro-gestures.",
    "The Enigmatic Host": "Charismatic game show host in his early 40s. Immaculate charcoal tailored three-piece suit, crisp white collar, neatly parted dark hair with silver-touched temples. Calculating composure, piercing observant gaze, enigmatic wry half-smile.",
    "Contestant A (First Confession)": "Late 20s, athletic frame, short dark fade, wearing a fitted olive green henley. Constantly glances nervously toward the closed confessional door while whispering.",
    "Contestant B (Second Confession)": "Early 30s, lean build, tousled brown curls, tortoise-shell reading spectacles, charcoal turtleneck. Anxiously twists a brushed silver band around his left ring finger.",
    "Contestant C (Third Confession)": "Mid 30s, broad-shouldered with trimmed stubble beard, structured dark indigo denim overshirt. Intense, wide-eyed stare fixed straight into the interview camera lens.",
  };

  // Construct Location Sheet
  const locationSheet: Record<string, string> = {
    "Mansion Entrance & Glass Portico": "Towering dual glass entrance doors surrounded by black basalt stone walls, illuminated by sharp vertical LED channel uplights cutting through the night.",
    "The Briefcase Stage": "Elevated circular black stage inside an expansive gallery hall, solitary aluminum flight briefcase beneath an intense overhead spotlight.",
    "The Great Dining Table": "Massive smoked glass and walnut banquet table surrounded by 12 sleek minimalist chairs, reflecting amber wall sconces and moody darkness.",
    "The Confessional Interview Room": "Intimate soundproofed interrogation booth with vertical acoustic oak slats, warm directional softbox key light, single stool facing a matte-black wall-mounted cinema camera.",
    "The Elimination Voting Chamber": "Underground circular voting room with moody subterranean slate walls, a central glowing ballot receptacle, and a towering blurred LED display screen.",
  };

  // Construct Scenes & Beats
  const scenes: Scene[] = clips.map((clip) => {
    const beat: Beat = {
      beatIndex: 1,
      textSpan: clip.voiceOver,
      imagePrompt: clip.videoPrompt,
      estimatedSeconds: clip.durationSeconds,
      shotType: clip.shotType,
      cameraAngle: clip.cameraAngle,
      cameraMovement: clip.cameraMovement,
      soundCue: clip.soundCue,
      optics: `${clip.shotType}, 9:16 vertical orientation, f/2.0 cinema prime`,
      depicts: clip.visualDescription,
    };

    return {
      index: clip.clipNumber,
      narratorLine: clip.voiceOver,
      estimatedSeconds: clip.durationSeconds,
      beats: [beat],
      videoPrompt: clip.videoPrompt,
      startFramePrompt: clip.startFramePrompt,
      establishedCharacters: clip.clipNumber === 3 || clip.clipNumber === 11 || clip.clipNumber === 12
        ? ["The Enigmatic Host", "Twelve Male Contestants"]
        : ["Twelve Male Contestants"],
      establishedSettings: [clip.title],
    };
  });

  // Construct Story Bible
  const storyBible: StoryBible = {
    cast: [
      { id: "contestants_12", role: "Contestants", visualLock: characterSheet["Twelve Male Contestants"] },
      { id: "host", role: "Game Host", visualLock: characterSheet["The Enigmatic Host"] },
    ],
    threat: {
      canonicalLook: "Paranoia and psychological vulnerability: every contestant believes he alone is the imposter.",
      allowedVariants: ["Whispered alliances", "Secret confessional admissions", "Silent judging across the dinner table"],
    },
    locations: Object.entries(locationSheet).map(([id, visualLock]) => ({ id, visualLock })),
    motifs: [
      { id: "briefcase", description: "Polished aluminum briefcase containing one million dollars in cash beneath spotlight" },
      { id: "locked_doors", description: "Heavy modern glass and steel doors locking the contestants inside" },
      { id: "confessional_camera", description: "Solo high-resolution interview camera recording private confessions" },
      { id: "voting_box", description: "Glowing biometric ballot depository in the subterranean voting chamber" },
    ],
    events: clips.map((c) => `Clip ${c.clipNumber}: ${c.title} — ${c.voiceOver}`),
    referents: [
      { phrase: "one outsider", concreteEntity: "The hidden contestant", visualDepiction: "Every single contestant secretly convinced he is the sole outsider" },
      { phrase: "wrong game", concreteEntity: "The host's psychological revelation", visualDepiction: "Host looking into the lens with a knowing grin before blackout" },
    ],
    withheld: [
      "The full revelation that all 12 contestants are identical in orientation and none is actually an outsider",
      "Which contestant was voted out first",
    ],
    forbidden: [
      "The words 'gay' or 'straight' in any text, dialogue, subtitle, or generated visual label",
      "Subtitles or story sentences rendered directly inside video imagery",
      "Cartoony caricatures or non-photorealistic rendering",
    ],
    worldStyle: styleProfile.artStyle,
    assumptions: [
      "Format is Vertical 9:16 short-form video for mobile platforms (TikTok, Reels, Shorts)",
      "Each of the 12 scenes corresponds to a discrete 4-second clip for a 48-second total runtime",
      "Series spans 11 planned episodes tracking the contestants through eliminations",
      languageRule,
    ],
  };

  const storyResult: StoryGenerationResult = {
    title,
    totalDurationSeconds,
    styleProfile,
    characterSheet,
    locationSheet,
    scenes,
    generationMode: 'video',
    targetVideoDuration: 4,
    autoArchitectMode: false,
    hookAnalysis: {
      headlineHook: "Twelve men entered a million-dollar game to expose one outsider—but every single one believed he was that outsider.",
      hookType: "Identity & Counter-Intuitive Flip",
      hookRationale: "Instant psychological paradox in the first 4 seconds forces viewers to stay to see who confesses first.",
    },
    thumbnail: compileThumbnailPrompt({
      rawThumbnail: {
        heroMoment: "Twelve suspicious contestants surrounding the glowing voting chamber, eyes locked in mutual distrust",
        expression: "guarded, suspicious, and tightly coiled paranoia",
        bgDescription: "subterranean architectural glass chamber with dark obsidian shadow pools",
        accentColor: "spotlight amber",
        hookText: "THE HIDDEN OUTSIDER",
        fontStyle: "dossier stamp sans-serif with dramatic cast-shadow letterforms",
        alternateHooks: ["WHO BREAKS FIRST", "MILLION DOLLAR LIE"],
      },
      styleProfile,
      characterSheet,
      storyPremise: corePremise,
      format: 'short',
      platform: 'TikTok / Shorts / Reels',
    }),
    storyBible,
    assumptions: storyBible.assumptions,
    authorNotes: `Production Script for ${title} (${episodeTitle}). Format: 9:16 Vertical Video. 12 Clips @ 4s each. Total: 48s. Language constraint: Zero use of 'gay' or 'straight'.`,
    timingSource: 'actual',
    seriesRoadmap,
  };

  return {
    title,
    episodeTitle,
    format,
    totalDurationSeconds,
    generationMode: 'video',
    genre,
    corePremise,
    languageRule,
    targetResolution,
    productionNotes,
    seriesRoadmap,
    clips,
    storyResult,
  };
}

/**
 * Hardcoded bundle of Episode 1 manuscript for immediate zero-latency ingestion
 */
export const ATTACHED_EPISODE_1_MARKDOWN = `# The One Who Doesn't Belong
## Episode 1 — Twelve Suspects

**Format:** Vertical short-form video (9:16)  
**Target duration:** 48 seconds  
**Clip length:** 4 seconds each  
**Number of clips:** 12  
**Generation target:** 360p, text-to-video  
**Genre:** Social experiment, mystery, dark comedy

### Core premise

Twelve men are locked inside a luxurious house for a million-dollar game. Eleven believe they can identify the one man who doesn't share their romantic orientation, while that hidden contestant must survive the weekly vote. The twist: every contestant secretly believes *he* is the outsider. Nobody knows that the others believe the same thing.

**Language rule:** Do not use the labels “gay” or “straight” in narration, dialogue, on-screen text, or generated visuals. Let the premise be understood through the contestants’ beliefs, suspicious behavior, and the host’s rules.

## Episode 1 script and clip plan

### Clip 1 — The hook (0:00–0:04)
**Voice-over:** “Twelve men entered a million-dollar game to expose one outsider—but every single one believed he was that outsider.”

**Visual:** A huge modern mansion at night. Twelve male contestants stand in a line behind tall glass doors. A camera glides toward them as the doors lock.

### Clip 2 — The prize (0:04–0:08)
**Voice-over:** “They were promised one million dollars if they could vote him out before he reached the final two.”

**Visual:** A briefcase full of cash sits beneath a spotlight on a black stage. The contestants watch from the shadows.

### Clip 3 — The rules (0:08–0:12)
**Voice-over:** “Every week, they would question each other, search for clues, and eliminate one person.”

**Visual:** The host stands before a large digital countdown screen while the twelve contestants sit around a circular table.

### Clip 4 — The danger (0:12–0:16)
**Voice-over:** “If the hidden outsider survived until only two remained, he would take the entire prize.”

**Visual:** Two empty chairs are illuminated at the far end of the room. The briefcase rests between them.

### Clip 5 — The first suspicion (0:16–0:20)
**Voice-over:** “The moment the doors closed, the contestants began studying every word, glance, and gesture.”

**Visual:** Close-up montage: one contestant watches another across the dinner table; another forces a smile; a third notices and looks away.

### Clip 6 — Everyone has a theory (0:20–0:24)
**Voice-over:** “Each man had a different theory about who was pretending—and who was telling the truth.”

**Visual:** Three contestants whisper in separate corners of the mansion, each glancing suspiciously toward a different person.

### Clip 7 — A private confession (0:24–0:28)
**Voice-over:** “But behind a locked bedroom door, one contestant confessed that he was terrified of being discovered.”

**Visual:** A contestant speaks quietly into a private interview camera, repeatedly checking the closed door beside him.

### Clip 8 — The same secret (0:28–0:32)
**Voice-over:** “Across the hall, another man admitted the exact same fear.”

**Visual:** A second contestant sits alone in a dim interview room, nervously twisting a ring on his finger as he whispers to the camera.

### Clip 9 — The audience sees the pattern (0:32–0:36)
**Voice-over:** “Then a third made the same confession. None of them realized the others were doing it too.”

**Visual:** Rapid cuts between three separate interview rooms. Each contestant looks convinced he alone understands the secret.

### Clip 10 — The first vote (0:36–0:40)
**Voice-over:** “That night, the host announced the first vote—and suddenly, every friendship became a threat.”

**Visual:** The contestants enter a dark voting room one by one and place sealed ballots into a glowing box.

### Clip 11 — The name (0:40–0:44)
**Voice-over:** “One name appeared on the screen more than any other. The first contestant was about to lose everything.”

**Visual:** The host stands beside a large screen showing a blurred name. The contestants stare at it in tense silence.

### Clip 12 — Cliffhanger (0:44–0:48)
**Voice-over:** “But just before the result was revealed, the host smiled and said, ‘You’re all playing the wrong game.’”

**Visual:** The host looks directly into the camera with a knowing smile. The screen behind him flickers to black before the name is revealed.

## Production notes for StoryFrame

- Keep the same twelve contestants visually consistent across all clips: stable faces, hairstyles, clothing palettes, and body types.
- Use a polished reality-show atmosphere: mansion interiors, interview rooms, dramatic lighting, security cameras, and a prize briefcase.
- Keep each clip focused on one clear action. Avoid trying to show multiple complex events in a single four-second generation.
- No subtitles or story sentences rendered inside the video. Add narration in editing; if any on-screen text is needed, use only short production labels such as “WEEK 1” or “FIRST VOTE.”
- Do not reveal the full twist in Episode 1. The repeated private confessions should create suspicion without explaining the entire premise.
- End immediately after the host’s warning to encourage viewers to watch Episode 2.

## Series roadmap

**Recommended length: 11 episodes**, each under one minute.

1. **Episode 1 — Twelve Suspects:** Introduce the prize, rules, contestants’ paranoia, and first-vote cliffhanger.
2. **Episode 2 — The First Name:** Reveal the first eliminated contestant and show how the vote creates alliances.
3. **Episode 3 — The Perfect Act:** A confident contestant becomes the new target after a suspicious conversation.
4. **Episode 4 — The Private Interviews:** Conflicting confessions make the contestants doubt their own theories.
5. **Episode 5 — The Alliance:** Several contestants agree to protect one another, but one secretly breaks the deal.
6. **Episode 6 — The Wrong Suspect:** The group eliminates someone they are certain is the outsider.
7. **Episode 7 — The Pattern:** A contestant notices that everyone seems to be hiding the same kind of fear.
8. **Episode 8 — The House Turns:** An argument fractures the remaining alliances, and the vote becomes personal.
9. **Episode 9 — No One Trusts Anyone:** The contestants are close to the final two, but their theories contradict one another.
10. **Episode 10 — Two Remain:** The final vote leaves two contestants facing the prize briefcase.
11. **Episode 11 — The Real Twist:** The host reveals that every contestant believed he was the outsider. The real trick was that there was no actual outsider among them; the contestants had misunderstood the premise and projected their own fears onto one another.

**Continuity note:** The game’s rules and the host’s wording should be written carefully in later episodes so the final reveal feels like a deliberate social experiment rather than a random change to the rules.`;
