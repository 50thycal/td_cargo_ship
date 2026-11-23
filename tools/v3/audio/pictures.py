"""Waveform + spectrogram pictures of every shipped sound, for critique by eye.

  python3 tools/v3/audio/pictures.py

Writes docs/audio/cues/<cue>.png (every variant of the cue, one row each:
its waveform over its spectrogram, 0-16 kHz, log frequency) and one contact
sheet per family in docs/audio/sheets/, with a fingerprint table
(docs/audio/fingerprints.md): duration, attack, spectral centroid, the
low/mid/high energy split, and each cue's nearest neighbour, so two
weapons that sound alike show up as a small distance.
"""

import json
import os
import subprocess
import tempfile

import numpy as np
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from PIL import Image, ImageDraw, ImageFont  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
AUDIO = os.path.join(ROOT, "public/v3/audio")
OUT = os.path.join(ROOT, "docs/audio")
SR = 44100
W, HW, HS = 720, 90, 200

FAMILIES = {
    "gun": ["gun.", "rack.", "pd.", "glance"],
    "weapons": ["jet.", "napalm.", "burn.", "shrapnel.", "frigate.", "thermo.", "scatter.", "blade.", "flak.", "seeker.", "aegis.", "well.", "rail.", "tesla."],
    "weapon-state": ["weapon."],
    "threats": ["drone.", "missile.", "ballistic.", "impact.", "cluster.", "mothership.", "minidrone.", "supersonic.", "aircraft.", "strafer.", "bomber.", "sub.", "truck.", "debut."],
    "kills-hulls": ["kill.", "ship.", "carrier.", "last.", "repair"],
    "powerups": ["powerup.", "overdrive.", "timewarp.", "shield.", "steam."],
    "flow-ui": ["wave.", "map.", "run.", "raid.", "notice", "ui.", "draft.", "card.", "armory."],
    "music": ["menu.music", "battle.", "result.music"],
}

try:
    FONT = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 13)
except OSError:
    FONT = ImageFont.load_default()


def decode(path):
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"])
    x = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "stream=duration", "-of", "csv=p=0", path], text=True).strip())
    return x[: int(round(dur * SR))]


def strip(x, label):
    """Waveform (linear, ±1 = full scale, so a flat top is a clip) over a
    log-frequency STFT spectrogram (30 Hz-16 kHz, 0 to -90 dBFS). Our own
    STFT: ffmpeg's showspectrumpic with fscale=log paints a bright false
    band near 450 Hz on any broadband sound (round 3)."""
    fig, (a1, a2) = plt.subplots(2, 1, figsize=(7.2, 3.1), dpi=80, gridspec_kw={"height_ratios": [1, 2.2]}, facecolor="#080c12")
    t = np.arange(len(x)) / SR
    a1.plot(t, x, color="#7fd1ff", linewidth=0.5)
    a1.set_ylim(-1.05, 1.05)
    a1.set_xlim(0, max(t[-1], 0.05))
    a1.axhline(1, color="#ff5050", linewidth=0.4)
    a1.axhline(-1, color="#ff5050", linewidth=0.4)
    a1.set_title(label, color="#f0ecdc", fontsize=8, loc="left")
    a1.axis("off")
    nper = 1024
    hop = 128
    xx = np.concatenate([x, np.zeros(nper)])
    frames = np.lib.stride_tricks.sliding_window_view(xx, nper)[::hop] * np.hanning(nper)
    S = np.abs(np.fft.rfft(frames, axis=1)) / (nper / 4)
    db = 20 * np.log10(S + 1e-9).T
    f = np.fft.rfftfreq(nper, 1 / SR)
    tt = np.arange(db.shape[1]) * hop / SR
    keep = (f >= 30) & (f <= 16000)
    a2.pcolormesh(tt, f[keep], db[keep], vmin=-90, vmax=0, cmap="inferno", shading="auto", rasterized=True)
    a2.set_yscale("log")
    a2.set_yticks([50, 100, 250, 500, 1000, 2500, 5000, 10000])
    a2.set_yticklabels(["50", "100", "250", "500", "1k", "2.5k", "5k", "10k"], fontsize=6, color="#9aa")
    a2.tick_params(axis="x", labelsize=6, colors="#9aa")
    a2.set_xlim(0, max(t[-1], 0.05))
    a2.set_facecolor("black")
    fig.subplots_adjust(left=0.06, right=0.995, top=0.9, bottom=0.08, hspace=0.12)
    fig.canvas.draw()
    img = Image.frombuffer("RGBA", fig.canvas.get_width_height(), fig.canvas.buffer_rgba()).convert("RGB")
    plt.close(fig)
    return img


def fingerprint(x):
    n = len(x)
    dur = n / SR
    env = np.abs(x)
    peak_i = int(np.argmax(env))
    attack_ms = peak_i / SR * 1000
    spec = np.abs(np.fft.rfft(x * np.hanning(n))) ** 2
    f = np.fft.rfftfreq(n, 1 / SR)
    tot = spec.sum() + 1e-20
    centroid = float((f * spec).sum() / tot)
    low = spec[f < 250].sum() / tot
    mid = spec[(f >= 250) & (f < 2500)].sum() / tot
    high = spec[f >= 2500].sum() / tot
    # Coarse 1/3-octave profile, for the distance between two sounds.
    edges = 50 * 2 ** (np.arange(0, 25) / 3)
    prof = np.array([spec[(f >= a) & (f < b)].sum() for a, b in zip(edges[:-1], edges[1:])]) / tot
    prof = 10 * np.log10(prof + 1e-9)
    return {"dur": dur, "attack_ms": attack_ms, "centroid": centroid, "low": low, "mid": mid, "high": high, "prof": prof}


def main():
    m = json.loads(subprocess.check_output(["npx", "vite-node", "tools/v3/audio/manifest-json.ts"], cwd=ROOT))
    os.makedirs(os.path.join(OUT, "cues"), exist_ok=True)
    os.makedirs(os.path.join(OUT, "sheets"), exist_ok=True)
    prints = {}
    rows = {}
    for cue in m["cues"]:
        d = m["sounds"][cue]
        strips = []
        for f in d["files"]:
            path = os.path.join(AUDIO, f)
            x = decode(path)
            if f.endswith(".1.m4a"):
                prints[cue] = fingerprint(x[: SR * 4])
            label = f"{f}   {len(x) / SR:.2f} s   bus {d['bus']}   vol {d['volume']}"
            strips.append(strip(x[: SR * 8], label))
        img = Image.new("RGB", (strips[0].width, sum(s.height for s in strips)), (8, 12, 18))
        y = 0
        for s in strips:
            img.paste(s, (0, y))
            y += s.height
        # A 64-colour palette keeps a picture to a few tens of kB.
        img.quantize(64, method=Image.Quantize.MEDIANCUT).save(os.path.join(OUT, "cues", f"{cue}.png"), optimize=True)
        rows[cue] = strips[0]
    for fam, prefixes in FAMILIES.items():
        cues = [c for c in m["cues"] if any(c.startswith(p) for p in prefixes)]
        cols = 3
        r = (len(cues) + cols - 1) // cols
        w, h = rows[cues[0]].size
        sheet = Image.new("RGB", (w * cols, h * r), (8, 12, 18))
        for i, c in enumerate(cues):
            sheet.paste(rows[c], ((i % cols) * w, (i // cols) * h))
        sheet.quantize(64, method=Image.Quantize.MEDIANCUT).save(os.path.join(OUT, "sheets", f"{fam}.png"), optimize=True)
    # Fingerprints and nearest neighbours (weapons against weapons, etc.)
    cues = list(prints)
    P = np.array([prints[c]["prof"] for c in cues])
    dist = np.sqrt(((P[:, None, :] - P[None, :, :]) ** 2).mean(axis=2))
    with open(os.path.join(OUT, "fingerprints.md"), "w") as out:
        out.write("# Sound fingerprints\n\nGenerated by `python3 tools/v3/audio/pictures.py` from each cue's first file. `nearest` is the cue with the most similar spectrum (RMS difference of the 1/3-octave profile, dB); a small number means two cues may sound alike.\n\n")
        out.write("| cue | dur s | attack ms | centroid Hz | low/mid/high % | nearest | dB |\n|---|---|---|---|---|---|---|\n")
        for i, c in enumerate(cues):
            d = dist[i].copy()
            d[i] = 1e9
            j = int(np.argmin(d))
            p = prints[c]
            out.write(f"| {c} | {p['dur']:.2f} | {p['attack_ms']:.0f} | {p['centroid']:.0f} | {p['low'] * 100:.0f}/{p['mid'] * 100:.0f}/{p['high'] * 100:.0f} | {cues[j]} | {d[j]:.1f} |\n")
    json.dump({c: {k: (v.tolist() if isinstance(v, np.ndarray) else v) for k, v in p.items()} for c, p in prints.items()}, open(os.path.join(ROOT, "assets-src/audio/fingerprints.json"), "w"))
    print(f"{len(rows)} cue pictures, {len(FAMILIES)} sheets → docs/audio/")


if __name__ == "__main__":
    main()
