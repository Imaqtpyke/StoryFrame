import { Scene, Beat, StoryFormat } from '../types';

export interface PacingMetrics {
  wordCount: number;
  allocatedSeconds: number;
  idealSeconds: number;
  wordsPerMinute: number;
  status: 'balanced' | 'rushed' | 'relaxed';
  differenceSeconds: number;
}

/**
 * Calculates narration pacing metrics based on standard voiceover speaking rate.
 * Standard conversational/narration rate is ~140 words per minute (2.33 words/sec).
 */
export function calculatePacing(narration: string, allocatedSeconds: number): PacingMetrics {
  const words = narration.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const safeAllocated = Math.max(0.5, allocatedSeconds);
  const wordsPerMinute = Math.round((wordCount / safeAllocated) * 60);
  const idealSeconds = Math.round((wordCount / 2.33) * 10) / 10;
  const differenceSeconds = Math.round((allocatedSeconds - idealSeconds) * 10) / 10;

  let status: 'balanced' | 'rushed' | 'relaxed' = 'balanced';
  if (wordsPerMinute > 175) {
    status = 'rushed';
  } else if (wordsPerMinute < 90 && wordCount > 3) {
    status = 'relaxed';
  }

  return {
    wordCount,
    allocatedSeconds: safeAllocated,
    idealSeconds,
    wordsPerMinute,
    status,
    differenceSeconds,
  };
}

/**
 * Converts seconds to timecode format: HH:MM:SS:FF (at 24 or 30 fps)
 */
function secondsToSMPTE(seconds: number, fps: number = 24): string {
  const totalFrames = Math.round(seconds * fps);
  const frames = totalFrames % fps;
  const totalSeconds = Math.floor(totalFrames / fps);
  const secs = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const mins = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(mins)}:${pad(secs)}:${pad(frames)}`;
}

/**
 * Converts seconds to SRT subtitle timestamp: HH:MM:SS,mmm
 */
function secondsToSRTTime(seconds: number): string {
  const totalMs = Math.round(seconds * 1000);
  const ms = totalMs % 1000;
  const totalSeconds = Math.floor(totalMs / 1000);
  const secs = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const mins = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  const pad = (n: number, w: number = 2) => String(n).padStart(w, '0');
  return `${pad(hours)}:${pad(mins)}:${pad(secs)},${pad(ms, 3)}`;
}

/**
 * Generates industry-standard CMX 3600 Edit Decision List (EDL)
 * Compatible with Adobe Premiere Pro, DaVinci Resolve, and Final Cut Pro.
 */
export function generateCMX3600EDL(
  scenes: Scene[],
  title: string = 'STORYBOARD_SEQUENCE',
  fps: number = 24
): string {
  const lines: string[] = [];
  lines.push(`TITLE: ${title.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}`);
  lines.push('FCM: NON-DROP FRAME');
  lines.push('');

  let eventNumber = 1;
  let recordTime = 3600; // Standard 01:00:00:00 timeline start

  scenes.forEach((scene) => {
    const beats = scene.beats && scene.beats.length > 0 ? scene.beats : [];

    if (beats.length === 0) {
      // Scene level event
      const duration = scene.estimatedSeconds || 5;
      const srcIn = 0;
      const srcOut = duration;
      const recIn = recordTime;
      const recOut = recordTime + duration;
      recordTime = recOut;

      const numStr = String(eventNumber).padStart(3, '0');
      lines.push(`${numStr}  AX       V     C        ${secondsToSMPTE(srcIn, fps)} ${secondsToSMPTE(srcOut, fps)} ${secondsToSMPTE(recIn, fps)} ${secondsToSMPTE(recOut, fps)}`);
      lines.push(`* FROM CLIP NAME: SCENE_${scene.index}`);
      lines.push(`* COMMENT: ${scene.narratorLine.replace(/[\r\n]+/g, ' ').slice(0, 100)}`);
      lines.push('');
      eventNumber++;
    } else {
      beats.forEach((beat) => {
        const duration = Math.max(1, beat.estimatedSeconds || 2);
        const srcIn = 0;
        const srcOut = duration;
        const recIn = recordTime;
        const recOut = recordTime + duration;
        recordTime = recOut;

        const numStr = String(eventNumber).padStart(3, '0');
        const clipName = `SCENE_${scene.index}_BEAT_${beat.beatIndex}`;
        lines.push(`${numStr}  AX       V     C        ${secondsToSMPTE(srcIn, fps)} ${secondsToSMPTE(srcOut, fps)} ${secondsToSMPTE(recIn, fps)} ${secondsToSMPTE(recOut, fps)}`);
        lines.push(`* FROM CLIP NAME: ${clipName}`);
        lines.push(`* SHOT TYPE: ${beat.shotType || 'Medium Shot'} | CAMERA: ${beat.cameraMovement || 'Static'}`);
        lines.push(`* DIALOGUE: ${beat.textSpan.replace(/[\r\n]+/g, ' ').slice(0, 90)}`);
        lines.push(`* PROMPT: ${beat.imagePrompt.replace(/[\r\n]+/g, ' ').slice(0, 120)}`);
        lines.push('');
        eventNumber++;
      });
    }
  });

  return lines.join('\r\n');
}

/**
 * Generates standard SRT Subtitle file for the spoken narration across all beats/scenes
 */
export function generateSRTSubtitles(scenes: Scene[]): string {
  const srtBlocks: string[] = [];
  let currentTime = 0;
  let subtitleIndex = 1;

  scenes.forEach((scene) => {
    const beats = scene.beats && scene.beats.length > 0 ? scene.beats : [];

    if (beats.length === 0) {
      const duration = scene.estimatedSeconds || 5;
      const startTime = currentTime;
      const endTime = currentTime + duration;
      currentTime = endTime;

      if (scene.narratorLine && scene.narratorLine.trim()) {
        srtBlocks.push(`${subtitleIndex}\n${secondsToSRTTime(startTime)} --> ${secondsToSRTTime(endTime)}\n${scene.narratorLine.trim()}\n`);
        subtitleIndex++;
      }
    } else {
      beats.forEach((beat) => {
        const duration = Math.max(1, beat.estimatedSeconds || 2);
        const startTime = currentTime;
        const endTime = currentTime + duration;
        currentTime = endTime;

        const text = beat.textSpan && beat.textSpan.trim() ? beat.textSpan.trim() : scene.narratorLine.trim();
        if (text) {
          srtBlocks.push(`${subtitleIndex}\n${secondsToSRTTime(startTime)} --> ${secondsToSRTTime(endTime)}\n${text}\n`);
          subtitleIndex++;
        }
      });
    }
  });

  return srtBlocks.join('\n');
}
