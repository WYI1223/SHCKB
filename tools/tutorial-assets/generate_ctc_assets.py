from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np


ROOT = Path(__file__).resolve().parents[2]
SCENE_FILE = ROOT / "tools" / "tutorial-assets" / "ctc_manim_scenes.py"


def save_waveform(out: Path) -> None:
    rng = np.random.default_rng(7)
    sr = 16_000
    t = np.linspace(0, 1, sr, endpoint=False)
    envelope = np.interp(
        t,
        [0, 0.08, 0.20, 0.28, 0.40, 0.55, 0.68, 0.80, 0.92, 1.0],
        [0, 0.15, 0.75, 0.25, 0.8, 0.35, 0.7, 0.45, 0.15, 0],
    )
    wave = envelope * (
        0.62 * np.sin(2 * np.pi * 185 * t)
        + 0.28 * np.sin(2 * np.pi * 420 * t)
        + 0.10 * rng.normal(size=t.shape)
    )

    frames = 20
    fig, ax = plt.subplots(figsize=(12, 4.6), dpi=180)
    ax.plot(t, wave, color="#0f766e", lw=1.1)
    for i in range(frames + 1):
        x = i / frames
        ax.axvline(x, color="#d6cab2", lw=0.8, alpha=0.8)
    for x, label in [(0.17, "H"), (0.35, "E"), (0.52, "L"), (0.67, "L"), (0.82, "O")]:
        ax.text(x, 1.03, label, ha="center", va="center", fontsize=15, color="#be123c", fontweight="bold")
        ax.annotate("", xy=(x, 0.74), xytext=(x, 0.95), arrowprops={"arrowstyle": "-|>", "color": "#be123c", "lw": 1})
    ax.text(0.015, -1.05, "16,000 raw samples in one second", fontsize=11, color="#475569")
    ax.text(0.63, -1.05, "toy view: 20 prediction positions after downsampling", fontsize=11, color="#b45309")
    ax.set_title("Real input mismatch: audio has many time positions, transcript is short", loc="left", fontsize=15, color="#2f3136")
    ax.set_xlabel("time (seconds)")
    ax.set_ylabel("amplitude")
    ax.set_xlim(0, 1)
    ax.set_ylim(-1.12, 1.12)
    ax.grid(axis="y", color="#eee7d9", lw=0.8)
    ax.spines[["top", "right"]].set_visible(False)
    fig.tight_layout()
    fig.savefig(out / "01-real-audio-to-frames.png", bbox_inches="tight")
    plt.close(fig)


def save_ctc_heatmap(out: Path) -> None:
    tokens = ["_", "H", "E", "L", "O"]
    centers = {"H": 3.0, "E": 7.0, "L": 11.0, "O": 16.0}
    T = 20
    logits = np.zeros((len(tokens), T), dtype=float)
    xs = np.arange(T)
    logits[0] = 1.15 + 0.35 * np.cos(xs / 1.7)
    for i, token in enumerate(tokens[1:], start=1):
        width = 1.6 if token != "L" else 2.5
        center = centers[token]
        logits[i] = 2.8 * np.exp(-((xs - center) ** 2) / (2 * width**2))
        if token == "L":
            logits[i] += 2.4 * np.exp(-((xs - 13.6) ** 2) / (2 * 1.1**2))
    probs = np.exp(logits) / np.exp(logits).sum(axis=0, keepdims=True)

    fig, ax = plt.subplots(figsize=(12, 4.5), dpi=180)
    im = ax.imshow(probs, aspect="auto", cmap="YlGnBu", vmin=0, vmax=0.82)
    ax.set_yticks(range(len(tokens)), tokens)
    ax.set_xticks(range(T), [str(i + 1) for i in range(T)], fontsize=8)
    ax.set_xlabel("encoder hidden-state index")
    ax.set_title("CTC head output: a token distribution at every time position", loc="left", fontsize=15, color="#2f3136")
    for t in range(T):
        best = int(probs[:, t].argmax())
        ax.text(t, best, tokens[best], ha="center", va="center", color="#111827", fontsize=9, fontweight="bold")
    cb = fig.colorbar(im, ax=ax, fraction=0.026, pad=0.02)
    cb.set_label("probability")
    fig.tight_layout()
    fig.savefig(out / "03-ctc-head-heatmap.png", bbox_inches="tight")
    plt.close(fig)


def save_forward_lattice(out: Path) -> None:
    labels = list("_H_E_L_L_O_")
    T = 20
    S = len(labels)
    grid = np.zeros((S, T))
    for s in range(S):
        for t in range(T):
            diagonal = s / (S - 1) * (T - 1)
            grid[s, t] = np.exp(-((t - diagonal) ** 2) / 9.0)

    fig, ax = plt.subplots(figsize=(12, 5.2), dpi=180)
    ax.imshow(grid, aspect="auto", cmap="Oranges", origin="lower")
    ax.set_yticks(range(S), labels)
    ax.set_xticks(range(T), [str(i + 1) for i in range(T)], fontsize=8)
    ax.set_xlabel("time step")
    ax.set_ylabel("expanded target: _ H _ E _ L _ L _ O _")
    ax.set_title("Forward lattice: sum probability over all monotonic paths", loc="left", fontsize=15, color="#2f3136")
    for s in range(S - 1):
        t0 = s / (S - 1) * (T - 1)
        t1 = (s + 1) / (S - 1) * (T - 1)
        ax.annotate(
            "",
            xy=(t1, s + 1),
            xytext=(t0, s),
            arrowprops={"arrowstyle": "->", "color": "#334155", "lw": 1.3, "alpha": 0.82},
        )
    ax.text(0.4, S - 1.25, "stay / advance / skip blank", color="#475569", fontsize=11)
    fig.tight_layout()
    fig.savefig(out / "05-forward-lattice.png", bbox_inches="tight")
    plt.close(fig)


def newest_file(root: Path, pattern: str, before: set[Path]) -> Path:
    candidates = [p for p in root.rglob(pattern) if p not in before]
    if not candidates:
        candidates = list(root.rglob(pattern))
    if not candidates:
        raise RuntimeError(f"no generated files matching {pattern} under {root}")
    return max(candidates, key=lambda p: p.stat().st_mtime)


def render_manim(scene: str, png_name: str, out: Path, video: bool) -> None:
    media_dir = out / "manim-media"
    media_dir.mkdir(parents=True, exist_ok=True)

    before_png = set(media_dir.rglob("*.png"))
    cmd = [
        sys.executable,
        "-m",
        "manim",
        "-ql",
        "--media_dir",
        str(media_dir),
        "--save_last_frame",
        str(SCENE_FILE),
        scene,
    ]
    subprocess.run(cmd, cwd=ROOT, check=True)
    shutil.copy2(newest_file(media_dir / "images", "*.png", before_png), out / png_name)

    if video:
        before_mp4 = set(media_dir.rglob("*.mp4"))
        cmd = [
            sys.executable,
            "-m",
            "manim",
            "-ql",
            "--media_dir",
            str(media_dir),
            str(SCENE_FILE),
            scene,
        ]
        subprocess.run(cmd, cwd=ROOT, check=True)
        shutil.copy2(newest_file(media_dir / "videos", "*.mp4", before_mp4), out / png_name.replace(".png", ".mp4"))


def mp4_to_gif(mp4: Path, gif: Path) -> None:
    if shutil.which("ffmpeg") is None:
        raise RuntimeError("ffmpeg is required to export GIF assets")
    palette = gif.with_suffix(".palette.png")
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(mp4),
            "-vf",
            "fps=12,scale=900:-1:flags=lanczos,palettegen",
            str(palette),
        ],
        cwd=ROOT,
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(mp4),
            "-i",
            str(palette),
            "-lavfi",
            "fps=12,scale=900:-1:flags=lanczos [x]; [x][1:v] paletteuse",
            str(gif),
        ],
        cwd=ROOT,
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    palette.unlink(missing_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=ROOT / "tmp" / "ctc-tutorial-assets")
    parser.add_argument("--video", action="store_true", help="also export low-quality MP4 files from Manim")
    args = parser.parse_args()

    out = args.out if args.out.is_absolute() else ROOT / args.out
    out.mkdir(parents=True, exist_ok=True)

    save_waveform(out)
    save_ctc_heatmap(out)
    save_forward_lattice(out)
    render_manim("WaveformToStates", "02-manim-waveform-to-states.png", out, args.video)
    render_manim("CtcCollapsePaths", "04-manim-ctc-collapse.png", out, args.video)
    render_manim("Wav2Vec2StrideStack", "06-manim-wav2vec2-stride-stack.png", out, True)
    mp4_to_gif(
        out / "06-manim-wav2vec2-stride-stack.mp4",
        out / "06-manim-wav2vec2-stride-stack.gif",
    )

    print(f"generated CTC tutorial assets in {out}")


if __name__ == "__main__":
    main()
