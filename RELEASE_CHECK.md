# StoryFrame Production Release Checklist (Ground Truth Verification)

After real image generation from StoryFrame prompt blueprints, execute these three manual verification gates to confirm release readiness:

## 1. Zero-Text OCR Verification (Automated/Manual)
- **Gate:** Run Optical Character Recognition (e.g., Tesseract OCR or Google Cloud Vision OCR) over every generated storyboard frame.
- **Assertion:** Expected text found = **zero**.
- **Failure Condition:** If any frame contains rendered subtitles, quotation marks, floating dates (e.g. "1348"), or text overlays, the prompt has leaked narration text and fails the release gate.

## 2. Blind Narrative Retelling Test (Human Coherence)
- **Gate:** Present the generated storyboard frames in sequential order without showing the voiceover text or narration script to an observer who has not read the story.
- **Assertion:** Ask the observer to recount the sequence of events depicted.
- **Failure Condition:** If the viewer cannot identify who the subjects are, what physical actions occur, or the causal progression from Scene 1 to the finale, the visual prompts failed to convey concrete story meaning.

## 3. Cross-Model Vision Fidelity Comparison (Vision Model Audit)
- **Gate:** Pass each generated image to a vision model from a different family than the prompt writer (e.g., Claude 3.5 Sonnet Vision or GPT-4o Vision) with zero context.
- **Prompt:** "Describe this image in detail: list subjects, actions, lighting, camera angle, and whether any text or subtitles appear."
- **Assertion:** Compare the vision model's output with the beat's canonical `depicts` string from the Story Bible.
- **Verification Criteria:**
  - Concrete subjects match the Story Bible.
  - Figurative lines show the concrete referent (e.g. risen dead), not the abstract metaphor.
  - Withheld elements (e.g. the entity that called the dead) remain unseen, with only atmospheric/physical reactions visible.
  - No invented monsters (clawed 20ft shadows, black vortexes) or era anachronisms appear.
