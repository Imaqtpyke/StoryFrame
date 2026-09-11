export type StoryFormat = 'short' | 'long';

export interface StyleProfile {
  artStyle: string;
  colorPalette: string;
  lighting: string;
  eraAndSetting: string;
}

export interface Beat {
  beatIndex: number;
  textSpan: string;
  imagePrompt: string;
  estimatedSeconds: number;
  shotType?: string;
  cameraMovement?: string;
}

export interface Scene {
  index: number;
  narratorLine: string;
  estimatedSeconds: number;
  beats: Beat[];
}

export interface StoryGenerationResult {
  totalDurationSeconds: number;
  styleProfile: StyleProfile;
  characterSheet: Record<string, string>;
  scenes: Scene[];
}

export interface GenerateStoryRequest {
  story: string;
  characterStyle: string;
  format: StoryFormat;
  platform: string;
  durationMode: 'preset' | 'custom' | 'automatic';
  durationSeconds?: number;
  modelQuality?: 'standard' | 'high';
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  storyTitle: string;
  request: GenerateStoryRequest;
  result: StoryGenerationResult;
}

export type ActivePage = 'generator' | 'terms' | 'privacy';
