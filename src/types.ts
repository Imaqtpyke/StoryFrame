export type StoryFormat = 'short' | 'long';
export type GenerationMode = 'image' | 'video';

export interface StyleProfile {
  artStyle: string;
  colorPalette: string;
  lighting: string;
  eraAndSetting: string;
  lensAndFilmStock?: string;
}

export interface StoryBibleCastMember {
  id: string;
  role: string;
  visualLock: string;
}

export interface StoryBibleThreat {
  canonicalLook: string;
  allowedVariants: string[];
}

export interface StoryBibleLocation {
  id: string;
  visualLock: string;
}

export interface StoryBibleMotif {
  id: string;
  description: string;
}

export interface StoryBibleReferent {
  phrase: string;
  concreteEntity: string;
  visualDepiction: string;
}

export interface StoryBible {
  cast: StoryBibleCastMember[];
  threat: StoryBibleThreat;
  locations: StoryBibleLocation[];
  motifs: StoryBibleMotif[];
  events: string[];
  referents: StoryBibleReferent[];
  withheld: string[];
  forbidden: string[];
  worldStyle: string;
  assumptions: string[];
}

export interface Beat {
  beatIndex: number;
  textSpan: string;
  imagePrompt: string;
  estimatedSeconds: number;
  shotType?: string;
  cameraAngle?: string;
  cameraMovement?: string;
  visualSoundEffect?: string;
  temporalAnchor?: string;
  transitionHint?: string;
  soundCue?: string;
  optics?: string;
  wordRange?: [number, number];
  depicts?: string;
  kind?: 'literal' | 'figurative' | 'withheld-effect';
  referentId?: string;
  intensity?: 'low' | 'medium' | 'high';
  subjectIds?: string[];
  newInfo?: string;
  overlayText?: string;
  flaggedIssue?: string;
}

export interface Scene {
  index: number;
  narratorLine: string;
  estimatedSeconds: number;
  beats: Beat[];
  videoPrompt?: string;
  startFramePrompt?: string;
  establishedCharacters?: string[];
  establishedSettings?: string[];
  isAnchorScene?: boolean;
}

export interface StoryGenerationResult {
  totalDurationSeconds: number;
  styleProfile: StyleProfile;
  characterSheet: Record<string, string>;
  locationSheet: Record<string, string>;
  scenes: Scene[];
  generationMode?: GenerationMode;
  targetVideoDuration?: number;
  autoArchitectMode?: boolean;
  hookAnalysis?: {
    headlineHook?: string;
    hookType?: string;
    hookRationale?: string;
  };
  storyBible?: StoryBible;
  assumptions?: string[];
  authorNotes?: string;
  timingSource?: 'actual' | 'estimated';
}

export interface CustomBeatDefinition {
  id: string;
  textSpan: string;
  userGuidance?: string;
  shotType?: string;
  transitionHint?: string;
}

export interface CustomSceneDefinition {
  id: string;
  sceneIndex: number;
  narratorLine: string;
  beats: CustomBeatDefinition[];
}

export interface GenerateStoryRequest {
  story: string;
  characterStyle: string;
  format: StoryFormat;
  platform: string;
  durationMode: 'preset' | 'custom' | 'automatic';
  durationSeconds?: number;
  modelQuality?: 'standard' | 'high';
  generationMode: GenerationMode;
  targetVideoDuration?: number;
  beatMode?: 'automatic' | 'custom';
  customScenes?: CustomSceneDefinition[];
  autoArchitectMode?: boolean;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  storyTitle: string;
  request: GenerateStoryRequest;
  result: StoryGenerationResult;
}

export interface AssistantChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export type ActivePage = 'generator' | 'terms' | 'privacy' | 'guide' | 'byok-security';
