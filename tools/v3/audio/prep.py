"""Prepare every shipped sound: source → trimmed, levelled, peak-safe AAC.

  python3 tools/v3/audio/prep.py            # every file in the manifest
  python3 tools/v3/audio/prep.py gun.fire   # just these cues

For each file named in src/v3/audio/manifest.ts it takes the source, in
this order of preference:
  1. assets-src/audio/custom/<file stem>.<any audio ext>   (your own file;
     its credit comes from assets-src/audio/custom/credits.json)
  2. the uisfx library (UISFX_SOURCE; fetch with fetch-uisfx.mjs)
  3. assets-src/audio/synth/<file stem>.wav                (synth.py)
then:
  - converts to 44.1 kHz, mono (music stays stereo);
  - trims leading silence to ~1 ms with a 1 ms fade in (timing), trailing
    silence with a 10 ms fade out (no clicks); loops are left whole;
  - levels it to its bus's loudness (BUS_LUFS): one-shots by their loudest
    400 ms (momentary max), loops and music integrated;
  - holds true peak at or under -1.5 dBTP before encoding (a look-ahead
    limiter, only where needed), so the AAC lands under -1 dBTP;
  - encodes AAC .m4a (96 kbps mono, 128 kbps stereo music);
  - writes public/v3/audio/CREDITS.json.
Needs ffmpeg, numpy, scipy, pyloudnorm.
"""

import json
import os
import subprocess
import sys
import tempfile

import numpy as np
import pyloudnorm
from scipy import signal
from scipy.ndimage import minimum_filter1d
from scipy.io import wavfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
OUT = os.path.join(ROOT, "public/v3/audio")
SRC = os.path.join(ROOT, "assets-src/audio")
SR = 44100
TP_CEILING = -2.0
# Loops ship with this much of their own tail before and head after the loop
# (manifest.ts LOOP_PAD): AAC smears the edges of a file, so the engine loops
# between loopStart and loopEnd, clear of them.
LOOP_PAD = 0.1
# The most a sound's peaks may be limited (dB).
MAX_LIMIT = 6.0
UISFX_VERSION = "0.4.0"


def manifest():
    raw = subprocess.check_output(["npx", "vite-node", "tools/v3/audio/manifest-json.ts"], cwd=ROOT)
    return json.loads(raw)


def load(path, stereo):
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-acodec", "pcm_f32le", "-ar", str(SR), "-ac", "2" if stereo else "1", "-"])
    x = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    return x.reshape(-1, 2) if stereo else x


def kweight(x):
    m = pyloudnorm.Meter(SR)
    y = x
    for f in m._filters.values():
        y = f.apply_filter(y)
    return y


def momentary_max(x):
    """Loudest 400 ms (LUFS), mono or stereo."""
    chans = x.T if x.ndim == 2 else [x]
    w = int(0.4 * SR)
    hop = int(0.1 * SR)
    power = None
    for c in chans:
        c = np.concatenate([c, np.zeros(max(0, w - len(c)))])
        k = kweight(c) ** 2
        cs = np.concatenate([[0], np.cumsum(k)])
        starts = np.arange(0, len(k) - w + 1, hop)
        p = (cs[starts + w] - cs[starts]) / w
        power = p if power is None else power + p
    return -0.691 + 10 * np.log10(np.max(power) + 1e-15)


def event_loudness(x):
    """A one-shot's loudness: its loudest 400 ms (BS.1770 momentary), plus
    the ear's temporal integration for a sound shorter than that: a 100 ms
    click averaged over 400 ms reads 6 dB quieter than it sounds. The same
    rule is in qa.py."""
    return momentary_max(x) + short_bonus(x)


def short_bonus(x):
    return 10 * np.log10(0.4 / min(0.4, max(0.1, event_dur(x))))


def event_dur(x):
    """How long a sound stays within 20 dB of its loudest 10 ms (RMS, so a
    single sharp peak doesn't decide it). Shared with qa.py."""
    mono = x.mean(axis=1) if x.ndim == 2 else x
    w = int(0.01 * SR)
    n = max(1, len(mono) // w)
    rms = np.sqrt((mono[: n * w].reshape(n, w) ** 2).mean(axis=1) + 1e-20)
    above = np.nonzero(rms > rms.max() * 0.1)[0]
    return (above[-1] - above[0] + 1) * w / SR


def integrated(x):
    # Short loops are measured over two passes so the gate has blocks to use.
    y = np.concatenate([x, x]) if len(x) < 3 * SR else x
    return pyloudnorm.Meter(SR).integrated_loudness(y)


def true_peak_db(x):
    y = signal.resample_poly(x, 4, 1, axis=0)
    return 20 * np.log10(np.max(np.abs(y)) + 1e-15)


def limit(x, ceiling_db, loop=False):
    """Look-ahead peak limiter on 4× oversampled peaks: instant attack (via
    5 ms look-ahead), 80 ms release. Returns the signal and the most gain
    it took off (dB)."""
    ceiling = 10 ** (ceiling_db / 20)
    os_ = np.abs(signal.resample_poly(x, 4, 1, axis=0))
    if os_.ndim == 2:
        os_ = os_.max(axis=1)
    peak = os_.reshape(-1, 4).max(axis=1) if len(os_) % 4 == 0 else os_[: len(os_) // 4 * 4].reshape(-1, 4).max(axis=1)
    peak = np.concatenate([peak, np.zeros(len(x) - len(peak))]) if len(peak) < len(x) else peak[: len(x)]
    need = np.minimum(1.0, ceiling / np.maximum(peak, 1e-12))
    look = int(0.005 * SR)
    # Each sample's gain must already be down `look` samples before its peak.
    # window [i, i + look]: a forward-looking minimum
    need_ahead = minimum_filter1d(need, size=look + 1, origin=-(look // 2), mode='nearest')
    g = np.empty_like(need_ahead)
    rel = np.exp(-1 / (0.08 * SR))
    cur = 1.0
    for i, n in enumerate(need_ahead):
        cur = n if n < cur else n + (cur - n) * rel
        g[i] = cur
    y = x * (g[:, None] if x.ndim == 2 else g)
    return y, -20 * np.log10(g.min())


def trim(x, loop):
    if loop:
        return x
    mono = np.abs(x).max(axis=1) if x.ndim == 2 else np.abs(x)
    thr = mono.max() * 10 ** (-45 / 20)
    on = np.argmax(mono > thr)
    start = max(0, on - int(0.001 * SR))
    above = np.nonzero(mono > mono.max() * 10 ** (-50 / 20))[0]
    end = min(len(mono), above[-1] + int(0.01 * SR)) if len(above) else len(mono)
    y = x[start:end].copy()
    fi, fo = int(0.001 * SR), int(0.01 * SR)
    ramp_in = np.linspace(0, 1, fi)
    ramp_out = np.linspace(1, 0, fo) ** 2
    if y.ndim == 2:
        y[:fi] *= ramp_in[:, None]
        y[-fo:] *= ramp_out[:, None]
    else:
        y[:fi] *= ramp_in
        y[-fo:] *= ramp_out
    return y


def source_for(m, cue, file, index):
    stem = file.rsplit(".", 1)[0]
    custom = os.path.join(SRC, "custom")
    if os.path.isdir(custom):
        for f in sorted(os.listdir(custom)):
            if f.rsplit(".", 1)[0] == stem and not f.endswith(".json"):
                credits = json.load(open(os.path.join(custom, "credits.json"))) if os.path.exists(os.path.join(custom, "credits.json")) else {}
                c = credits.get(f) or credits.get(stem)
                if not c:
                    raise SystemExit(f"{f}: add its source and licence to assets-src/audio/custom/credits.json")
                return os.path.join(custom, f), c
    u = m["uisfx"].get(cue)
    if u:
        return os.path.join(SRC, "uisfx/sounds", u + ".mp3"), {
            "source": f"uisfx {UISFX_VERSION} (npm), sounds/{u}.mp3",
            "sourceUrl": f"https://registry.npmjs.org/uisfx/-/uisfx-{UISFX_VERSION}.tgz",
            "author": "Romain Simon (uisfx.com)",
            "licence": "CC0-1.0",
        }
    return os.path.join(SRC, "synth", stem + ".wav"), {
        "source": f"synthesized by tools/v3/audio/synth.py (recipe '{cue}', variant {index + 1})",
        "sourceUrl": "tools/v3/audio/synth.py",
        "author": "Straitwatch (procedural, made for this game)",
        "licence": "CC0-1.0",
    }


def encode(x, path, stereo):
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as t:
        wavfile.write(t.name, SR, x.astype(np.float32))
        tmp = t.name
    rate = "128k" if stereo else "96k"
    subprocess.check_call(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-c:a", "aac", "-b:a", rate, "-movflags", "+faststart", path])
    os.unlink(tmp)


def encoded_true_peak(path):
    out = subprocess.run(["ffmpeg", "-nostats", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    import re

    m = re.search(r"Peak:\s*(-?[\d.]+|-inf) dBFS", out.split("Summary:")[-1])
    return float(m.group(1)) if m and m.group(1) != "-inf" else -99.0


def main(only):
    m = manifest()
    os.makedirs(OUT, exist_ok=True)
    credits_path = os.path.join(OUT, "CREDITS.json")
    credits = {c["file"]: c for c in json.load(open(credits_path))} if os.path.exists(credits_path) else {}
    report = []
    loops = set(m["loops"]) | set(m["music"])
    for cue in m["cues"]:
        if only and cue not in only:
            continue
        d = m["sounds"][cue]
        stereo = d["bus"] == "music"
        loop = cue in loops
        for i, file in enumerate(d["files"]):
            src, credit = source_for(m, cue, file, i)
            if not os.path.exists(src):
                raise SystemExit(f"{cue}: missing source {src} (run synth.py / fetch-uisfx.mjs)")
            x = load(src, stereo)
            # No DC: a 20 Hz high-pass (synthesized brown noise drifts).
            hpf = signal.butter(2, 20, 'high', fs=SR, output='sos')
            if loop:  # filtered as a circle, so the seam stays seamless
                n = len(x)
                x = signal.sosfiltfilt(hpf, np.concatenate([x, x, x]), axis=0)[n : 2 * n]
            else:
                x = signal.sosfiltfilt(hpf, x, axis=0)
            x = trim(x, loop)
            measure = integrated if loop else event_loudness
            measured = measure(x)
            target = m["busLufs"][d["bus"]]
            ceiling = TP_CEILING
            base = x
            # Level, limit, re-measure: a peaky sound loses loudness to the
            # limiter, so it gets the difference back and is limited again.
            # Then encode and measure the AAC's true peak: if the codec
            # overshot -1.2 dBTP, lower the ceiling by as much and redo it.
            for _ in range(8):
                gain_db = target - measured
                for _ in range(6):
                    y = base * 10 ** (gain_db / 20)
                    limited = 0.0
                    if true_peak_db(y) > ceiling:
                        y, limited = limit(y, ceiling - 0.2, loop)
                    if limited > MAX_LIMIT:
                        # Never crush a sound to make it loud: back off to
                        # MAX_LIMIT dB of limiting and let QA flag the level
                        # (the fix is a fuller source, round 2).
                        gain_db -= limited - MAX_LIMIT
                        y = base * 10 ** (gain_db / 20)
                        y, limited = limit(y, ceiling - 0.2, loop)
                        break
                    off = target - measure(y)
                    if abs(off) < 0.3:
                        break
                    gain_db += off
                x = y
                if loop:
                    n, pad = len(x), int(LOOP_PAD * SR)
                    x = np.concatenate([x[n - pad :], x, x[:pad]], axis=0)
                encode(x, os.path.join(OUT, file), stereo)
                tp = encoded_true_peak(os.path.join(OUT, file))
                if tp <= -1.2:
                    break
                ceiling -= tp + 1.2 + 0.2
            else:
                # The codec still overshoots: take the whole file down by the
                # difference (a fraction of a dB of loudness).
                x = x * 10 ** ((-1.3 - tp) / 20)
                encode(x, os.path.join(OUT, file), stereo)
            changes = ["trimmed silence, 1 ms fade in, 10 ms fade out" if not loop else "loop kept whole, 0.1 s of its own tail/head padded on for the codec", f"levelled to {target} LUFS ({gain_db:+.1f} dB)", "AAC .m4a"]
            if limited > 0.05:
                changes.insert(2, f"peak-limited {limited:.1f} dB")
            if not stereo:
                changes.insert(0, "mono, 44.1 kHz")
            credits[file] = {"file": file, "cue": cue, **credit, "changes": "; ".join(changes)}
            report.append({"file": file, "measured": round(measured, 1), "gain": round(gain_db, 1), "limited": round(limited, 2), "dur": round(len(x) / SR, 3)})
            print(f"{file:28s} {measured:6.1f} LUFS → {target}  gain {gain_db:+5.1f}  limit {limited:4.1f}  {len(x) / SR:5.2f}s")
    shipped = {f for c in m["cues"] for f in m["sounds"][c]["files"]}
    if not only:  # nothing left over from an old manifest
        for f in os.listdir(OUT):
            if f.endswith(".m4a") and f not in shipped:
                os.remove(os.path.join(OUT, f))
    out = sorted((c for f, c in credits.items() if f in shipped), key=lambda c: c["file"])
    json.dump(out, open(credits_path, "w"), indent=1)
    json.dump(report, open(os.path.join(SRC, "prep-report.json"), "w"), indent=1)


if __name__ == "__main__":
    main(set(sys.argv[1:]))
