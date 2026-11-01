"""Straitwatch V3: offline sound design. Every in-game sound effect and the
music beds are synthesized here, deterministically, and written as WAV
sources to assets-src/audio/synth/. tools/v3/audio-prep.ts then trims,
normalises and encodes them into public/v3/audio/.

Synthesized because the container that built round 1 could not reach any
sample library (Kenney, Freesound, OpenGameArt, Pixabay, Sonniss were all
blocked); synthesis is licence-safe by construction (the output is ours,
released CC0 with the game). To swap any sound for a recorded one, see
docs/design/v3-sound-round1.md ("Swapping a sound").

  python3 tools/v3/audio/synth.py            # everything
  python3 tools/v3/audio/synth.py kill.big   # just the names given
"""

import os
import sys

import numpy as np
from scipy.io import wavfile

sys.path.insert(0, os.path.dirname(__file__))
from dsp import *  # noqa: E402,F403

OUT = os.path.join(os.path.dirname(__file__), "../../../assets-src/audio/synth")
RECIPES = {}


def recipe(name, variants=1, loop=None):
    def deco(fn):
        RECIPES[name] = (fn, variants, loop)
        return fn

    return deco


def seed_of(name, v):
    return abs(hash_str(name)) * 31 + v


def hash_str(s):
    h = 2166136261
    for c in s.encode():
        h = ((h ^ c) * 16777619) & 0xFFFFFFFF
    return h


# =============================================================================
# Building blocks


def thump(f0, f1, dur, tau=None):
    tau = tau or dur / 4
    return osc(glide(f0, f1, dur), dur) * env_exp(dur, tau, 0.001)


def click(rng, dur=0.006, hpf=2000):
    return hp(white(dur, rng), hpf) * env_exp(dur, dur / 3, 0.0003)


def boom(rng, size=0.5, dur=None, dark=1.0):
    """An explosion: a crack, a body of noise darkening as it decays, a sub
    thump and a debris crackle, in a little outdoor space. size 0..1."""
    dur = dur or 0.45 + 1.4 * size
    crack = hp(white(0.03, rng), 1200) * env_exp(0.03, 0.006, 0.0005) * (0.9 - 0.3 * size)
    body_n = brown(dur, rng) * 0.6 + pink(dur, rng) * 0.4
    fc = np.geomspace(5200 * dark, 260 + 300 * (1 - size), secs(dur))
    body = sweep(body_n, "lp", fc) * env_points(dur, [(0, 0), (0.004, 1), (0.05, 0.75), (dur * 0.35, 0.3), (dur, 0)]) ** 1.3
    sub = thump(95 - 40 * size, 32, min(dur, 0.25 + 0.6 * size), 0.08 + 0.25 * size) * (0.7 + 0.6 * size)
    deb = bp(crackle(dur * 0.8, rng, rate=40 + 80 * size, decay=0.002), 1500, 7000) * env_exp(dur * 0.8, dur * 0.25) * 0.5 * size
    x = mix(crack, body * 1.1, sub, at(deb, 0.03))
    x = sat(x, 1.5 + size)
    return reverb(x, rng, wet=0.15 + 0.15 * size, dur=0.35 + 1.2 * size, tau=0.08 + 0.45 * size, damp=3000)


def hiss(rng, dur, f0, f1, q=1.0):
    n = pink(dur, rng)
    return sweep(n, "bp", glide(f0, f1, dur))


def rocket(rng, dur=0.6, bright=1.0, size=1.0):
    pop = thump(140 * size ** -0.3, 55, 0.12, 0.03) * 0.9
    ign = hp(white(0.02, rng), 1500) * env_exp(0.02, 0.004) * 0.6
    roar = hiss(rng, dur, 500 * bright, 2600 * bright) * env_points(dur, [(0, 0), (0.015, 1), (dur * 0.4, 0.55), (dur, 0)])
    roar += lp(brown(dur, rng), 500) * env_exp(dur, dur / 3) * 0.4 * size
    cr = hp(crackle(dur, rng, rate=120, decay=0.0015), 2500) * env_exp(dur, dur / 2.5) * 0.35
    return mix(pop, ign, roar * 0.7, cr)


def bell(freq, dur, rng=None, partials=((1, 1), (2.76, 0.5), (5.4, 0.25), (8.93, 0.12)), tau=None):
    tau = tau or dur / 3
    x = np.zeros(secs(dur))
    for k, (m, a) in enumerate(partials):
        x += a * osc(freq * m, dur) * env_exp(dur, tau / (1 + k * 0.6), 0.001)
    return x


def ring(rng, freqs, dur, q=40, strike_dur=0.004, gains=None):
    """Struck metal by modal synthesis: each mode a decaying partial, the
    higher ones dying faster, with a short bright strike on top. `q` sets
    how long it rings (higher: longer). Round 2: this used narrow
    resonators, which at these Qs ring for only 4-20 ms, so every "ring"
    was really a click."""
    t = t_axis(dur)
    out = np.zeros(len(t))
    for i, f in enumerate(freqs):
        g = 1 if gains is None else gains[i]
        tau = min(dur / 2.5, q / (np.pi * f) * 6) / (1 + 0.35 * i)
        det = f * rng.uniform(0.997, 1.003)
        out += g * np.sin(2 * np.pi * det * t + rng.uniform(0, 6.28)) * np.exp(-t / tau)
    strike = hp(white(strike_dur, rng), 1500) * np.hanning(secs(strike_dur))
    out = out / (np.max(np.abs(out)) + 1e-12)
    return mix(out * env_points(dur, [(0, 0), (0.0007, 1), (dur, 1)]), strike * 0.35) * env_points(dur, [(0, 1), (dur * 0.85, 1), (dur, 0)])


def zap(rng, dur, f0=3000, f1=200):
    s = osc(glide(f0, f1, dur), dur, "saw") * env_exp(dur, dur / 4, 0.0005)
    n = hp(white(dur, rng), 3000) * env_exp(dur, dur / 3) * (rng.random(secs(dur)) > 0.6)
    return lp(s, 9000) * 0.6 + n * 0.4


def guns(rng, shots, gap, pop_dur=0.05, low=1.0, jitter=0.15):
    total = shots * gap + pop_dur + 0.2
    out = np.zeros(secs(total))
    for i in range(shots):
        t = i * gap * (1 + rng.uniform(-jitter, jitter))
        p = mix(click(rng, 0.004, 2500) * 0.8, lp(white(pop_dur, rng), 3200) * env_exp(pop_dur, pop_dur / 4), thump(220 * low, 90 * low, pop_dur * 1.5, 0.012) * 0.9)
        out = mix(out, at(p * rng.uniform(0.75, 1.0), t))
    return reverb(sat(out, 1.6), rng, wet=0.15, dur=0.6, tau=0.18)


def make_loop(x, length, xfade=0.15):
    """x rendered longer than `length`: the overhang crossfades into the
    start, so the loop has no seam."""
    n, f = secs(length), secs(xfade)
    y = x[:n].copy()
    over = x[n : n + f]
    w = np.linspace(0, 1, len(over))
    y[: len(over)] = y[: len(over)] * np.sqrt(w) + over * np.sqrt(1 - w)
    return y


# =============================================================================
# Gun and ammo


@recipe("gun.fire", 4)
def _(rng, v):
    # The carrier's interceptor leaving its rail: a tight thump, a crack and
    # a short rising hiss. Frequent, so it is short and not too low.
    d = 0.42
    hs = hiss(rng, d, 700 + 120 * v, 3400 + 200 * v) * env_points(d, [(0, 0), (0.01, 1), (0.12, 0.45), (d, 0)])
    x = mix(click(rng, 0.005, 1800), thump(150 + 8 * v, 70, 0.09, 0.025) * 0.9, hs * 0.55)
    return reverb(sat(x, 1.4), rng, wet=0.12, dur=0.5, tau=0.12)


@recipe("gun.dry", 2)
def _(rng, v):
    # An empty breech: a hard trigger click, then the bolt clacking home on
    # nothing (a hollow body under it, so it reads at phone volume).
    a = ring(rng, [2200 + 90 * v, 3700, 5100], 0.18, q=25)
    b = ring(rng, [620, 1150 + 70 * v, 1900], 0.3, q=14)
    return mix(a * 0.5, at(b, 0.05), at(thump(240, 160, 0.1, 0.03) * 0.35, 0.05))


@recipe("gun.reload", 3)
def _(rng, v):
    # A round seated in the rack: a soft two-part clack.
    a = ring(rng, [900 + 60 * v, 1650, 2800], 0.25, q=12)
    b = ring(rng, [1400 + 80 * v, 2600], 0.2, q=16) * 0.7
    return mix(a, at(b, 0.035), thump(200, 140, 0.08, 0.025) * 0.3)


@recipe("gun.burst", 4)
def _(rng, v):
    d = 0.32
    pop = lp(white(d, rng), 3200) * env_exp(d, 0.03, 0.0005)
    x = mix(click(rng, 0.004, 2500) * 0.6, pop, thump(210 + 10 * v, 85, 0.12, 0.03) * 0.8)
    return reverb(sat(x, 1.3), rng, wet=0.2, dur=0.6, tau=0.2)


@recipe("rack.full")
def _(rng, v):
    out = np.zeros(secs(0.6))
    t = 0.0
    for i, g in enumerate([0.07, 0.06, 0.05, 0.045]):
        out = mix(out, at(ring(rng, [1700 + 150 * i, 3900, 5600], 0.06, q=20) * 0.7, t))
        t += g
    out = mix(out, at(mix(ring(rng, [900, 1450, 2600], 0.25, q=30), thump(180, 120, 0.08, 0.02) * 0.6), t + 0.03))
    return out


# =============================================================================
# Weapons


def jet(rng, dur, peak_at, whine0, whine1, size=1.0):
    e = env_points(dur, [(0, 0), (peak_at * 0.6, 0.35), (peak_at, 1), (peak_at + (dur - peak_at) * 0.4, 0.45), (dur, 0)])
    roar = sweep(pink(dur, rng), "lp", np.interp(t_axis(dur), [0, peak_at, dur], [1800, 6500, 900]))
    rumble = lp(brown(dur, rng), 260) * 0.8 * size
    wh = osc(np.interp(t_axis(dur), [0, peak_at, dur], [whine0, whine0 * 0.97, whine1]), dur) * 0.12
    wh += osc(np.interp(t_axis(dur), [0, peak_at, dur], [whine0 * 1.5, whine0 * 1.45, whine1 * 1.5]), dur) * 0.05
    return reverb(sat((roar + rumble + wh) * e, 1.3), rng, wet=0.25, dur=1.5, tau=0.5)


@recipe("jet.flyby", 2)
def _(rng, v):
    # Your jet: a deep, smooth rush that swells as it passes (darker than
    # the enemy strafer's scream).
    return lp(jet(rng, 2.6, 1.0, 1500 + 120 * v, 900, size=1.4), 5000)


@recipe("jet.guns", 3)
def _(rng, v):
    return guns(rng, 6, 0.032, 0.04, low=1.1)


@recipe("napalm.drop", 2)
def _(rng, v):
    d = 0.5
    clunk = mix(ring(rng, [420, 760, 1300], 0.12, q=14), thump(160, 110, 0.06, 0.015) * 0.6)
    tumble = osc(glide(1500 - 80 * v, 650, d), d) * env_points(d, [(0, 0), (0.05, 0.35), (d * 0.8, 0.2), (d, 0)])
    tumble *= 0.75 + 0.25 * np.sin(2 * np.pi * 14 * t_axis(d))  # spin
    return mix(clunk * 0.5, at(tumble * 0.9 + hiss(rng, d, 900, 600) * 0.35 * env_exp(d, 0.2), 0.03))


@recipe("napalm.burst", 3)
def _(rng, v):
    d = 1.3
    whoomp = sweep(brown(d, rng), "lp", np.interp(t_axis(d), [0, 0.12, d], [250, 2600, 500])) * env_points(d, [(0, 0), (0.03, 1), (0.25, 0.6), (d, 0)])
    fire = bp(crackle(d, rng, rate=140, decay=0.003), 800, 6000) * env_points(d, [(0, 0), (0.08, 1), (d, 0)]) * 0.5
    x = mix(whoomp * 1.1, fire, thump(80, 35, 0.4, 0.12) * 0.9, click(rng, 0.006, 900) * 0.4)
    return reverb(sat(x, 1.8), rng, wet=0.25, dur=1.2, tau=0.4)


@recipe("burn.loop", 1, loop=3.0)
def _(rng, v):
    d = 3.3
    body = lp(brown(d, rng), 700) * (0.7 + 0.3 * np.sin(2 * np.pi * (1 / 3.0) * t_axis(d) * 2))
    cr = bp(crackle(d, rng, rate=55, decay=0.0025), 1200, 7000) * 0.6
    roar = bp(pink(d, rng), 300, 1500) * 0.35
    return make_loop(body + cr + roar, 3.0, 0.3)


@recipe("shrapnel.burst", 3)
def _(rng, v):
    d = 0.7
    core = mix(click(rng, 0.006, 1500), thump(180, 70, 0.1, 0.025), lp(white(0.1, rng), 5000) * env_exp(0.1, 0.02))
    frags = np.zeros(secs(d))
    for i in range(14):
        t = rng.uniform(0.01, 0.22)
        f = rng.uniform(2500, 7500)
        frags = mix(frags, at(ring(rng, [f, f * 1.37], 0.09, q=50) * rng.uniform(0.2, 0.5), t))
    whizz = hiss(rng, 0.3, 6000, 2500) * env_exp(0.3, 0.08) * 0.3
    return reverb(sat(mix(core, frags, whizz), 1.4), rng, wet=0.2, dur=0.7, tau=0.2)


def horn(rng, f, dur, swell=0.15):
    e = env_adsr(dur, swell, 0.1, 0.85, 0.35)
    tone = osc(f, dur, "saw") + 0.6 * osc(f * 1.5, dur, "saw") + 0.4 * osc(f * 1.003, dur, "saw")
    x = lp(tone, 900) * e
    return reverb(x, rng, wet=0.35, dur=2.0, tau=0.7, damp=2500)


@recipe("frigate.arrive")
def _(rng, v):
    engine = lp(brown(2.0, rng), 160) * env_points(2.0, [(0, 0), (0.6, 0.6), (2.0, 0)]) * 0.5
    return mix(horn(rng, 98, 1.5), engine)


@recipe("frigate.fire", 3)
def _(rng, v):
    d = 0.7
    x = mix(click(rng, 0.004, 1500) * 0.9, lp(white(0.08, rng), 4500) * env_exp(0.08, 0.015), thump(110 + 6 * v, 45, 0.25, 0.06) * 1.1)
    return reverb(sat(x, 2.0), rng, wet=0.3, dur=0.9, tau=0.3)


@recipe("frigate.leave")
def _(rng, v):
    return horn(rng, 87, 1.0, 0.08)


@recipe("thermo.burst", 2)
def _(rng, v):
    # The biggest blast you own: a sharp intake, a huge punch, then a long
    # rolling rumble that falls away (round 3: it was a flat 2.5 s roar with
    # no punch at the front).
    d = 3.4
    pre = hiss(rng, 0.12, 200, 1200) * env_points(0.12, [(0, 0), (0.11, 1), (0.12, 0)]) * 0.3
    punch = boom(rng, 1.0, 1.4, dark=0.9) * 1.2
    sub = thump(58, 22, 1.2, 0.4) * 1.4
    roll = lp(brown(d, rng), 220) * env_points(d, [(0, 0), (0.15, 0.7), (0.8, 0.45), (2.0, 0.15), (d, 0)])
    deb = bp(crackle(1.5, rng, rate=50, decay=0.004), 600, 4000) * env_exp(1.5, 0.4) * 0.3
    x = mix(at(mix(punch, sub, roll * 0.8, at(deb, 0.15)), 0.11), pre)
    x = reverb(sat(x, 1.6), rng, wet=0.3, dur=1.4, tau=0.6, damp=1800)
    return fit(x, 3.6) * env_points(3.6, [(0, 1), (2.6, 1), (3.6, 0)])


@recipe("scatter.blast", 3)
def _(rng, v):
    # A shotgun, not a cannon (round 3: it looked like the frigate's gun on
    # the spectrogram): a bright crack, a rattle of pellets whizzing off and
    # the barrel's short metal ring; little low end.
    d = 0.5
    crack = hp(white(0.012, rng), 2500) * env_exp(0.012, 0.003) * 1.3
    body = bp(white(d, rng), 900, 5000) * env_exp(d, 0.035, 0.0005)
    pellets = np.zeros(secs(d))
    for i in range(18):
        f = rng.uniform(3500, 9000)
        w = osc(glide(f, f * 0.7, 0.05), 0.05) * env_exp(0.05, 0.012, 0.001)
        pellets = mix(pellets, at(w * rng.uniform(0.15, 0.35), rng.uniform(0.005, 0.12)))
    barrel = ring(rng, [1850 + 60 * v, 3100, 4700], 0.25, q=40) * 0.25
    x = mix(crack, body * 0.9, pellets, barrel, thump(170, 90, 0.07, 0.015) * 0.35)
    return reverb(sat(x, 1.8), rng, wet=0.15, dur=0.5, tau=0.15, damp=6000)


@recipe("blade.throw", 2)
def _(rng, v):
    d = 0.35
    # A heavy blade leaving: a low swish and a bright metal "shing" (round 3:
    # the swish alone measured 2 dB from the Seekers' launch).
    sw = sweep(pink(d, rng), "bp", np.interp(t_axis(d), [0, 0.12, d], [400, 1500 + 150 * v, 500])) * env_points(d, [(0, 0), (0.1, 1), (d, 0)])
    shing = ring(rng, [3100, 4450, 6020], 0.5, q=400) * 0.6
    return mix(sw, shing)


@recipe("blade.spin", 1, loop=1.0)
def _(rng, v):
    d = 1.15
    rate = 8.0  # whooshes a second: 8 cycles in the 1 s loop
    am = (0.5 + 0.5 * np.sin(2 * np.pi * rate * t_axis(d))) ** 3
    sw = bp(pink(d, rng), 900, 3500) * am
    hum = osc(rate * 40, d, "tri") * 0.05
    return make_loop(sw + hum, 1.0, 0.125)


@recipe("blade.catch", 2)
def _(rng, v):
    # Caught in the launcher's jaws: a heavy metal clamp that rings on.
    clamp = ring(rng, [440 + 20 * v, 690, 1150], 0.35, q=10)
    tone = ring(rng, [880 + 40 * v, 1390, 2310, 3500], 0.9, q=200)
    return mix(clamp * 0.6, tone * 0.8, thump(200, 130, 0.1, 0.03) * 0.25, click(rng, 0.004, 2000) * 0.1)


@recipe("blade.hit", 3)
def _(rng, v):
    d = 0.2
    sl = hp(white(d, rng), 2500) * env_exp(d, 0.035, 0.002)
    return sat(mix(sl * 0.6, ring(rng, [2600 + 300 * v, 3900, 5500], 0.2, q=50) * 0.7, thump(260, 140, 0.05, 0.012) * 0.5), 2.0)


@recipe("flak.burst", 3)
def _(rng, v):
    # Flak: a high airburst, "crack-whump" with a hiss of steel splinters
    # after it (round 3: it measured as a twin of kill.missile).
    d = 0.9
    crack = hp(white(0.01, rng), 3000) * env_exp(0.01, 0.002) * 1.4
    whump = mix(thump(140 + 8 * v, 70, 0.18, 0.05), lp(brown(0.3, rng), 600) * env_exp(0.3, 0.06) * 0.8)
    splinters = bp(crackle(d, rng, rate=260, decay=0.0008), 2500, 9000) * env_points(d, [(0, 0), (0.02, 1), (d, 0)]) ** 2 * 0.6
    hissing = hiss(rng, d, 7000, 3000) * env_exp(d, 0.18) * 0.25
    x = mix(crack, at(whump, 0.004), splinters, hissing)
    return reverb(sat(x, 1.6), rng, wet=0.35, dur=0.9, tau=0.35, damp=4500)


@recipe("flak.cloud", 3)
def _(rng, v):
    # The cloud's crackle: a rattle of small distant pops, more body than
    # snap (round 2: three bare pops were all peak and no level).
    out = np.zeros(secs(0.45))
    for i in range(6):
        t = rng.uniform(0, 0.2)
        p = mix(lp(white(0.12, rng), 1600) * env_exp(0.12, 0.03, 0.003), thump(220, 150, 0.06, 0.02) * 0.4)
        out = mix(out, at(p * rng.uniform(0.5, 0.9), t))
    return reverb(sat(out, 1.5), rng, wet=0.35, dur=0.6, tau=0.25, damp=2000)


@recipe("seeker.launch", 2)
def _(rng, v):
    # A swarm: four or five small missiles "fwip-fwip-fwip" off the rail,
    # each a quick rising whistle (round 3: a hiss like Aegis's, 2.5 dB
    # apart on the fingerprints).
    out = np.zeros(secs(0.7))
    for i in range(4 + v):
        d = 0.16
        f0 = rng.uniform(1100, 1500)
        chirp = osc(glide(f0, f0 * 2.6, d), d) * env_points(d, [(0, 0), (0.01, 0.6), (d, 0)])
        fwip = sweep(pink(d, rng), "bp", glide(1500, 7000, d)) * env_points(d, [(0, 0), (0.008, 1), (d, 0)])
        out = mix(out, at(mix(chirp * 0.35 + fwip * 0.8, click(rng, 0.003, 3000) * 0.4) * rng.uniform(0.7, 1.0), i * 0.05 + rng.uniform(0, 0.012)))
    return reverb(sat(out, 1.3), rng, wet=0.18, dur=0.5, tau=0.15)


@recipe("aegis.launch", 3)
def _(rng, v):
    # A ship's own launcher: a hatch thunk, then one heavier, lower whoosh.
    hatch = mix(ring(rng, [310 + 15 * v, 520, 840], 0.12, q=12) * 0.6, thump(110, 70, 0.08, 0.02) * 0.8)
    d = 0.5
    whoosh = sweep(pink(d, rng), "bp", glide(350, 1800, d)) * env_points(d, [(0, 0), (0.03, 1), (0.25, 0.5), (d, 0)])
    roar = lp(brown(d, rng), 400) * env_exp(d, 0.15) * 0.5
    return reverb(mix(hatch, at(whoosh + roar, 0.03)), rng, wet=0.18, dur=0.5, tau=0.15)


@recipe("aegis.reload")
def _(rng, v):
    d = 0.22
    motor = lp(osc(glide(260, 620, d), d, "saw"), 2000) * env_points(d, [(0, 0), (0.02, 0.5), (d, 0.3)]) * 0.9
    return mix(motor, at(mix(ring(rng, [700, 1200, 2400], 0.12, q=20), click(rng, 0.004) * 0.5), d - 0.01))


@recipe("well.open")
def _(rng, v):
    # A vortex tearing open: a falling FM "wub" with harmonics, around a
    # reversed rush (round 3: it read as a muffled explosion).
    d = 1.0
    t = t_axis(d)
    f = glide(700, 55, d)
    mod = osc(f * 0.5, d) * 3.0
    ph = 2 * np.pi * np.cumsum(f) / SR + mod
    tone = (np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.25 * np.sin(3 * ph)) * env_points(d, [(0, 0), (0.03, 1), (0.6, 0.6), (d, 0)])
    wobble = 0.7 + 0.3 * np.sin(2 * np.pi * glide(14, 4, d).cumsum() / SR)
    swell = hiss(rng, d, 4000, 250) * env_points(d, [(0, 0.8), (0.4, 0.4), (d, 0)]) * 0.35
    x = mix(lp(tone * wobble, 3000) * 0.8, swell, thump(90, 40, 0.3, 0.1) * 0.5)
    return reverb(x, rng, wet=0.4, dur=1.4, tau=0.6, damp=2500)


@recipe("well.pull", 1, loop=2.0)
def _(rng, v):
    d = 2.25
    t = t_axis(d)
    hum = osc(55, d) + 0.7 * osc(82.5, d) + 0.35 * osc(110.5, d)  # 0.5 Hz beat: one cycle a loop
    swirl = sweep(pink(d, rng), "bp", 600 + 450 * np.sin(2 * np.pi * 1.0 * t)) * 0.35
    am = 0.75 + 0.25 * np.sin(2 * np.pi * 2.0 * t)
    return make_loop((lp(hum, 400) * 0.6 + swirl) * am, 2.0, 0.25)


@recipe("well.implode", 2)
def _(rng, v):
    suck_d = 0.28
    suck = hiss(rng, suck_d, 300, 4000) * env_points(suck_d, [(0, 0), (suck_d * 0.95, 1), (suck_d, 0.2)]) ** 2
    blast = mix(thump(120, 30, 0.6, 0.18) * 1.3, click(rng, 0.006, 1500), lp(brown(0.6, rng), 900) * env_exp(0.6, 0.12))
    x = mix(suck * 0.6, at(blast, suck_d - 0.01))
    return reverb(sat(x, 1.6), rng, wet=0.3, dur=1.0, tau=0.4)


@recipe("rail.beam", 3)
def _(rng, v):
    d = 0.9
    crack = hp(white(0.01, rng), 3000) * env_exp(0.01, 0.002) * 1.2
    z = zap(rng, 0.35, 4200 + 300 * v, 160)
    sizzle = hp(white(d, rng), 5000) * env_exp(d, 0.18) * 0.3 * (0.6 + 0.4 * (rng.random(secs(d)) > 0.5))
    low = thump(95, 40, 0.3, 0.08)
    x = mix(crack, z * 0.8, sizzle, low * 0.9)
    return reverb(sat(x, 1.5), rng, wet=0.22, dur=0.9, tau=0.35, damp=6000)


@recipe("tesla.arc", 4)
def _(rng, v):
    d = 0.26
    # The gate flickers every few ms (lp-smoothed: hard gating made it all
    # peaks and no body, round 2).
    gate = lp((rng.random(secs(d)) > 0.35).astype(float), 400)
    buzz = bp(osc(118 + 7 * v, d, "saw") * gate, 300, 6000)
    snap = hp(white(d, rng), 4000) * lp((rng.random(secs(d)) > 0.8).astype(float), 900) * 0.6
    return sat(mix(click(rng, 0.003, 4000) * 0.5, (buzz * 0.7 + snap) * env_exp(d, 0.09, 0.0005)), 2.5)


# =============================================================================
# Weapon state


@recipe("weapon.drop")
def _(rng, v):
    a = bell(880, 0.7) * 0.6
    b = bell(1318.5, 0.7) * 0.5
    return reverb(mix(a, at(b, 0.09)), rng, wet=0.25, dur=0.8, tau=0.3)


@recipe("weapon.load", 2)
def _(rng, v):
    d = 0.5
    clack = mix(ring(rng, [520, 900, 1700, 2600], 0.15, q=20), thump(170, 90, 0.06, 0.015) * 0.7)
    whine = lp(osc(glide(180, 900 + 60 * v, 0.3), 0.3, "saw"), 3000) * env_points(0.3, [(0, 0), (0.25, 0.5), (0.3, 0)])
    chunk = mix(thump(140, 70, 0.1, 0.03), ring(rng, [380, 640], 0.12, q=12) * 0.6)
    return mix(clack, at(whine * 0.5, 0.05), at(chunk, 0.34))


@recipe("weapon.expiring")
def _(rng, v):
    out = np.zeros(secs(1.0))
    for i in range(4):
        out = mix(out, at(osc(1500 - 120 * i, 0.06, "tri") * env_exp(0.06, 0.02, 0.001) * (0.5 + 0.12 * i), i * 0.22))
    return out


@recipe("weapon.done")
def _(rng, v):
    d = 0.5
    down = lp(osc(glide(700, 140, d), d, "saw"), 2500) * env_points(d, [(0, 0.6), (d, 0)])
    return mix(click(rng, 0.004) * 0.5, down * 0.6, at(ring(rng, [400, 650], 0.1, q=15) * 0.5, 0.42))


# =============================================================================
# Threats


@recipe("drone.launch", 3)
def _(rng, v):
    d = 0.5
    pneu = mix(hp(white(0.08, rng), 900) * env_exp(0.08, 0.02), thump(130, 80, 0.06, 0.015) * 0.6)
    motor = lp(osc(165 + 12 * v, d, "saw"), 1500) * env_points(d, [(0, 0), (0.06, 0.6), (d, 0)])
    motor *= 0.8 + 0.2 * np.sin(2 * np.pi * 31 * t_axis(d))
    return reverb(mix(pneu * 0.5, at(motor * 0.9, 0.03)), rng, wet=0.2, dur=0.6, tau=0.2)


@recipe("missile.launch", 3)
def _(rng, v):
    return reverb(rocket(rng, 0.9, bright=0.85 + 0.08 * v, size=1.0), rng, wet=0.25, dur=1.0, tau=0.35)


@recipe("ballistic.launch", 2)
def _(rng, v):
    d = 1.4
    roar = lp(brown(d, rng), 500) * env_points(d, [(0, 0), (0.08, 1), (0.6, 0.6), (d, 0)])
    hs = hiss(rng, d, 400, 1500) * env_points(d, [(0, 0), (0.1, 0.7), (d, 0)]) * 0.5
    cr = bp(crackle(d, rng, rate=90, decay=0.003), 500, 4000) * env_exp(d, 0.5) * 0.4
    x = mix(thump(90, 40, 0.3, 0.08), roar * 1.2, hs, cr)
    return reverb(sat(x, 1.8), rng, wet=0.3, dur=1.4, tau=0.5, damp=2500)


@recipe("ballistic.whistle", 2)
def _(rng, v):
    d = 0.9
    t = t_axis(d)
    f = glide(2300 - 100 * v, 650, d) * (1 + 0.006 * np.sin(2 * np.pi * 9 * t))
    tone = osc(f, d) * env_points(d, [(0, 0), (0.25, 0.6), (0.85, 1), (d, 0)])
    air = sweep(pink(d, rng), "bp", f) * 0.25 * env_points(d, [(0, 0), (d * 0.9, 1), (d, 0)])
    return tone * 0.6 + air


@recipe("impact.splash", 3)
def _(rng, v):
    d = 1.4
    b = boom(rng, 0.5, 0.8, dark=0.6)
    wash = sweep(pink(d, rng), "bp", np.interp(t_axis(d), [0, 0.1, d], [800, 3500, 1500])) * env_points(d, [(0, 0), (0.05, 1), (0.4, 0.5), (d, 0)])
    drops = bp(crackle(d, rng, rate=70, decay=0.006), 1200, 5000) * env_points(d, [(0, 0), (0.3, 1), (d, 0)]) * 0.4
    return mix(b, wash * 0.6, drops)


@recipe("cluster.split", 2)
def _(rng, v):
    out = mix(click(rng, 0.006, 1500), thump(220, 110, 0.08, 0.02) * 0.7, lp(white(0.1, rng), 3500) * env_exp(0.1, 0.02))
    for i in range(4):
        f0 = rng.uniform(2200, 3200)
        w = osc(glide(f0, f0 * 0.55, 0.35), 0.35) * env_points(0.35, [(0, 0), (0.03, 0.25), (0.35, 0)])
        out = mix(out, at(w, 0.02 + i * 0.03))
    return reverb(out, rng, wet=0.2, dur=0.6, tau=0.2)


@recipe("mothership.spawn")
def _(rng, v):
    d = 1.5
    t = t_axis(d)
    hum = lp(osc(68, d, "saw") + osc(68.7, d, "saw") + 0.5 * osc(102, d, "saw"), 600)
    rotor = 0.7 + 0.3 * np.sin(2 * np.pi * 22 * t)
    return reverb(hum * rotor * env_points(d, [(0, 0), (0.6, 1), (d, 0)]) * 0.5, rng, wet=0.25, dur=1.2, tau=0.4)


@recipe("minidrone.spawn", 2)
def _(rng, v):
    d = 0.28
    return mix(hp(white(0.04, rng), 1500) * env_exp(0.04, 0.01) * 0.3, lp(osc(240 + 20 * v, d, "saw"), 2200) * env_points(d, [(0, 0), (0.03, 0.6), (d, 0)]))


@recipe("supersonic.lock", 1, loop=0.5)
def _(rng, v):
    out = np.zeros(secs(0.5))
    for i in range(4):
        beep = osc(1250, 0.06, "square") * env_adsr(0.06, 0.002, 0.01, 0.8, 0.01)
        out = mix(out, at(lp(beep, 5000) * 0.6, i * 0.125))
    return fit(out, 0.5)


@recipe("aircraft.warn")
def _(rng, v):
    out = np.zeros(secs(0.7))
    for i, f in enumerate([950, 1350, 950, 1350]):
        out = mix(out, at(lp(osc(f, 0.13, "square"), 4000) * env_adsr(0.13, 0.004, 0.02, 0.7, 0.02) * 0.5, i * 0.15))
    return out


@recipe("kill.small", 5)
def _(rng, v):
    # The commonest explosion: its tail is cut short so a swarm going down
    # doesn't smear into one roar (QA: hits stay under 1 s).
    x = fit(boom(rng, 0.22 + 0.04 * (v % 3), 0.55), 0.9)
    return x * env_points(0.9, [(0, 1), (0.45, 1), (0.9, 0)])


@recipe("kill.missile", 4)
def _(rng, v):
    return boom(rng, 0.5 + 0.04 * (v % 2), 1.0)


@recipe("kill.big", 3)
def _(rng, v):
    return boom(rng, 0.95, 2.0, dark=0.85)


@recipe("strafer.pass", 1, loop=2.0)
def _(rng, v):
    # An enemy strike jet: a harsh, screaming turbine over a ragged roar,
    # unlike your own Air Strike's smooth rush (round 3: the two measured
    # 1.2 dB apart). Held as a loop that pans with it.
    d = 2.3
    t = t_axis(d)
    roar = bp(pink(d, rng), 900, 7000) * (0.8 + 0.2 * np.sin(2 * np.pi * 3.0 * t))
    scream = sum(a * osc(f * (1 + 0.004 * np.sin(2 * np.pi * 6.5 * t)), d, "saw") for f, a in [(3150, 0.12), (4725, 0.06)])
    rumble = lp(brown(d, rng), 200) * 0.3
    return make_loop(sat(roar + lp(scream, 9000) + rumble, 2.2), 2.0, 0.3)


@recipe("strafer.guns", 2)
def _(rng, v):
    return guns(rng, 18, 0.042, 0.045, low=0.9, jitter=0.08)


@recipe("bomber.pass", 1, loop=2.0)
def _(rng, v):
    # Heavy engines droning, beating against each other (1 Hz: 62/63 Hz),
    # held as a loop while the bomber is on screen.
    d = 2.3
    eng = lp(osc(62, d, "saw") + osc(63, d, "saw") + 0.6 * osc(93, d, "saw") + 0.4 * osc(124.5, d, "saw"), 700)
    air = lp(pink(d, rng), 1400) * 0.5
    return make_loop(eng * 0.5 + air, 2.0, 0.3)


@recipe("bomber.drop", 2)
def _(rng, v):
    d = 0.5
    clunk = mix(ring(rng, [330, 610, 1150], 0.15, q=12), thump(140, 90, 0.07, 0.02) * 0.6)
    fall = hiss(rng, d, 2500, 700) * env_points(d, [(0, 0), (0.1, 0.6), (d, 0)])
    return mix(clunk * 0.5, at(fall * 0.9, 0.05))


def bubbles(rng, dur, rate=30, lo=300, hi=1000):
    out = np.zeros(secs(dur))
    for _ in range(int(rate * dur)):
        f = rng.uniform(lo, hi)
        bd = rng.uniform(0.03, 0.08)
        b = osc(glide(f, f * 1.6, bd), bd) * env_exp(bd, bd / 3, 0.002)
        out = mix(out, at(b * rng.uniform(0.2, 0.6), rng.uniform(0, dur - bd)))
    return fit(out, dur)


@recipe("sub.surface")
def _(rng, v):
    d = 1.8
    rush = sweep(pink(d, rng), "lp", np.interp(t_axis(d), [0, 1.0, d], [400, 2600, 800])) * env_points(d, [(0, 0), (1.0, 1), (d, 0)])
    return reverb(mix(rush * 0.7, bubbles(rng, d, 25), lp(brown(d, rng), 150) * env_points(d, [(0, 0), (0.8, 0.5), (d, 0)])), rng, wet=0.2, dur=0.8, tau=0.3)


@recipe("sub.fire", 2)
def _(rng, v):
    d = 0.6
    thunk = mix(thump(110, 60, 0.12, 0.03), ring(rng, [260, 470], 0.15, q=10) * 0.5)
    spray = sweep(white(d, rng), "bp", np.interp(t_axis(d), [0, 0.1, d], [1500, 4500, 2500])) * env_points(d, [(0, 0), (0.05, 1), (d, 0)])
    return mix(thunk, at(spray * 0.45, 0.03))


@recipe("sub.dive")
def _(rng, v):
    d = 1.5
    gurgle = lp(brown(d, rng), 300) * env_points(d, [(0, 0), (0.3, 0.8), (d, 0)])
    return reverb(mix(bubbles(rng, d, 45, 200, 700), gurgle * 0.6), rng, wet=0.2, dur=0.8, tau=0.3)


@recipe("sub.destroyed")
def _(rng, v):
    d = 2.2
    b = lp(boom(rng, 0.9, 1.6, dark=0.5), 700) * 1.3
    return mix(b, at(bubbles(rng, 1.8, 50, 150, 600), 0.2), at(sweep(pink(1.6, rng), "lp", np.geomspace(3000, 400, secs(1.6))) * env_exp(1.6, 0.5) * 0.4, 0.1))


@recipe("truck.raise")
def _(rng, v):
    d = 0.75
    motor = lp(osc(glide(110, 210, d), d, "saw"), 1100) * env_points(d, [(0, 0), (0.05, 0.6), (d * 0.9, 0.6), (d, 0)])
    hyd = bp(pink(d, rng), 2000, 6000) * env_points(d, [(0, 0), (0.1, 0.3), (d, 0)])
    return mix(motor * 0.5, hyd * 0.4, at(ring(rng, [350, 900], 0.1, q=15) * 0.5, d - 0.08))


@recipe("truck.fire", 2)
def _(rng, v):
    return mix(ring(rng, [500, 840, 1630], 0.12, q=15) * 0.5, rocket(rng, 0.35, bright=1.1, size=0.6) * 0.8)


@recipe("truck.destroyed")
def _(rng, v):
    clatter = np.zeros(secs(1.2))
    for i in range(8):
        f = rng.uniform(400, 2400)
        clatter = mix(clatter, at(ring(rng, [f, f * 1.43], 0.15, q=25) * rng.uniform(0.15, 0.4), rng.uniform(0.15, 1.0)))
    return mix(boom(rng, 0.8, 1.7), clatter)


@recipe("debut.sting")
def _(rng, v):
    d = 1.5
    chord = sum(osc(f, d, "saw") * a for f, a in [(73.4, 1), (110, 0.8), (146.8, 0.6), (174.6, 0.5), (155.6, 0.35)])
    stab = lp(chord, 1400) * env_adsr(d, 0.01, 0.2, 0.45, 0.8)
    timp = mix(thump(90, 70, 0.8, 0.25) * 0.9, lp(brown(0.4, rng), 400) * env_exp(0.4, 0.08) * 0.4)
    # A bright top (round 4: the low stab alone sank under explosions, most
    # of all on a phone's small speaker): high brass and a struck plate.
    top = sum(brass(f, d, rng, 4500) * a for f, a in [(587.3, 0.22), (698.5, 0.16), (880, 0.12)])
    plate = ring(rng, [1250, 1780, 2640, 3910], 1.2, q=300) * 0.35
    return reverb(sat(mix(stab * 0.4, timp, top, plate), 1.2), rng, wet=0.35, dur=1.8, tau=0.7, damp=3500)


# =============================================================================
# Hulls


@recipe("ship.hit", 3)
def _(rng, v):
    metal = ring(rng, [178 + 10 * v, 322, 508, 811, 1240], 0.9, q=35, gains=[1, 0.8, 0.6, 0.4, 0.25])
    return mix(boom(rng, 0.35, 0.8), metal * 0.45, thump(120, 60, 0.15, 0.04) * 0.6)


@recipe("ship.sunk", 2)
def _(rng, v):
    d = 3.0
    groan = lp(osc(glide(85 + 6 * v, 38, 2.4), 2.4, "saw"), 500) * env_points(2.4, [(0, 0), (0.3, 0.6), (2.4, 0)])
    groan *= 0.8 + 0.2 * np.sin(2 * np.pi * 3.3 * t_axis(2.4))
    water = sweep(pink(d, rng), "lp", np.geomspace(2800, 300, secs(d))) * env_points(d, [(0, 0), (0.4, 0.7), (d, 0)])
    return mix(boom(rng, 0.85, 1.8), at(groan * 0.45, 0.3), at(water * 0.4, 0.2), at(bubbles(rng, 2.0, 30, 150, 500), 0.8))


@recipe("ship.delivered")
def _(rng, v):
    return reverb(bell(1567.98, 0.5, partials=((1, 1), (2.0, 0.3), (3.0, 0.1))) * 0.5, rng, wet=0.2, dur=0.5, tau=0.2)


@recipe("carrier.hit", 2)
def _(rng, v):
    metal = ring(rng, [92 + 4 * v, 151, 237, 388, 602], 1.4, q=40, gains=[1, 0.9, 0.7, 0.5, 0.3])
    return mix(boom(rng, 0.75, 1.4, dark=0.8), metal * 0.6, thump(70, 30, 0.4, 0.12))


@recipe("carrier.critical", 1, loop=1.6)
def _(rng, v):
    d = 0.7
    whoop = osc(glide(330, 620, d, "lin"), d, "saw") * env_adsr(d, 0.02, 0.05, 0.9, 0.08)
    x = fit(lp(whoop, 2600) * 0.5, 1.6)
    return reverb_circular(x, rng, wet=0.2, dur=1.0, tau=0.3)


@recipe("last.ship")
def _(rng, v):
    out = np.zeros(secs(1.2))
    for i, f in enumerate([880, 740, 587]):
        tone = lp(osc(f, 0.22, "square") + osc(f * 1.005, 0.22, "square"), 3500) * env_adsr(0.22, 0.005, 0.05, 0.7, 0.05)
        out = mix(out, at(tone * 0.35, i * 0.25))
    return reverb(out, rng, wet=0.2, dur=0.6, tau=0.2)


@recipe("glance", 3)
def _(rng, v):
    d = 0.4
    ping = ring(rng, [2600 + 300 * v, 3900, 5100], 0.3, q=60)
    zing = osc(glide(3400, 1500, d), d) * env_exp(d, 0.1, 0.001) * 0.25
    return mix(click(rng, 0.004, 2500) * 0.6, ping * 0.6, zing)


def ratchet(rng, n=5, gap=0.045):
    out = np.zeros(secs(n * gap + 0.1))
    for i in range(n):
        out = mix(out, at(ring(rng, [2400, 3900], 0.04, q=18) * 0.5, i * gap))
    return out


@recipe("repair")
def _(rng, v):
    return mix(ratchet(rng), at(bell(1046.5, 0.5) * 0.4, 0.22))


@recipe("pd.fire", 3)
def _(rng, v):
    return mix(guns(rng, 8, 0.016, 0.03, low=1.4, jitter=0.05) * 0.8, hiss(rng, 0.2, 2000, 4000) * env_exp(0.2, 0.06) * 0.2)


# =============================================================================
# Power-ups


@recipe("powerup.drop")
def _(rng, v):
    out = np.zeros(secs(0.8))
    for i, f in enumerate([1046.5, 1318.5, 1568, 2093]):
        out = mix(out, at(bell(f, 0.4) * 0.3, i * 0.05))
    return reverb(out, rng, wet=0.3, dur=0.7, tau=0.3)


@recipe("powerup.expire")
def _(rng, v):
    d = 0.35
    return osc(glide(900, 450, d), d, "tri") * env_exp(d, 0.1, 0.002) * 0.5


@recipe("overdrive.on")
def _(rng, v):
    d = 0.8
    rise = sweep(osc(glide(90, 1100, d), d, "saw"), "lp", glide(400, 6000, d)) * env_points(d, [(0, 0), (0.7, 0.8), (d, 0)])
    return mix(rise * 0.5, at(mix(thump(150, 60, 0.2, 0.05), click(rng, 0.006) * 0.4), d - 0.1))


@recipe("overdrive.off")
def _(rng, v):
    d = 0.6
    return sweep(osc(glide(900, 110, d), d, "saw"), "lp", glide(5000, 300, d)) * env_points(d, [(0, 0.6), (d, 0)]) * 0.6


@recipe("timewarp.on")
def _(rng, v):
    d = 1.1
    tones = sum(osc(glide(f, f * 0.5, d), d) * a for f, a in [(523, 0.5), (659, 0.4), (784, 0.3)])
    rev = hp(pink(d, rng), 3000) * env_points(d, [(0, 0), (0.3, 0.5), (d, 0)]) * 0.3
    return reverb(tones * env_points(d, [(0, 0), (0.05, 1), (d, 0)]) + rev, rng, wet=0.4, dur=1.2, tau=0.6)


@recipe("timewarp.off")
def _(rng, v):
    d = 0.6
    tones = sum(osc(glide(f * 0.5, f, d), d) * a for f, a in [(523, 0.5), (659, 0.4), (784, 0.3)])
    return reverb(tones * env_points(d, [(0, 0), (0.1, 0.8), (d, 0)]), rng, wet=0.3, dur=0.8, tau=0.4)


@recipe("shield.on")
def _(rng, v):
    d = 0.9
    t = t_axis(d)
    ch = sum(osc(f * (1 + 0.004 * np.sin(2 * np.pi * 5 * t + k)), d) * a for k, (f, a) in enumerate([(294, 0.5), (440, 0.4), (587, 0.3), (880, 0.15)]))
    sh = hp(white(d, rng), 6000) * 0.15
    return reverb((ch + sh) * env_points(d, [(0, 0), (0.25, 1), (d, 0)]), rng, wet=0.35, dur=1.0, tau=0.4)


@recipe("shield.block", 3)
def _(rng, v):
    d = 0.3
    zing = osc(glide(1900 + 100 * v, 850, d), d) * env_exp(d, 0.07, 0.001)
    return mix(zing * 0.5, hp(white(0.05, rng), 3000) * env_exp(0.05, 0.01) * 0.4, osc(440, d) * env_exp(d, 0.08) * 0.2)


@recipe("shield.off")
def _(rng, v):
    d = 0.6
    ch = sum(osc(glide(f, f * 0.8, d), d) * a for f, a in [(294, 0.5), (440, 0.4), (587, 0.3)])
    return ch * env_points(d, [(0, 0.7), (d, 0)]) * 0.6


@recipe("steam.on")
def _(rng, v):
    d = 1.1
    whistle = (osc(523, d, "tri") + 0.6 * osc(784, d, "tri")) * env_adsr(d, 0.06, 0.1, 0.8, 0.3)
    steam = bp(white(d, rng), 2500, 8000) * env_adsr(d, 0.02, 0.1, 0.6, 0.3) * 0.4
    surge = lp(brown(d, rng), 200) * env_points(d, [(0, 0), (0.4, 0.6), (d, 0)])
    return reverb(mix(whistle * 0.3, steam, surge * 0.6), rng, wet=0.25, dur=1.0, tau=0.4)


@recipe("steam.off")
def _(rng, v):
    d = 0.7
    return bp(white(d, rng), 2000, 7000) * env_exp(d, 0.2, 0.005) * 0.5


@recipe("repair.pickup")
def _(rng, v):
    return mix(ratchet(rng, 4, 0.04), at(bell(1046.5, 0.5) * 0.35, 0.15), at(bell(1568, 0.5) * 0.3, 0.25))


# =============================================================================
# Waves and flow


@recipe("wave.start")
def _(rng, v):
    # A ship's bell: two strikes.
    b = lambda: bell(587, 1.4, partials=((1, 1), (2.0, 0.6), (2.98, 0.4), (4.1, 0.25), (5.43, 0.15)), tau=0.6)
    return reverb(mix(b() * 0.5, at(b() * 0.45, 0.28)), rng, wet=0.3, dur=1.5, tau=0.6)


def brass(f, dur, rng, bright=2500):
    tone = osc(f, dur, "saw") + osc(f * 1.004, dur, "saw") * 0.8 + osc(f * 0.996, dur, "saw") * 0.6
    return sweep(tone, "lp", np.interp(t_axis(dur), [0, 0.08, dur], [400, bright, bright * 0.6])) * env_adsr(dur, 0.04, 0.15, 0.75, 0.25)


@recipe("wave.cleared")
def _(rng, v):
    out = np.zeros(secs(1.8))
    notes = [(392, 0, 0.18), (523.25, 0.16, 0.18), (659.25, 0.32, 1.1)]
    for f, t, d in notes:
        out = mix(out, at(brass(f, d, rng) * 0.3 + brass(f / 2, d, rng) * 0.2, t))
    return reverb(out, rng, wet=0.3, dur=1.2, tau=0.5)


@recipe("map.cleared")
def _(rng, v):
    out = np.zeros(secs(4.0))
    seq = [([261.6, 329.6, 392], 0, 0.35), ([349.2, 440, 523.3], 0.4, 0.35), ([392, 493.9, 587.3], 0.8, 0.35), ([523.3, 659.3, 784], 1.2, 2.2)]
    for chord, t, d in seq:
        for f in chord:
            out = mix(out, at(brass(f, d, rng, 3000) * 0.18 + brass(f / 2, d, rng, 1500) * 0.1, t))
    out = mix(out, at(thump(100, 60, 0.6, 0.2) * 0.6, 1.2))
    return reverb(out, rng, wet=0.35, dur=1.6, tau=0.7)


@recipe("run.lost")
def _(rng, v):
    d = 3.2
    out = np.zeros(secs(d))
    for f in [110, 130.8, 164.8]:
        out = mix(out, brass(f, 1.0, rng, 1500) * 0.2)
    for f in [98, 116.5, 146.8]:
        out = mix(out, at(brass(f, 2.0, rng, 1200) * 0.2, 0.9))
    rumble = lp(brown(d, rng), 140) * env_points(d, [(0, 0), (0.5, 0.8), (d, 0)]) * 0.5
    return reverb(mix(out, rumble, thump(70, 30, 1.0, 0.3) * 0.7), rng, wet=0.4, dur=2.0, tau=0.9, damp=2000)


@recipe("raid.warning")
def _(rng, v):
    d = 1.5
    f = np.interp(t_axis(d), [0, 0.6, 1.0, d], [380, 880, 880, 500])
    siren = osc(f, d, "saw") + 0.5 * osc(f * 1.5, d, "saw")
    x = lp(siren, 3000) * env_points(d, [(0, 0), (0.15, 1), (1.1, 1), (d, 0)])
    return reverb(x * 0.4, rng, wet=0.35, dur=1.2, tau=0.5)


@recipe("raid.next")
def _(rng, v):
    # A wave's next raid: two short sonar pings, rising.
    out = np.zeros(secs(0.75))
    for i, f in enumerate([1180, 1570]):
        ping = osc(f, 0.35) * env_exp(0.35, 0.09, 0.003) + osc(f * 2.01, 0.35) * env_exp(0.35, 0.04, 0.003) * 0.25
        out = mix(out, at(ping * 0.6, i * 0.16))
    return reverb(out, rng, wet=0.35, dur=0.8, tau=0.3)


# =============================================================================
# Music. Seamless loops: whole bars, the reverb tail wrapped to the start.

BPM = 96
BEAT = 60 / BPM
BAR = BEAT * 4


def note(m):
    return 440 * 2 ** ((m - 69) / 12)


def pad(freqs, dur, rng, cutoff=1800, overlap=1.2):
    """A chord held for `dur`, plus `overlap` s of release into the next:
    0.25 s attack, so consecutive chords crossfade instead of dipping
    (round 5: a 1.25 s fade-in from silence left a hole at every change)."""
    total = dur + overlap
    x = np.zeros(secs(total))
    for f in freqs:
        for det in (0.997, 1.0, 1.003):
            x += osc(f * det, total, "saw") * 0.2
    e = env_points(total, [(0, 0), (0.25, 1), (dur, 0.85), (total, 0)])
    return lp(x, cutoff) * e


def kick(rng):
    return mix(thump(120, 42, 0.35, 0.1), click(rng, 0.004, 1500) * 0.3)


def snare(rng):
    return mix(bp(white(0.25, rng), 800, 7000) * env_exp(0.25, 0.06, 0.0005) * 0.6, osc(190, 0.1) * env_exp(0.1, 0.03) * 0.4)


def hat(rng, open_=False):
    d = 0.25 if open_ else 0.06
    return hp(white(d, rng), 7000) * env_exp(d, d / 3, 0.0005) * 0.25


def tom(rng, f):
    return thump(f * 1.4, f, 0.4, 0.12) * 0.8


def place(track, x, t):
    i = secs(t)
    end = min(len(track), i + len(x))
    track[i:end] += x[: end - i]


# Progression in D minor: Dm - Bb - F - C (i - VI - III - VII), two bars each.
PROG = [[50, 53, 57], [46, 50, 53], [53, 57, 60], [48, 52, 55]]


def music_bed(rng, bars, drums, bass16, lead, pad_cut, tail=True):
    length = bars * BAR
    pad_track = np.zeros(secs(length + 3))
    bass = np.zeros(secs(length + 3))
    dr = np.zeros(secs(length + 3))
    ld = np.zeros(secs(length + 3))
    for b in range(bars):
        chord = PROG[(b // 2) % 4]
        t0 = b * BAR
        if b % 2 == 0:
            place(pad_track, pad([note(m) for m in chord] + [note(chord[0] + 12)], BAR * 2, rng, pad_cut), t0)
        root = note(chord[0] - 12)
        steps = 16 if bass16 else 8
        for s in range(steps):
            st = t0 + s * BAR / steps
            d = BAR / steps * 0.9
            acc = 1.0 if s % 4 == 0 else 0.7
            bn = lp(osc(root * (2 if (bass16 and s % 8 == 7) else 1), d, "saw"), 700 if bass16 else 450) * env_adsr(d, 0.005, 0.05, 0.6, 0.03)
            place(bass, bn * acc * 0.35, st)
        if drums == 1:  # calm: low toms on 1 and the "and" of 3, soft hats
            place(dr, tom(rng, 70), t0)
            place(dr, tom(rng, 62) * 0.7, t0 + BEAT * 2.5)
            for s in range(8):
                place(dr, hat(rng) * (0.5 if s % 2 else 0.8), t0 + s * BEAT / 2)
        elif drums == 2:  # intense: kick, backbeat snare, 8th hats, tom fills
            for k in (0, 1.5, 2, 3.5) if b % 2 else (0, 2, 2.75):
                place(dr, kick(rng), t0 + k * BEAT)
            for k in (1, 3):
                place(dr, snare(rng), t0 + k * BEAT)
            for s in range(8):
                place(dr, hat(rng, s == 7) * (1 if s % 2 == 0 else 0.6), t0 + s * BEAT / 2)
            if b % 4 == 3:
                for i, f in enumerate([110, 95, 80, 68]):
                    place(dr, tom(rng, f) * 0.7, t0 + 3 * BEAT + i * BEAT / 4)
        if lead:
            # A stern horn line: chord tones, once a bar.
            m = chord[(b % 3)] + 12
            d = BEAT * 1.5
            ln = brass(note(m), d, rng, 2200) * 0.22
            place(ld, ln, t0 + (BEAT * 2 if b % 2 else 0))
    mixd = pad_track * 0.55 + bass + dr * 0.8 + ld
    n = secs(length)
    loop = mixd[:n].copy()
    over = mixd[n:]
    loop[: len(over)] += over  # notes ringing past the end wrap round
    return reverb_circular(loop, rng, wet=0.25, dur=2.5, tau=0.8, damp=3500)


def stereo(x, rng, width=0.012):
    """A mono bed widened: the right channel is a slightly delayed, filtered copy."""
    d = secs(width)
    r = np.roll(lp(x, 6000), d) * 0.9 + hp(x, 6000) * 0.1
    return np.stack([x, r], axis=1)


@recipe("menu.music", 1, loop=8 * BAR)
def _(rng, v):
    length = 8 * BAR
    out = np.zeros(secs(length + 4))
    for b in range(0, 8, 2):
        chord = PROG[(b // 2) % 4]
        place(out, pad([note(m) for m in chord] + [note(chord[0] - 12)], BAR * 2, rng, 1200) * 0.8, b * BAR)
        place(out, bell(note(chord[2] + 24), 2.0, tau=0.8) * 0.12, b * BAR + BEAT * 2)
    loop = out[: secs(length)].copy()
    loop[: secs(4)] += out[secs(length) :]
    # The sea drone is continuous, so it gets its own crossfaded loop (round
    # 5: wrapping its overhang onto its own start doubled it at the seam).
    loop += make_loop(lp(brown(length + 1, rng), 120), length, 0.8) * 0.25
    return reverb_circular(loop, rng, wet=0.4, dur=3.0, tau=1.2, damp=2500)


@recipe("battle.music", 1, loop=8 * BAR)
def _(rng, v):
    return music_bed(rng, 8, drums=1, bass16=False, lead=False, pad_cut=1400)


@recipe("battle.intense", 1, loop=8 * BAR)
def _(rng, v):
    return music_bed(rng, 8, drums=2, bass16=True, lead=True, pad_cut=2200)


@recipe("result.music", 1, loop=4 * BAR)
def _(rng, v):
    length = 4 * BAR
    out = np.zeros(secs(length + 4))
    for b, chord in enumerate([[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]]):
        place(out, pad([note(m) for m in chord], BAR, rng, 1000) * 0.8, b * BAR)
        for i, m in enumerate(chord):
            place(out, bell(note(m + 24), 1.2, tau=0.5) * 0.08, b * BAR + i * BEAT)
    loop = out[: secs(length)].copy()
    loop[: secs(4)] += out[secs(length) :]
    return reverb_circular(loop, rng, wet=0.4, dur=3.0, tau=1.2, damp=2500)


MUSIC = {"menu.music", "battle.music", "battle.intense", "result.music"}


# =============================================================================


def render(name, v):
    fn, _, loop = RECIPES[name]
    rng = np.random.default_rng(seed_of(name, v))
    x = np.asarray(fn(rng, v), dtype=float)
    if loop is None:
        x = fade(x, 0.0015, 0.03)
    else:
        x = x[: secs(loop)] if len(x) >= secs(loop) else fit(x, loop)
    if name in MUSIC:
        x = stereo(x, rng)
    peak = np.max(np.abs(x)) + 1e-12
    return (x / peak * 0.89).astype(np.float32)


def main(names):
    os.makedirs(OUT, exist_ok=True)
    todo = names or list(RECIPES)
    for name in todo:
        _, variants, _ = RECIPES[name]
        for v in range(variants):
            x = render(name, v)
            path = os.path.join(OUT, f"{name}.{v + 1}.wav")
            wavfile.write(path, SR, x)
        print(f"{name}: {variants} variant(s)")


if __name__ == "__main__":
    main(sys.argv[1:])
