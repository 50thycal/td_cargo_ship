"""Small DSP kit for Straitwatch's offline sound design (tools/v3/audio/synth.py).

Everything renders to float64 mono numpy arrays at SR. Deterministic: every
random choice goes through a numpy Generator the caller seeds, so the same
script run twice writes the same files.
"""

import numpy as np
from scipy import signal

SR = 44100


def secs(n):
    return int(round(n * SR))


def t_axis(dur):
    return np.arange(secs(dur)) / SR


# --- sources ---------------------------------------------------------------

def white(dur, rng):
    return rng.standard_normal(secs(dur))


def pink(dur, rng):
    """Voss-free pink noise: white shaped by a 1/f filter (Kellet)."""
    x = white(dur, rng)
    b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
    a = [1, -2.494956002, 2.017265875, -0.522189400]
    y = signal.lfilter(b, a, x)
    return y / (np.std(y) + 1e-12)


def brown(dur, rng):
    y = np.cumsum(white(dur, rng))
    y = signal.lfilter([1, -1], [1, -0.995], y)  # leak DC
    return y / (np.std(y) + 1e-12)


def osc(freq, dur, shape="sine", phase=0.0):
    """freq: a number or an array (per sample) for glides."""
    n = secs(dur)
    f = np.broadcast_to(np.asarray(freq, dtype=float), (n,)) if np.ndim(freq) == 0 else np.asarray(freq, dtype=float)[:n]
    ph = 2 * np.pi * np.cumsum(f) / SR + phase
    if shape == "sine":
        return np.sin(ph)
    if shape == "tri":
        return 2 / np.pi * np.arcsin(np.sin(ph))
    if shape == "saw":
        # band-limited-ish: sum a few partials, enough for these uses
        out = np.zeros(n)
        for k in range(1, 24):
            fk = f * k
            out += np.where(fk < SR * 0.45, np.sin(ph * k) / k, 0)
        return out * (2 / np.pi)
    if shape == "square":
        out = np.zeros(n)
        for k in range(1, 24, 2):
            fk = f * k
            out += np.where(fk < SR * 0.45, np.sin(ph * k) / k, 0)
        return out * (4 / np.pi)
    raise ValueError(shape)


def glide(f0, f1, dur, curve="exp"):
    t = np.linspace(0, 1, secs(dur))
    if curve == "exp":
        return f0 * (f1 / f0) ** t
    return f0 + (f1 - f0) * t


def crackle(dur, rng, rate=60.0, decay=0.004):
    """Sparse random clicks (debris, fire, static)."""
    n = secs(dur)
    out = np.zeros(n)
    count = rng.poisson(rate * dur)
    pos = rng.integers(0, n, count)
    amp = rng.uniform(0.3, 1.0, count) * rng.choice([-1, 1], count)
    out[pos] = amp
    k = np.exp(-np.arange(secs(decay * 6)) / (decay * SR))
    return np.convolve(out, k)[:n]


# --- envelopes ---------------------------------------------------------------

def env_exp(dur, tau, attack=0.002):
    t = t_axis(dur)
    e = np.exp(-t / tau)
    a = secs(attack)
    if a > 0:
        e[:a] *= np.linspace(0, 1, a) ** 0.5
    return e


def env_adsr(dur, a, d, s, r):
    n = secs(dur)
    e = np.zeros(n)
    ia, idd, ir = secs(a), secs(d), secs(r)
    isus = max(0, n - ia - idd - ir)
    seg = [np.linspace(0, 1, ia, endpoint=False), np.linspace(1, s, idd, endpoint=False), np.full(isus, s), np.linspace(s, 0, ir)]
    c = np.concatenate(seg)[:n]
    e[: len(c)] = c
    return e


def env_points(dur, pts):
    """Piecewise-linear envelope through (time, value) points."""
    t = t_axis(dur)
    ts, vs = zip(*pts)
    return np.interp(t, ts, vs)


# --- filters -----------------------------------------------------------------

def _sos(kind, f, order=2, q=None):
    f = np.clip(f, 20, SR * 0.45)
    if kind == "bp":
        lo, hi = f
        return signal.butter(order, [max(20, lo), min(SR * 0.45, hi)], btype="band", fs=SR, output="sos")
    return signal.butter(order, f, btype={"lp": "low", "hp": "high"}[kind], fs=SR, output="sos")


def lp(x, f, order=2):
    return signal.sosfilt(_sos("lp", f, order), x)


def hp(x, f, order=2):
    return signal.sosfilt(_sos("hp", f, order), x)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(_sos("bp", (lo, hi), order), x)


def peak(x, f, gain_db, q=1.0):
    b, a = signal.iirpeak(np.clip(f, 30, SR * 0.45), q, fs=SR)
    g = 10 ** (gain_db / 20) - 1
    return x + g * signal.lfilter(b, a, x)


def sweep(x, kind, f_curve, block=64):
    """A filter whose cutoff follows f_curve (per sample), run in blocks with
    the state carried over. kind: 'lp' | 'hp' | 'bp' (bp: f_curve is the
    centre, a one-octave band)."""
    out = np.zeros_like(x)
    zi = None
    for i in range(0, len(x), block):
        f = float(f_curve[min(i, len(f_curve) - 1)])
        if kind == "bp":
            sos = _sos("bp", (f / 1.41, f * 1.41), 1)
        else:
            sos = _sos(kind, f, 2)
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        out[i : i + block], zi = signal.sosfilt(sos, x[i : i + block], zi=zi)
    return out


def resonator(x, f, q=30.0):
    b, a = signal.iirpeak(np.clip(f, 30, SR * 0.45), q, fs=SR)
    return signal.lfilter(b, a, x)


# --- dynamics & colour --------------------------------------------------------

def sat(x, drive=1.0):
    return np.tanh(x * drive) / np.tanh(drive)


def norm(x, peak=0.9):
    m = np.max(np.abs(x)) + 1e-12
    return x * (peak / m)


def mix(*parts):
    n = max(len(p) for p in parts)
    out = np.zeros(n)
    for p in parts:
        out[: len(p)] += p
    return out


def at(x, delay, total=None):
    """x delayed by `delay` seconds."""
    d = secs(delay)
    y = np.concatenate([np.zeros(d), x])
    if total is not None:
        y = fit(y, total)
    return y


def fit(x, dur):
    n = secs(dur)
    if len(x) >= n:
        return x[:n]
    return np.concatenate([x, np.zeros(n - len(x))])


def fade(x, fin=0.002, fout=0.02):
    x = x.copy()
    a, b = secs(fin), secs(fout)
    if a:
        x[:a] *= np.linspace(0, 1, a)
    if b:
        x[-b:] *= np.linspace(1, 0, b) ** 2
    return x


# --- space --------------------------------------------------------------------

def ir(dur, rng, tau=0.4, damp=4000, pre=0.012, early=6):
    """A synthetic room/outdoor impulse response: a few early reflections then
    an exponentially decaying, darkening noise tail."""
    n = secs(dur)
    h = np.zeros(n)
    for k in range(early):
        p = secs(pre + rng.uniform(0.003, 0.05))
        if p < n:
            h[p] += rng.uniform(0.15, 0.4) * rng.choice([-1, 1])
    tail = white(dur, rng) * np.exp(-t_axis(dur) / tau)
    tail = sweep(tail, "lp", np.geomspace(damp, damp / 5, n), block=256)
    tail[: secs(pre)] = 0
    h += tail * 0.25
    return h


def reverb(x, rng, wet=0.25, dur=1.2, tau=0.4, damp=4000, pre=0.012):
    h = ir(dur, rng, tau, damp, pre)
    w = signal.fftconvolve(x, h)
    dry = np.concatenate([x, np.zeros(len(w) - len(x))])
    return dry + wet * w * (np.std(x) / (np.std(w[: len(x)]) + 1e-12))


def reverb_circular(x, rng, wet=0.25, dur=2.0, tau=0.6, damp=3500):
    """Reverb that wraps its tail round to the start: for seamless loops."""
    h = ir(dur, rng, tau, damp)
    n = len(x)
    w = signal.fftconvolve(x, h)
    wrapped = w[:n].copy()
    rest = w[n:]
    for i in range(0, len(rest), n):
        seg = rest[i : i + n]
        wrapped[: len(seg)] += seg
    return x + wet * wrapped * (np.std(x) / (np.std(wrapped) + 1e-12))
