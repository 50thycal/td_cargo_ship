"""Asset QA for every shipped sound, measured independently of prep.py with
ffmpeg (ebur128 with true peak; the decoded samples for silence, DC and
seams). Writes docs/audio/qa-report.md and exits 1 if anything fails.

  python3 tools/v3/audio/qa.py

Checks per file:
  - leading silence ≤ 10 ms (timing: the sound starts when it is asked for)
  - true peak ≤ -1.0 dBTP (no clipping, after AAC encoding)
  - loudness within ±2 LU of its bus target (one-shots: loudest 400 ms;
    loops and music: integrated)
  - duration within its class (UI blips ≤ 0.3 s, hits ≤ 1 s, ...)
  - DC offset under 0.5 %
  - loops: no seam (the jump from last sample to first is like any other)
and the total size budget (≤ 4 MB).
"""

import json
import os
import re
import subprocess
import sys

import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
AUDIO = os.path.join(ROOT, "public/v3/audio")
REPORT = os.path.join(ROOT, "docs/audio/qa-report.md")
SR = 44100
LOOP_PAD = 0.1

BLIPS = {"ui.tap", "ui.back", "ui.toggle", "armory.tab", "card.pick", "armory.equip", "gun.reload", "gun.dry"}
HITS = {"gun.fire", "gun.burst", "blade.hit", "glance", "shield.block", "kill.small", "tesla.arc", "flak.cloud", "pd.fire", "jet.guns", "minidrone.spawn", "scatter.blast", "aegis.launch", "blade.throw", "truck.fire", "sub.fire", "powerup.expire", "aegis.reload"}


def event_dur(x):
    """As prep.py: time within 20 dB of the loudest 10 ms (RMS)."""
    mono = x.mean(axis=1) if x.ndim == 2 else x
    w = int(0.01 * SR)
    n = max(1, len(mono) // w)
    rms = np.sqrt((mono[: n * w].reshape(n, w) ** 2).mean(axis=1) + 1e-20)
    above = np.nonzero(rms > rms.max() * 0.1)[0]
    return (above[-1] - above[0] + 1) * w / SR


def bounds(cue, bus, loop):
    if loop:
        return (0.4, 30)
    if cue in BLIPS:
        return (0.02, 0.3)
    if cue in HITS:
        return (0.05, 1.0)
    if bus == "alert":
        return (0.3, 5.5)
    return (0.1, 4.0)


def ebur(path):
    out = subprocess.run(["ffmpeg", "-nostats", "-v", "verbose", "-i", path, "-af", "apad=pad_dur=0.5,ebur128=peak=true:framelog=verbose", "-f", "null", "-"], capture_output=True, text=True).stderr
    m = [float(x) for x in re.findall(r" M:\s*(-?[\d.]+)", out)]
    i = re.search(r"I:\s*(-?[\d.]+) LUFS", out.split("Summary:")[-1])
    tp = re.search(r"Peak:\s*(-?[\d.]+|-inf) dBFS", out.split("Summary:")[-1])
    return max(m) if m else -99, float(i.group(1)) if i else -99, float(tp.group(1)) if tp and tp.group(1) != "-inf" else -99


def samples(path, ch):
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", str(ch), "-ar", str(SR), "-"])
    x = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    x = x.reshape(-1, ch) if ch == 2 else x
    # ffmpeg keeps the AAC encoder's end padding; browsers trim it to the
    # stream's stated duration (Chromium decodes exactly that many samples).
    dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "stream=duration", "-of", "csv=p=0", path], text=True).strip())
    return x[: int(round(dur * SR))]


def integrated_looped(path):
    # Short loops measured over two passes (as prep does).
    out = subprocess.run(["ffmpeg", "-nostats", "-stream_loop", "1", "-i", path, "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr
    i = re.search(r"I:\s*(-?[\d.]+) LUFS", out.split("Summary:")[-1])
    return float(i.group(1)) if i else -99


def main():
    m = json.loads(subprocess.check_output(["npx", "vite-node", "tools/v3/audio/manifest-json.ts"], cwd=ROOT))
    loops = set(m["loops"]) | set(m["music"])
    rows, fails, total = [], [], 0
    for cue in m["cues"]:
        d = m["sounds"][cue]
        for f in d["files"]:
            path = os.path.join(AUDIO, f)
            total += os.path.getsize(path)
            stereo = d["bus"] == "music"
            x = samples(path, 2 if stereo else 1)
            loop = cue in loops
            if loop:  # the loop itself, between the codec pads
                pad = int(LOOP_PAD * SR)
                x = x[pad : len(x) - pad]
            mono = np.abs(x).max(axis=1) if stereo else np.abs(x)
            dur = len(mono) / SR
            peak = mono.max()
            lead_ms = np.argmax(mono > peak * 10 ** (-45 / 20)) / SR * 1000
            dc = abs(float(np.mean(x))) / (peak + 1e-12)
            mmax, integ, tp = ebur(path)
            # One-shots: loudest 400 ms plus temporal integration for
            # sounds under 400 ms (the rule prep.py levels by).
            event = event_dur(x)
            loud = integrated_looped(path) if loop else mmax + 10 * np.log10(0.4 / min(0.4, max(0.1, event)))
            target = m["busLufs"][d["bus"]]
            lo, hi = bounds(cue, d["bus"], loop)
            seam = None
            if loop:
                flat = x.mean(axis=1) if stereo else x
                diffs = np.abs(np.diff(flat))
                jump = abs(flat[0] - flat[-1])
                seam = jump / (np.percentile(diffs, 99.9) + 1e-12)
            problems = []
            if not loop and lead_ms > 10:
                problems.append(f"leading silence {lead_ms:.1f} ms")
            if tp > -1.0:
                problems.append(f"true peak {tp:.1f} dBTP")
            if abs(loud - target) > 2:
                problems.append(f"loudness {loud:.1f} vs {target}")
            if not lo <= dur <= hi:
                problems.append(f"duration {dur:.2f} s outside {lo}–{hi}")
            if dur >= 0.5 and dc > 0.005:  # a short click's mean is its shape, not DC
                problems.append(f"DC {dc * 100:.2f} %")
            if seam is not None and seam > 1.0:
                problems.append(f"loop seam {seam:.2f}× the largest normal step")
            rows.append((f, d["bus"], dur, lead_ms, loud, target, tp, dc, seam, problems))
            if problems:
                fails.append((f, problems))
    size_ok = total <= 4 * 1024 * 1024
    if not size_ok:
        fails.append(("(all)", [f"total {total / 1048576:.2f} MB > 4 MB"]))
    os.makedirs(os.path.dirname(REPORT), exist_ok=True)
    with open(REPORT, "w") as out:
        out.write("# Sound asset QA\n\nGenerated by `python3 tools/v3/audio/qa.py` (ffmpeg ebur128, true peak; decoded samples).\n\n")
        out.write(f"**{len(rows)} files, {total / 1048576:.2f} MB total ({'within' if size_ok else 'OVER'} the 4 MB budget). {len(fails)} failing.**\n\n")
        out.write("| file | bus | dur s | lead ms | loudness | target | true peak | DC % | seam | result |\n|---|---|---|---|---|---|---|---|---|---|\n")
        for f, bus, dur, lead, loud, target, tp, dc, seam, probs in rows:
            out.write(f"| {f} | {bus} | {dur:.2f} | {lead:.1f} | {loud:.1f} | {target} | {tp:.1f} | {dc * 100:.2f} | {'' if seam is None else f'{seam:.2f}'} | {'; '.join(probs) or 'ok'} |\n")
    for f, p in fails:
        print("FAIL", f, "; ".join(p))
    print(f"{len(rows)} files, {total / 1048576:.2f} MB, {len(fails)} failing → {os.path.relpath(REPORT, ROOT)}")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
