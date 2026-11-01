# StoryFrame: Beat Progression and Dedup Fix

## 0. What the exported file actually shows

1. **The prose is copied, the camera labels are rotated.** Every duplicate run has the same three-step rotation of metadata, regardless of content:
   - `Medium Shot / high-angle / Micro Rack Focus`
   - `Close-Up Detail / low-angle / Tracking Subject`
   - `Over-the-Shoulder / birds-eye / Subtle Handheld Drift`
   - `Low-Angle Hero Shot / worms-eye / Smooth Pan Across`

   The prose never changes, so the labels contradict it (Scene II Beat 2 says "Medium Shot, high-angle" but the prose says "Close-up of a weathered wooden door"). This is a code path, not a model failure: a variation table keyed to the camera preset prepends a filler sentence ("The altered environment.", "Emphasizing grounded scale.", "Focusing on tactile textures.", "Vantage perspective looking down across the scene.", "Reaction angle focusing on physical interaction.") onto the previous beat's text.
2. **The Character Continuity Sheet contains a frozen pose** (weight 55/45, wrist 20 degrees, right hand clutching Nokia). That pose gets pasted into every prompt with the Student, even when the beat is a notebook (Scene I Beat 1 has him holding a notebook with the "Nokia pose" numbers). Identity must be locked; pose must be per beat.
3. **Degenerate output:** Scene VII Beat 5 is `"Extreme."` with empty spoken words. Several prompts end with `ar 9:16., ar 9:16` (suffix appended twice).
4. **Scene headers do not match beat sums.** Scene II says ~3s, beats sum to 4.3s. Scene III says ~3s, beats sum to 6.0s. Scene VII says ~4s, beats sum to 5.4s.
5. **Root cause upstream:** the model is given the whole scene premise as the dominant context for every beat, so it re-describes the premise. Fix by giving the prompt writer only its own beat's moment.

Fix order: delete the variation table first, then everything below.

---

## 1. Architecture: split planning from writing

```
Pass A  Scene Director (JSON only, no image prose)
        -> entity state ladders + beat plan (moment per beat, or REUSE)
Pass B  Beat Writer (one call per NEW_IMAGE beat, or batched)
        -> sees ONLY: this beat's moment, previous beat's moment, identity locks for entities in frame
Code    validate -> dedupe -> merge/reuse -> compose final prompt (camera words come from fields, never from prose)
```

Rules for code:
- Framing words (shot size, angle, lens) are rendered from structured fields. Your existing `sanitizeImagePromptShotFraming` stays and is run on Pass B output.
- The style suffix and `--ar` are appended once by `composePrompt`, never by the model.

---

## 2. Pass A system prompt (Scene Director)

```text
You are the Scene Director of a short-form vertical video storyboard system. You do NOT write image prompts. You plan physical progression.

INPUT: scene narration (with word timings), story bible, character and location sheets.

STEP 1. STATE LADDERS
List every entity that physically changes in this scene (objects, characters' body or position, light sources, screens, doors). For each, write an ordered ladder of 3 to 6 states from first appearance to last. States are concrete and visible, never moods.
Example: door: ["closed","hand_on_knob","cracked_open","swung_wide"]

STEP 2. BEAT PLAN
Split the narration into beats. Each beat is exactly one of:
 - NEW_IMAGE: a distinct physical moment in time.
 - REUSE_PREVIOUS: no new visual information; reuse the previous image with a treatment (punch_in, slow_push, pan, hold). Use this when a phrase is only a continuation of the same moment.

For every NEW_IMAGE beat output:
 - action: ONE transition, written as a verb phrase ("Student's hand turns the knob").
 - states: ladder index of every entity visible in frame at the instant of the frame.
 - focus: the entity the frame is about.
 - shot, angle, cameraMove.
 - newInfo: what the viewer learns in this frame that they did not know in the previous one.
 - contrast: which axes differ from the previous NEW_IMAGE beat (state, focus, shot, angle, subject).

HARD RULES
 R1. Time moves forward. Within a scene, ladder indices never decrease unless the narration explicitly reverses (flashback, rewind).
 R2. Every NEW_IMAGE beat must change at least one ladder index OR change the focus entity. A different camera angle on the same state and same focus is NOT a new beat; use REUSE_PREVIOUS.
 R3. Never return to a framing already used by the previous 2 beats (same focus + same shot size).
 R4. Alternate scale: after a CU or ECU, the next NEW_IMAGE should be MS, WS, OTS, POV, or a different focus. Do not stack 3 close-ups.
 R5. Abstract narration ("parang may nangyaring kung ano", "ramdam ko") must be converted into a concrete observable: a reaction, a detail, an environment change, or an insert. Do not invent plot events that are not in the narration.
 R6. A beat under 0.9s should be REUSE_PREVIOUS unless it carries a hard state change (door slam, screen lights up).
 R7. One action per beat. If you wrote "and" between two actions, split or drop one.
 R8. Never output prose describing lighting, style, lens, or the scene premise. Those are added by code.
 R9. Never name real people.

OUTPUT: JSON matching the provided schema. No commentary.
```

### Pass A response schema (Gemini `responseSchema` or Groq JSON mode)

```ts
export const sceneDirectorSchema = {
  type: "object",
  properties: {
    entities: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          kind: { type: "string", enum: ["object", "character", "light", "environment"] },
          ladder: { type: "array", items: { type: "string" } },
        },
        required: ["id", "kind", "ladder"],
      },
    },
    beats: {
      type: "array",
      items: {
        type: "object",
        properties: {
          beatId: { type: "string" },
          spokenWords: { type: "string" },
          startSec: { type: "number" },
          endSec: { type: "number" },
          visualMode: { type: "string", enum: ["NEW_IMAGE", "REUSE_PREVIOUS"] },
          reuse: {
            type: "object",
            properties: {
              treatment: { type: "string", enum: ["punch_in", "slow_push", "pan", "hold"] },
            },
          },
          moment: {
            type: "object",
            properties: {
              action: { type: "string" },
              focus: { type: "string" },
              states: {
                type: "array", // array of pairs; many structured-output backends reject free-form maps
                items: {
                  type: "object",
                  properties: { entityId: { type: "string" }, index: { type: "integer" } },
                  required: ["entityId", "index"],
                },
              },
              shot: { type: "string", enum: ["EWS", "WS", "MS", "MCU", "CU", "ECU", "INSERT"] },
              angle: { type: "string", enum: ["eye", "high", "low", "dutch", "birds", "worms", "pov", "ots"] },
              cameraMove: { type: "string" },
              newInfo: { type: "string" },
              contrast: { type: "array", items: { type: "string", enum: ["state", "focus", "shot", "angle", "subject"] } },
            },
            required: ["action", "focus", "states", "shot", "angle", "cameraMove", "newInfo", "contrast"],
          },
        },
        required: ["beatId", "spokenWords", "startSec", "endSec", "visualMode"],
      },
    },
  },
  required: ["entities", "beats"],
};
```

---

## 3. Pass B system prompt (Beat Writer)

```text
You write ONE image prompt for ONE frozen instant of a vertical video.

You receive:
 - MOMENT: action, focus entity, entity states (already resolved to words), shot, angle.
 - PREVIOUS MOMENT: for continuity only. Do NOT describe it again.
 - IDENTITY LOCKS: face, hair, clothing for the characters in this frame only.
 - LOCATION LOCK.

Write 2 to 4 sentences describing only what is visible in the frame at the instant of MOMENT.action.
 - Start from the focus entity.
 - Show the CURRENT state of every entity listed (door position, phone position, screen on/off, hand position).
 - Do not mention anything that happens before or after this instant.
 - Do not write shot size, lens, camera angle, lighting setup, art style, aspect ratio, or text overlays. Code adds them.
 - Do not repeat any noun phrase from PREVIOUS MOMENT unless the entity is still in frame; if it is, describe its NEW state.
 - Never put the narration line, subtitles, numbers or years into the image.
 - No real people's names.
```

---

## 4. Few-shot: Scene III, wrong vs right

Narration: "Pagbukas ko, putla ang mama ko. Pinakita niya sa akin ang phone niya na ring nang ring."

**Wrong (what the pipeline produced):** beats 3 to 6 are all "Close-up of Mother's hands... Nokia 3310... screen glowing amber, the word RING pulsing."

**Right (Pass A output, abbreviated):**

```json
{
  "entities": [
    { "id": "door",   "kind": "object",    "ladder": ["closed", "hand_on_knob", "cracked_open", "swung_wide"] },
    { "id": "phone",  "kind": "object",    "ladder": ["held_close_by_mother", "extended_toward_son", "gripped_by_son"] },
    { "id": "screen", "kind": "object",    "ladder": ["off", "backlit_amber", "caller_id_unknown"] },
    { "id": "mother", "kind": "character", "ladder": ["standing_in_dark_hall", "arms_extended"] }
  ],
  "beats": [
    { "beatId": "S3B1", "spokenWords": "Pagbukas ko,", "startSec": 0, "endSec": 1.0, "visualMode": "NEW_IMAGE",
      "moment": { "action": "Student's hand turns the knob and the door cracks open", "focus": "door",
        "states": [{"entityId":"door","index":2}], "shot": "CU", "angle": "eye", "cameraMove": "static",
        "newInfo": "the door is opening", "contrast": ["subject"] } },
    { "beatId": "S3B2", "spokenWords": "putla ang mama ko.", "startSec": 1.0, "endSec": 2.4, "visualMode": "NEW_IMAGE",
      "moment": { "action": "through the gap, pale mother stands motionless in the dark hallway", "focus": "mother",
        "states": [{"entityId":"door","index":2},{"entityId":"mother","index":0}], "shot": "MS", "angle": "pov", "cameraMove": "slow push-in",
        "newInfo": "mother is the one outside, she is pale", "contrast": ["focus","shot","angle"] } },
    { "beatId": "S3B3", "spokenWords": "Pinakita niya sa", "startSec": 2.4, "endSec": 3.5, "visualMode": "NEW_IMAGE",
      "moment": { "action": "mother's arms extend forward holding her Nokia, screen dark", "focus": "phone",
        "states": [{"entityId":"mother","index":1},{"entityId":"phone","index":1},{"entityId":"screen","index":0}], "shot": "MCU", "angle": "ots", "cameraMove": "static",
        "newInfo": "she is offering the phone", "contrast": ["state","focus","shot"] } },
    { "beatId": "S3B4", "spokenWords": "akin ang phone", "startSec": 3.5, "endSec": 4.5, "visualMode": "NEW_IMAGE",
      "moment": { "action": "Student's hands take and grip the phone", "focus": "phone",
        "states": [{"entityId":"phone","index":2},{"entityId":"screen","index":0}], "shot": "CU", "angle": "high", "cameraMove": "static",
        "newInfo": "phone changes hands", "contrast": ["state","angle"] } },
    { "beatId": "S3B5", "spokenWords": "niya na ring", "startSec": 4.5, "endSec": 5.5, "visualMode": "NEW_IMAGE",
      "moment": { "action": "the screen lights amber showing an unknown number", "focus": "screen",
        "states": [{"entityId":"phone","index":2},{"entityId":"screen","index":2}], "shot": "ECU", "angle": "eye", "cameraMove": "snap focus",
        "newInfo": "an unknown caller is ringing", "contrast": ["state","shot"] } },
    { "beatId": "S3B6", "spokenWords": "nang ring.", "startSec": 5.5, "endSec": 6.3, "visualMode": "REUSE_PREVIOUS",
      "reuse": { "treatment": "punch_in" } }
  ]
}
```

Notes:
- The last phrase "nang ring." is a pure continuation of "ring nang ring". With 0.8s it becomes a punch-in on the previous image. If you want a new image, make it an INSERT (speaker grille vibrating, dust jumping off the casing); that is a different focus, so it passes R2.
- Door ladder indices 0 and 1 are skipped on purpose. Beat 1 starts at "cracked_open" because the viewer sees the result of the action.

---

## 5. Aggregation vs micro-splitting

You previously decided near-phrase-level beats are right for engagement. Keep that, but decouple **audio chunks** from **image count**:

| Condition | Decision |
|---|---|
| New action verb in the narration phrase | NEW_IMAGE |
| New concrete noun/object introduced | NEW_IMAGE |
| Speaker change or quoted dialogue | NEW_IMAGE (reaction or OTS) |
| Location or time jump | NEW_IMAGE (wide) |
| Emotional pivot ("biglang", "pero", "patay na") | NEW_IMAGE (reveal or insert) |
| Phrase is a continuation fragment ("nang ring.", "niya na ring") and duration < 1.2s | REUSE_PREVIOUS with punch_in or slow_push |
| Same state AND same focus as the previous beat | REUSE_PREVIOUS |
| Phrase is abstract ("parang may nangyaring kung ano") | NEW_IMAGE as a concrete insert or environment cue, not a repeat |

Budget heuristic: `maxNewImages = floor(sceneSeconds / 1.2)`. If Pass A returns more NEW_IMAGE beats than that, demote the lowest-`newInfo` beats to REUSE_PREVIOUS. In your 31.5s export that is about 26 images, not 30, and it removes exactly the repeats.

Reuse beats cost no image or prompt. They export with a `treatment` so the editor (CapCut, Premiere, your EDL export) can punch in.

---

## 6. TypeScript

```ts
// storyframe/beatProgression.ts

export type ShotSize = "EWS" | "WS" | "MS" | "MCU" | "CU" | "ECU" | "INSERT";
export type Angle = "eye" | "high" | "low" | "dutch" | "birds" | "worms" | "pov" | "ots";

export interface EntityTrack { id: string; kind: string; ladder: string[] }
export interface StateRef { entityId: string; index: number }

export interface Moment {
  action: string;
  focus: string;
  states: StateRef[];
  shot: ShotSize;
  angle: Angle;
  cameraMove: string;
  newInfo: string;
  contrast: string[];
}

export interface Beat {
  beatId: string;
  spokenWords: string;
  startSec: number;
  endSec: number;
  visualMode: "NEW_IMAGE" | "REUSE_PREVIOUS";
  reuse?: { treatment: "punch_in" | "slow_push" | "pan" | "hold"; ofBeatId?: string };
  moment?: Moment;
  imageCore?: string; // Pass B output
}

export interface Issue { beatId: string; code: string; detail: string }

// ---------- 6.1 structural validation (cheap, deterministic) ----------

const stateKey = (m: Moment) =>
  [...m.states].sort((a, b) => a.entityId.localeCompare(b.entityId))
    .map(s => `${s.entityId}:${s.index}`).join("|");

export function validateScene(entities: EntityTrack[], beats: Beat[]): Issue[] {
  const issues: Issue[] = [];
  const latest = new Map<string, number>();
  let prev: Beat | undefined;
  let prev2: Beat | undefined;

  for (const b of beats) {
    const dur = b.endSec - b.startSec;
    if (b.visualMode === "REUSE_PREVIOUS") { continue; }
    const m = b.moment;
    if (!m) { issues.push({ beatId: b.beatId, code: "NO_MOMENT", detail: "NEW_IMAGE without moment" }); continue; }

    // R1 monotonic state progression
    for (const s of m.states) {
      const ent = entities.find(e => e.id === s.entityId);
      if (!ent || s.index < 0 || s.index >= ent.ladder.length) {
        issues.push({ beatId: b.beatId, code: "BAD_STATE", detail: `${s.entityId}:${s.index}` });
        continue;
      }
      const last = latest.get(s.entityId);
      if (last !== undefined && s.index < last)
        issues.push({ beatId: b.beatId, code: "STATE_REGRESSION", detail: `${s.entityId} ${last}->${s.index}` });
      latest.set(s.entityId, Math.max(last ?? 0, s.index));
    }

    // R2 must change state or focus vs previous NEW_IMAGE
    if (prev?.moment) {
      const sameState = stateKey(prev.moment) === stateKey(m);
      const sameFocus = prev.moment.focus === m.focus;
      if (sameState && sameFocus)
        issues.push({ beatId: b.beatId, code: "NO_PROGRESSION", detail: "same state and focus as previous" });
    }

    // R3 no repeated framing within 2 beats
    for (const p of [prev, prev2]) {
      if (p?.moment && p.moment.focus === m.focus && p.moment.shot === m.shot)
        issues.push({ beatId: b.beatId, code: "REPEATED_FRAMING", detail: `${m.focus}/${m.shot}` });
    }

    // R6 too short to justify a new image
    if (dur < 0.9 && prev?.moment && stateKey(prev.moment) === stateKey(m))
      issues.push({ beatId: b.beatId, code: "TOO_SHORT", detail: `${dur.toFixed(1)}s` });

    if (!m.newInfo?.trim()) issues.push({ beatId: b.beatId, code: "NO_NEW_INFO", detail: "" });

    prev2 = prev; prev = b;
  }
  return issues;
}

// ---------- 6.2 semantic duplicate detection (prose level, backstop) ----------

const BOILER = [
  /shot on 35mm[^.]*\./gi, /vertical 9:16[^.]*\./gi, /\bar 9:16[.,]?/gi,
  /visual style:[^.]*\./gi, /crt scanlines[^.,]*/gi, /low[‑-]polygon ps1[^.,]*/gi,
];
const STOP = new Set("a an the of in on at to with and or as by for from is are was were its it this that his her their into over under across just than then".split(" "));
// Known filler prefixes from the old variation table. Strip so they cannot fake novelty.
const FILLER = /^(the altered environment|emphasizing grounded scale|focusing on tactile textures|vantage perspective[^.]*|reaction angle[^.]*)\.\s*/i;

function coreTokens(prompt: string): string[] {
  let t = prompt.replace(FILLER, "");
  for (const re of BOILER) t = t.replace(re, " ");
  return t.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
    .filter(w => w.length > 2 && !STOP.has(w));
}
function shingles(tokens: string[], n = 3): Set<string> {
  const s = new Set<string>();
  for (let i = 0; i <= tokens.length - n; i++) s.add(tokens.slice(i, i + n).join(" "));
  return s;
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0; for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}
export function lexicalSimilarity(a: string, b: string): number {
  const ta = coreTokens(a), tb = coreTokens(b);
  const setA = new Set(ta), setB = new Set(tb);
  // blend 3-gram overlap (copy detection) with bag-of-words (paraphrase)
  return 0.6 * jaccard(shingles(ta), shingles(tb)) + 0.4 * jaccard(setA, setB);
}
export function cosine(a: number[], b: number[]): number {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; }
  return d / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

export interface DedupeDeps {
  /** Optional: Gemini text-embedding call. Skip on Groq-only keys. */
  embed?: (texts: string[]) => Promise<number[][]>;
  /** Re-run Pass A for a single beat with a contrast brief. */
  replanBeat: (args: { beat: Beat; prev: Beat; banned: string[]; mustChange: string[] }) => Promise<Beat>;
  /** Pass B */
  writeCore: (beat: Beat, prev?: Beat) => Promise<string>;
}

const LEX_DUP = 0.55;   // tune on your exports; the export above scores > 0.9
const EMB_DUP = 0.88;
const MIN_NEW_IMAGE_SEC = 1.0;

async function isDuplicate(a: Beat, b: Beat, deps: DedupeDeps): Promise<boolean> {
  if (a.moment && b.moment) {
    // structural duplicate: strongest signal, no tokens needed
    if (stateKey(a.moment) === stateKey(b.moment) && a.moment.focus === b.moment.focus) return true;
  }
  if (!a.imageCore || !b.imageCore) return false;
  if (lexicalSimilarity(a.imageCore, b.imageCore) >= LEX_DUP) return true;
  if (deps.embed) {
    const [ea, eb] = await deps.embed([a.imageCore, b.imageCore]);
    if (cosine(ea, eb) >= EMB_DUP) return true;
  }
  return false;
}

function mergeInto(prev: Beat, cur: Beat, mode: "merge" | "reuse"): Beat {
  if (mode === "merge") {
    return { ...prev, endSec: cur.endSec, spokenWords: `${prev.spokenWords} ${cur.spokenWords}`.trim() };
  }
  return {
    ...cur,
    visualMode: "REUSE_PREVIOUS",
    moment: undefined,
    imageCore: undefined,
    reuse: { treatment: (cur.endSec - cur.startSec) < 1.2 ? "punch_in" : "slow_push", ofBeatId: prev.beatId },
  };
}

// ---------- 6.3 resolution ladder: regenerate (x2) -> reuse/merge ----------

export async function dedupeScene(beats: Beat[], deps: DedupeDeps): Promise<Beat[]> {
  const out: Beat[] = [];
  let lastImage: Beat | undefined; // last NEW_IMAGE beat

  for (let cur of beats) {
    if (cur.visualMode === "REUSE_PREVIOUS" || !lastImage) {
      out.push(cur);
      if (cur.visualMode === "NEW_IMAGE") lastImage = cur;
      continue;
    }
    const dur = cur.endSec - cur.startSec;
    let attempts = 0;

    while (await isDuplicate(lastImage, cur, deps)) {
      if (dur < MIN_NEW_IMAGE_SEC || attempts >= 2) {
        // 1) too short or retries exhausted: do not pay for a new image
        const reused = mergeInto(lastImage, cur, "reuse");
        out.push(reused);
        cur = reused;
        break;
      }
      attempts++;
      const banned = coreTokens(lastImage.imageCore ?? "").slice(0, 40);
      cur = await deps.replanBeat({
        beat: cur, prev: lastImage, banned,
        mustChange: attempts === 1 ? ["state", "focus"] : ["focus", "shot", "angle"],
      });
      cur.imageCore = await deps.writeCore(cur, lastImage);
    }
    if (cur.visualMode === "NEW_IMAGE") {
      if (!out.includes(cur)) out.push(cur);
      lastImage = cur;
    }
  }
  return out;
}

// ---------- 6.4 final prompt assembly (camera + style only here) ----------

const SHOT: Record<ShotSize, string> = {
  EWS: "extreme wide shot", WS: "wide shot", MS: "medium shot", MCU: "medium close-up",
  CU: "close-up", ECU: "extreme close-up", INSERT: "macro insert shot",
};
const ANGLE: Record<Angle, string> = {
  eye: "eye-level", high: "high angle", low: "low angle", dutch: "dutch tilt",
  birds: "bird's-eye view", worms: "worm's-eye view", pov: "first-person POV through the doorway", ots: "over-the-shoulder",
};

export function composePrompt(
  beat: Beat,
  opts: { styleLine: string; identityLocks: Record<string, string>; aspect: string; entitiesInFrame: string[] },
): string {
  const m = beat.moment!;
  const locks = opts.entitiesInFrame.map(id => opts.identityLocks[id]).filter(Boolean).join(" ");
  return [
    `${SHOT[m.shot]}, ${ANGLE[m.angle]}.`,
    beat.imageCore,
    locks,                       // identity only; NO frozen pose
    opts.styleLine,
    `--ar ${opts.aspect}`,       // exactly once
  ].filter(Boolean).join(" ");
}

// ---------- 6.5 pipeline glue ----------

export async function buildScene(
  sceneInput: unknown,
  deps: DedupeDeps & { planScene: (i: unknown) => Promise<{ entities: EntityTrack[]; beats: Beat[] }> },
) {
  let { entities, beats } = await deps.planScene(sceneInput);
  for (let pass = 0; pass < 2; pass++) {
    const issues = validateScene(entities, beats);
    if (!issues.length) break;
    // one repair call with the issue list, then move on
    ({ entities, beats } = await deps.planScene({ sceneInput, repair: issues }));
  }
  for (const b of beats) if (b.visualMode === "NEW_IMAGE") b.imageCore = await deps.writeCore(b, undefined);
  beats = await dedupeScene(beats, deps);
  // final guard: scene duration must equal beat sum
  const total = beats.reduce((s, b) => s + (b.endSec - b.startSec), 0);
  return { entities, beats, totalSec: Number(total.toFixed(2)) };
}
```

---

## 7. Roadmap (do in this order)

1. **Delete the variation-prefix table and the camera-label rotation.** This alone removes the "The altered environment." artifacts and the label/prose contradictions.
2. **Split the character sheet** into `identityLock` (face, hair, clothes; always injected) and `poseState` (per beat; comes from the moment). Remove "weight 55/45, wrist 20 degrees" from the global sheet.
3. **Add Pass A** with the schema above; make `visualMode` and `states` mandatory.
4. **Add Pass B** with only the current moment, previous moment, and locks for entities in frame.
5. **Ship `validateScene` + `dedupeScene`** (lexical only first; embeddings only if the user's key is Gemini).
6. **Move all framing words and the style suffix into `composePrompt`.** Assert in tests that `--ar` appears exactly once and no prompt is shorter than ~20 words (catches the `"Extreme."` output).
7. **Fix scene duration math:** compute scene header from `sum(endSec - startSec)`.
8. **Regression test:** run the exact Nokia story. Pass criteria: no two consecutive NEW_IMAGE beats share `focus` and `stateKey`; max `lexicalSimilarity` between neighbors < 0.35; reuse beats <= 25% of the total.

### Tuning notes
- If the model keeps returning REUSE for everything, lower the reuse threshold in the Pass A prompt (R6) from 0.9s to 0.7s and raise `maxNewImages` to `sceneSeconds / 1.0`.
- If it invents story events to satisfy "progression", strengthen R5 and add a validator check that every `action` contains a verb from, or a direct paraphrase of, the narration or the entity ladders.
- Use `temperature` 0.4 for Pass A and 0.7 for Pass B. Planning should be stable; wording can vary.
