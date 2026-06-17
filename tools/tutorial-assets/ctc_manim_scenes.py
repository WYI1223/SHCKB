from __future__ import annotations

import math

from manim import *


config.background_color = "#f7f5ef"

FONT = "Microsoft YaHei"
INK = "#2f3136"
MUTED = "#64748b"
BLUE = "#2563eb"
TEAL = "#0f766e"
AMBER = "#b45309"
ROSE = "#be123c"
PAPER = "#fffdf7"
GRID = "#d8d2c2"


def text(label: str, size: int = 28, color: str = INK) -> Text:
    return Text(label, font=FONT, font_size=size, color=color)


def token_box(label: str, color: str = BLUE) -> VGroup:
    box = RoundedRectangle(
        width=0.46,
        height=0.42,
        corner_radius=0.06,
        stroke_color=color,
        stroke_width=2,
        fill_color="#ffffff",
        fill_opacity=0.92,
    )
    t = text(label, 22, color)
    return VGroup(box, t)


class WaveformToStates(Scene):
    """Show how a continuous-looking signal becomes a short state sequence."""

    def construct(self) -> None:
        title = text("audio.wav + transcript -> frames -> hidden states", 34)
        title.to_edge(UP, buff=0.35)
        subtitle = text("1 second speech, 16,000 samples, no timestamps for characters", 22, MUTED)
        subtitle.next_to(title, DOWN, buff=0.12)

        axes = Axes(
            x_range=[0, 1, 0.2],
            y_range=[-1.35, 1.35, 0.5],
            x_length=9.6,
            y_length=2.3,
            tips=False,
            axis_config={"color": "#6b7280", "stroke_width": 1.5},
        )
        axes.shift(UP * 1.0)
        wave = axes.plot(
            lambda x: 0.62 * math.sin(2 * math.pi * 4.2 * x)
            + 0.28 * math.sin(2 * math.pi * 12.5 * x)
            + 0.16 * math.sin(2 * math.pi * 27 * x),
            x_range=[0, 1],
            color=TEAL,
            stroke_width=4,
        )

        frame_lines = VGroup()
        for i in range(21):
            x = i / 20
            p0 = axes.c2p(x, -1.18)
            p1 = axes.c2p(x, 1.18)
            line = DashedLine(p0, p1, dash_length=0.05, color=GRID, stroke_width=1)
            frame_lines.add(line)

        sample_note = text("raw waveform samples", 20, MUTED).next_to(axes, LEFT, buff=0.35).rotate(PI / 2)
        frame_note = text("fixed windows / frames", 22, AMBER).next_to(axes, DOWN, buff=0.2)

        encoder = RoundedRectangle(
            width=3.15,
            height=0.72,
            corner_radius=0.08,
            stroke_color=BLUE,
            fill_color="#e0ecff",
            fill_opacity=0.88,
        )
        encoder_label = text("feature encoder", 24, BLUE).move_to(encoder)
        encoder_group = VGroup(encoder, encoder_label).next_to(frame_note, DOWN, buff=0.48)

        states = VGroup()
        for i in range(20):
            r = RoundedRectangle(
                width=0.33,
                height=0.36,
                corner_radius=0.04,
                stroke_width=1,
                stroke_color="#155e75",
                fill_color="#ccfbf1" if i % 2 == 0 else "#e0f2fe",
                fill_opacity=0.95,
            )
            states.add(r)
        states.arrange(RIGHT, buff=0.05)
        states.next_to(encoder_group, DOWN, buff=0.55)
        states_label = text("T hidden states: model predicts one token distribution at each position", 22, INK)
        states_label.next_to(states, DOWN, buff=0.2)

        transcript = VGroup(
            text("transcript:", 22, MUTED),
            text('"HELLO"', 30, ROSE),
        ).arrange(RIGHT, buff=0.15)
        transcript.next_to(subtitle, DOWN, buff=0.1)

        mismatch = text("The supervision is short text, not frame labels.", 24, ROSE)
        mismatch.to_edge(DOWN, buff=0.35)

        self.play(FadeIn(title), FadeIn(subtitle), FadeIn(transcript))
        self.play(Create(axes), Create(wave), FadeIn(sample_note))
        self.play(FadeIn(frame_lines), FadeIn(frame_note))
        self.play(FadeIn(encoder_group), run_time=0.7)
        self.play(LaggedStart(*[FadeIn(s, shift=DOWN * 0.15) for s in states], lag_ratio=0.035))
        self.play(FadeIn(states_label), FadeIn(mismatch))
        self.wait(0.8)


class Wav2Vec2StrideStack(Scene):
    """Animate wav2vec 2.0 feature-encoder downsampling."""

    def construct(self) -> None:
        title = text("wav2vec 2.0 feature encoder: 16,000 samples -> 49 frames", 32)
        title.to_edge(UP, buff=0.35)
        subtitle = text("strides (5,2,2,2,2,2,2) multiply to 320 samples = 20ms at 16kHz", 21, MUTED)
        subtitle.next_to(title, DOWN, buff=0.12)

        kernels = [10, 3, 3, 3, 3, 2, 2]
        strides = [5, 2, 2, 2, 2, 2, 2]
        lengths = [16000]
        for kernel, stride in zip(kernels, strides):
            lengths.append((lengths[-1] - kernel) // stride + 1)

        rows = VGroup()
        max_width = 8.5
        min_width = 0.58
        for i, length in enumerate(lengths):
            if i == 0:
                label = "waveform"
                left = "16,000 samples"
                color = TEAL
                note = "raw audio"
            else:
                label = f"conv {i}"
                left = f"{length:,} positions"
                color = BLUE if i < len(lengths) - 1 else ROSE
                note = f"k={kernels[i - 1]}, s={strides[i - 1]}"

            width = max(min_width, max_width * (length / lengths[0]) ** 0.38)
            bar = RoundedRectangle(
                width=width,
                height=0.36,
                corner_radius=0.05,
                stroke_width=1.5,
                stroke_color=color,
                fill_color=color,
                fill_opacity=0.18,
            )
            lab = text(label, 20, INK).next_to(bar, LEFT, buff=0.24)
            count = text(left, 20, color).next_to(bar, RIGHT, buff=0.24)
            small = text(note, 17, MUTED).next_to(count, RIGHT, buff=0.18)
            row = VGroup(lab, bar, count, small)
            rows.add(row)

        rows.arrange(DOWN, buff=0.18, aligned_edge=LEFT)
        rows.move_to(ORIGIN + LEFT * 0.25 + DOWN * 0.08)

        arrows = VGroup()
        for i in range(len(rows) - 1):
            a = Arrow(
                rows[i][1].get_bottom() + DOWN * 0.04,
                rows[i + 1][1].get_top() + UP * 0.04,
                buff=0.02,
                color="#475569",
                stroke_width=2,
                max_tip_length_to_length_ratio=0.12,
            )
            arrows.add(a)

        formula = VGroup(
            text("one convolution layer:", 19, MUTED),
            text("out_len = floor((in_len - kernel) / stride) + 1", 21, AMBER),
        ).arrange(RIGHT, buff=0.18)
        formula.to_edge(DOWN, buff=0.35)

        takeaway = RoundedRectangle(
            width=8.2,
            height=0.78,
            corner_radius=0.08,
            stroke_color=ROSE,
            fill_color="#fff1f2",
            fill_opacity=0.9,
        )
        takeaway_text = text("49 frame labels still do not exist; transcript is only HELLO", 20, ROSE)
        takeaway_text.scale_to_fit_width(takeaway.width - 0.36)
        takeaway_group = VGroup(takeaway, takeaway_text)
        takeaway_text.move_to(takeaway)
        takeaway_group.next_to(formula, UP, buff=0.25)

        self.add(title, subtitle, rows[0])
        self.wait(0.5)
        for i in range(1, len(rows)):
            self.play(Create(arrows[i - 1]), FadeIn(rows[i], shift=DOWN * 0.08), run_time=0.45)
        self.play(FadeIn(formula), FadeIn(takeaway_group))
        self.wait(0.9)


class CtcCollapsePaths(Scene):
    """Show that multiple frame-level paths collapse to the same transcript."""

    def construct(self) -> None:
        title = text("CTC: many frame paths can mean the same transcript", 34)
        title.to_edge(UP, buff=0.35)
        subtitle = text("First merge repeats, then delete blank (_). Order matters.", 22, MUTED)
        subtitle.next_to(title, DOWN, buff=0.12)

        paths = [
            ["_", "H", "H", "_", "E", "_", "L", "_", "L", "L", "_", "O", "_"],
            ["H", "_", "E", "E", "_", "L", "_", "L", "_", "O", "O", "_", "_"],
            ["_", "H", "_", "E", "_", "L", "L", "_", "L", "_", "O", "_", "_"],
        ]
        colors = { "_": MUTED, "H": BLUE, "E": TEAL, "L": AMBER, "O": ROSE }

        rows = VGroup()
        for row_i, path in enumerate(paths):
            row = VGroup()
            for tok in path:
                row.add(token_box(tok, colors[tok]))
            row.arrange(RIGHT, buff=0.035)
            tag = text(f"path {row_i + 1}", 21, MUTED)
            tag.next_to(row, LEFT, buff=0.25)
            rows.add(VGroup(tag, row))
        rows.arrange(DOWN, buff=0.42, aligned_edge=LEFT)
        rows.move_to(ORIGIN + LEFT * 1.6 + UP * 0.15)

        outputs = VGroup()
        for i in range(3):
            arrow = Arrow(LEFT, RIGHT, buff=0, color="#475569", stroke_width=2.5)
            out = text("HELLO", 28, INK)
            g = VGroup(arrow, out).arrange(RIGHT, buff=0.25)
            g.next_to(rows[i], RIGHT, buff=0.4)
            outputs.add(g)

        rule = VGroup(
            text("blank (_) is not a space", 23, BLUE),
            text("it is a boundary / no-character option", 20, MUTED),
            text("H E L _ L O -> HELLO", 20, AMBER),
            text("H E L L O  -> HELO after repeat merge", 20, ROSE),
        ).arrange(DOWN, buff=0.18, aligned_edge=LEFT)
        panel = RoundedRectangle(
            width=7.15,
            height=2.05,
            corner_radius=0.08,
            stroke_color="#c7bda6",
            fill_color=PAPER,
            fill_opacity=0.96,
        )
        rule_group = VGroup(panel, rule)
        rule.move_to(panel).shift(LEFT * 0.05)
        rule_group.to_edge(DOWN, buff=0.35)

        self.play(FadeIn(title), FadeIn(subtitle))
        for row in rows:
            self.play(FadeIn(row), run_time=0.35)
        self.play(LaggedStart(*[FadeIn(o, shift=RIGHT * 0.2) for o in outputs], lag_ratio=0.15))
        self.play(FadeIn(rule_group))
        self.wait(0.8)
