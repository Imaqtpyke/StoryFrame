/**
 * Negative Control Test
 * Verifies that Stage 0 and Stage 4 code checks correctly CATCH and FAIL on
 * defects 1, 2, 5, and 6 when run against the failing shotlist.
 */

import { StoryBible } from '../types';
import { WrittenPromptBeat } from '../services/stage3PromptWriter';
import {
  verifyBeatCodeChecks,
  verifyTextLeaks,
  verifySubjectAndGrammar,
  verifyNearDuplicates,
  verifyForbiddenElements,
} from '../services/stage4VerifyRepair';

export function runNegativeControlSuite(): { passed: boolean; results: string[] } {
  const results: string[] = [];

  const mockBible: StoryBible = {
    cast: [
      { id: 'traveler', role: 'Messenger', visualLock: 'exhausted lone traveler in rain-drenched woolen cloak' },
      { id: 'priest', role: 'Parish priest', visualLock: 'elderly priest in worn robes holding bronze lantern' },
      { id: 'boy', role: 'Milk-white boy', visualLock: 'pale child with bare feet and hollow eyes' },
    ],
    threat: {
      canonicalLook: 'risen dead with pallid skin and dull grey unblinking gaze',
      allowedVariants: ['dirt-encrusted hands', 'shroud-wrapped figures'],
    },
    locations: [
      { id: 'ravenhollow_church', visualLock: 'ancient stone village church with cold flagstones' },
      { id: 'mass_grave', visualLock: 'waterlogged mud trench in churchyard' },
    ],
    motifs: [{ id: 'coffin_scratching', description: 'pine wood clawed from within' }],
    events: ['Traveler arrives', 'Priest opens doors', 'Dead rise'],
    referents: [
      {
        phrase: 'the worst thing God could send them. They were wrong.',
        concreteEntity: 'risen dead',
        visualDepiction: 'first glimpses of decaying hands breaking through cemetery mud',
      },
    ],
    withheld: ['The ancient entity that summoned the dead from the ground'],
    forbidden: [
      '20-foot clawed shadow',
      'black vortex',
      'demonic silhouettes',
      'chalked plague cross',
      'bottle-glass',
    ],
    worldStyle: 'photographic 35mm atmospheric film look, muted ochre and cold slate palette',
    assumptions: ['Villagers wear 14th century peasant tunics'],
  };

  // Failing shotlist exhibiting Defects 1, 2, 5, and 6
  const failingBeats: WrittenPromptBeat[] = [
    // Defect 1: Narration leak in quotes and on-screen text requesting "1348"
    {
      beatIndex: 1,
      wordRange: [0, 8],
      textSpan: 'In the autumn of 1348 the villagers',
      depicts: 'Villagers huddled near church',
      kind: 'literal',
      intensity: 'low',
      subjectIds: ['villagers'],
      shotSize: 'wide',
      angle: 'eye level',
      newInfo: 'Establishing village',
      overlayText: '1348',
      estimatedSeconds: 2.0,
      imagePrompt: 'Wide establishing shot with on-screen text reading "1348" displayed above the village square. Distinct visual progression capturing "was the worst" pestilence.',
    },
    // Defect 2: Subject-less prompt starting mid-clause with detached body part
    {
      beatIndex: 2,
      wordRange: [9, 14],
      textSpan: 'shoulders slumped forward in despair',
      depicts: 'Slumped posture',
      kind: 'literal',
      intensity: 'medium',
      subjectIds: ['traveler'],
      shotSize: 'medium',
      angle: 'eye level',
      newInfo: 'Fatigue',
      estimatedSeconds: 1.5,
      imagePrompt: 'shoulders slumped forward at a 30-degree slouch, trembling against the cold rain in the dark alleyway.',
    },
    // Defect 5: Near-duplicate with Beat 4 (high shingle similarity)
    {
      beatIndex: 3,
      wordRange: [15, 20],
      textSpan: 'Father Thomas raised the bronze lantern',
      depicts: 'Priest with lantern',
      kind: 'literal',
      intensity: 'medium',
      subjectIds: ['priest'],
      shotSize: 'medium',
      angle: 'eye level',
      newInfo: 'Lantern raised',
      estimatedSeconds: 2.0,
      imagePrompt: 'Medium shot of an elderly priest raising a bronze lantern inside the cold dark stone nave of the church as mist rolls through the doorway.',
    },
    {
      beatIndex: 4,
      wordRange: [21, 26],
      textSpan: 'inside the cold dark nave',
      depicts: 'Priest inside church',
      kind: 'literal',
      intensity: 'medium',
      subjectIds: ['priest'],
      shotSize: 'medium',
      angle: 'eye level',
      newInfo: 'Same nave',
      estimatedSeconds: 2.0,
      imagePrompt: 'Medium shot of an elderly priest raising a bronze lantern inside the cold dark stone nave of the church as mist rolls across the floor.',
    },
    // Defect 6: Invented content (20-foot clawed shadow and black vortex)
    {
      beatIndex: 5,
      wordRange: [27, 34],
      textSpan: 'as the church bell tolled in the night',
      depicts: 'Tower and mysterious caller',
      kind: 'withheld-effect',
      intensity: 'high',
      subjectIds: ['church'],
      shotSize: 'wide',
      angle: 'low',
      newInfo: 'Bell tower',
      estimatedSeconds: 2.5,
      imagePrompt: 'Low angle framing of the stone church bell tower where a 20-foot clawed shadow and a swirling black vortex emerge from the clouds, summoning the dead.',
    },
  ];

  // Test Defect 1: Narration leak detection
  const checkDefect1 = verifyTextLeaks(failingBeats[0]);
  const failedDefect1 = !checkDefect1.passed && checkDefect1.issues.some((i) => i.includes('quotation marks') || i.includes('on-screen text') || i.includes('1348'));
  results.push(`Defect 1 (Narration & On-Screen Leak): ${failedDefect1 ? 'PASSED (Properly caught defect)' : 'FAILED (Did not catch leak)'}`);

  // Test Defect 2: Subject-less prompt detection
  const checkDefect2 = verifySubjectAndGrammar(failingBeats[1], mockBible);
  const failedDefect2 = !checkDefect2.passed && checkDefect2.issues.some((i) => i.includes('lowercase') || i.includes('bare pronoun or detached body part'));
  results.push(`Defect 2 (Subject-less prompt starting mid-clause): ${failedDefect2 ? 'PASSED (Properly caught defect)' : 'FAILED (Did not catch subject-less start)'}`);

  // Test Defect 5: Near-duplicate detection
  const checkDefect5 = verifyNearDuplicates(failingBeats[2], failingBeats);
  const failedDefect5 = !checkDefect5.passed && checkDefect5.issues.some((i) => i.includes('shingle similarity'));
  results.push(`Defect 5 (Near-duplicate beats in scene): ${failedDefect5 ? 'PASSED (Properly caught near-duplicate)' : 'FAILED (Missed near-duplicate)'}`);

  // Test Defect 6: Invented content detection
  const checkDefect6 = verifyForbiddenElements(failingBeats[4], mockBible);
  const failedDefect6 = !checkDefect6.passed && checkDefect6.issues.some((i) => i.includes('clawed shadow') || i.includes('black vortex'));
  results.push(`Defect 6 (Invented content / forbidden elements): ${failedDefect6 ? 'PASSED (Properly caught invented tropes)' : 'FAILED (Missed invented content)'}`);

  const allNegativeControlsPassed = failedDefect1 && failedDefect2 && failedDefect5 && failedDefect6;
  return { passed: allNegativeControlsPassed, results };
}
