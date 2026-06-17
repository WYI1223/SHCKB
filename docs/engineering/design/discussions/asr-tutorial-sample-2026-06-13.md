# ASR Tutorial Sample Alignment - 2026-06-13

## Scope

This note records the alignment for the first ASR course sample page before the full tutorial series is generated. The page is a dev-library content probe, not a product runtime change.

## Mandatory Checks

Reasonableness check: a single CTC page is a reasonable sample because it exercises markdown blocks, code blocks, image blocks, cross-source references, and the hardest expected tutorial requirement: explaining an abstract ASR loss from real data flow.

Wheel-reinvention check: Manim and matplotlib are used as mature offline asset tools. The app does not gain a custom animation engine, video renderer, or Python runtime dependency.

Technology-fit check: the current notepage model already supports markdown, code, and image blocks, which is enough for the sample. The key downsampling animation is represented by a Manim-generated GIF inside an existing image block; MP4 files are still generated for later use when the product has a video/animation block.

First-principles product check: the tutorial must start from the learner's observable input, an audio file and a transcript, then show how the data changes step by step. Definitions such as blank, collapse, and forward-backward come after the concrete mismatch is visible.

## Sample Design

The rewritten page follows one concrete problem: "we have one second of speech and the transcript HELLO, but no timestamps." It then walks through waveform samples, encoder downsampling, per-frame token distributions, missing frame-level labels, blank as a boundary/no-speech token, path collapse, and finally CTC forward probability mass.

The narrative intentionally avoids starting with the formal CTC definition. The formal rule appears only after the reader has seen why the rule is needed.

## Review Refinements

The second pass tightened three tutorial rules for the full course:

- Replace vague "real models usually..." statements with a named model and a concrete number. For this page, wav2vec 2.0's 7-layer feature encoder turns 1 second of 16kHz audio into 49 latent frames.
- Define each new technical term before it appears in a figure caption or later step. The page now introduces "forward lattice" as a two-axis dynamic-programming table before asking the reader to inspect it.
- Put paper links near the end as a "Papers and implementation entry points" block. This preserves the beginner reading flow while still giving advanced readers a path into the primary sources.

## Layout Refinement

The approved sample direction is figure-first teaching with a separate lecture track:

- Lead each major concept with a full-width figure, GIF, or data visual before the explanatory text.
- Put a compact caption directly under the visual so the reader can understand the point without scanning ahead.
- Follow the caption with short paragraphs that move from the concrete observation to the formal term.
- Keep code blocks after the visual explanation, using them as a way to reproduce the numbers rather than as the first source of truth.
- Use primary paper links near the end of the page, after the beginner path has already built intuition.

For this page, the first visual anchor is the wav2vec 2.0 stride GIF: it turns the abstract statement "16,000 samples become 49 frames" into a visible data transformation before CTC is introduced.

Known product constraint: a 390px viewport screenshot shows the current note renderer behaving like a fixed-width canvas, so the whole page horizontally clips on narrow screens. That should be handled as a renderer/responsive-layout issue before publishing the course broadly; this content pass keeps the sample scoped to the existing desktop-oriented dev library.

## Asset Pipeline

Offline tutorial assets live under `tools/tutorial-assets/`.

- `generate_ctc_assets.py` is the stable entry point.
- `ctc_manim_scenes.py` contains reusable Manim scenes.
- Generated PNG/GIF/MP4 files are written to `tmp/ctc-tutorial-assets/`, which is ignored by git.
- The seed script uploads generated PNG/GIF assets through the real `/api/blobs` path.

This keeps course content production reproducible without coupling Python tools to the deployed app.
