"""docs/audio/sound-board.wav: every cue in turn, at its mix level, with a gap
between each; docs/audio/sound-board.md lists what plays when.

  python3 tools/v3/audio/soundboard.py

Each one-shot plays its first file at its manifest volume (so the board is
also a rough balance check); loops play two passes; music beds 10 s each.
Mono except the music, which is mixed down too (the board is one file).
"""

import json
import os
import subprocess

import numpy as np
from scipy.io import wavfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
AUDIO = os.path.join(ROOT, "public/v3/audio")
SR = 44100
GAP = 0.7
LOOP_PAD = 0.1


def decode(path):
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"])
    x = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "stream=duration", "-of", "csv=p=0", path], text=True).strip())
    return x[: int(round(dur * SR))]


def main():
    m = json.loads(subprocess.check_output(["npx", "vite-node", "tools/v3/audio/manifest-json.ts"], cwd=ROOT))
    loops = set(m["loops"]) | set(m["music"])
    parts, rows, t = [], [], 0.0
    for i, cue in enumerate(m["cues"]):
        d = m["sounds"][cue]
        x = decode(os.path.join(AUDIO, d["files"][0]))
        if cue in loops:
            pad = int(LOOP_PAD * SR)
            x = x[pad : len(x) - pad]
            x = np.tile(x, 2)[: int(10 * SR)] if cue in m["music"] else np.tile(x, 2)
            f = int(0.05 * SR)
            x[:f] *= np.linspace(0, 1, f)
            x[-f:] *= np.linspace(1, 0, f)
        x = x * d["volume"]
        rows.append(f"| {i + 1} | {int(t // 60)}:{t % 60:05.2f} | {cue} | {d['bus']} | {d['volume']} | {len(d['files'])} |")
        parts += [x, np.zeros(int(GAP * SR))]
        t += len(x) / SR + GAP
    out = np.concatenate(parts)
    out *= 10 ** (-1 / 20) / np.max(np.abs(out))
    os.makedirs(os.path.join(ROOT, "docs/audio"), exist_ok=True)
    wavfile.write(os.path.join(ROOT, "docs/audio/sound-board.wav"), SR, (out * 32767).astype(np.int16))
    with open(os.path.join(ROOT, "docs/audio/sound-board.md"), "w") as f:
        f.write(f"# Sound board\n\n`sound-board.wav` ({t / 60:.1f} min): every cue in the order below, its first file at its mix volume, {GAP} s apart. Loops play two passes; music beds 10 s. Pictures of each are in `cues/<cue>.png`.\n\n")
        f.write("| # | at | cue | bus | volume | files |\n|---|---|---|---|---|---|\n" + "\n".join(rows) + "\n")
    print(f"sound-board.wav: {len(rows)} cues, {t / 60:.1f} min")


if __name__ == "__main__":
    main()
