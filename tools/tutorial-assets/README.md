# Tutorial Asset Pipeline

This directory contains offline asset generators for tutorial pages. The generated files are written to `tmp/`, then uploaded into the dev library by seed scripts through the normal HTTP API.

## Setup

```powershell
python -m pip install --user -r tools/tutorial-assets/requirements.txt
```

## Generate The CTC Sample Assets

```powershell
python tools/tutorial-assets/generate_ctc_assets.py --out tmp/ctc-tutorial-assets
```

For reusable animations, add `--video`:

```powershell
python tools/tutorial-assets/generate_ctc_assets.py --out tmp/ctc-tutorial-assets --video
```

The current product page uses PNG files for static figures and GIF files for short inline animations. The same Manim scenes also export MP4 files for later use when the content model supports video or animation blocks.
