export type StoryFormat = 'short' | 'long';
export type GenerationMode = 'image' | 'video';

export interface StyleProfile {
  artStyle: string;
  colorPalette: string;
  lighting: string;
  eraAndSetting: string;
  lensAndFilmStock?: string;
}

export interface Beat {
  beatIndex: number;
  textSpan: string;
  imagePrompt: string;
  estimatedSeconds: number;
  shotType?: string;
  cameraAngle?: string;
  cameraMovement?: string;
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
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  storyTitle: string;
  request: GenerateStoryRequest;
  result: StoryGenerationResult;
}

export type ActivePage = 'generator' | 'terms' | 'privacy' | 'guide';
