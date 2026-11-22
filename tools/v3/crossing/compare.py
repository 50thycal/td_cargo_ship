# Dunmar Crossing against the five chapter 2 maps, the five of chapter 3 and
# the Coves and the Delta (docs/
# design/v3-combo-diversity.md, "Dunmar Crossing"): Jaccard of the top-5 kits,
# rank correlation of the weapons alone (over the weapons both drafts deal),
# each map's #1 kit and best single, and how much the Air Strike leads (as
# tools/v3/rigs/compare.py).
#   python3 tools/v3/crossing/compare.py [crossing dir]
import json
import sys

R = 'tools/v3/combo-sweep/results'
mine = sys.argv[1] if len(sys.argv) > 1 else f'{R}/v58-ch4'
ME = 'crossing'
# Each map from its last sweep: four of chapter 2 at version 37, Saltgate at
# 42; Battery Point at 43, Sowers' Reach at 48, the Rig Field at 49, the
# Black Strait at 50, Dreadnought Pass at 51.
OTHERS = {'island': f'{R}/v37-ch2', 'behemoth': f'{R}/v37-ch2', 'needle': f'{R}/v37-ch2', 'archipelago': f'{R}/v37-ch2', 'saltgate': f'{R}/v42-ch2', 'battery': f'{R}/v43-ch3', 'sowers': f'{R}/v48-ch3', 'rigs': f'{R}/v49-ch3', 'lantern': f'{R}/v50-ch3', 'dreadnought': f'{R}/v51-ch3', 'coves': f'{R}/v53-ch4', 'delta': f'{R}/v54-ch4'}


def load(d):
    div = json.load(open(f'{d}/diversity.json'))
    sing = json.load(open(f'{d}/singles.json'))
    best = {m: [b['key'] for b in v['best'][:5]] for m, v in div['maps'].items()}
    names = {b['key']: b['name'] for v in div['maps'].values() for b in v['best']}
    lost = {m: {b['key']: b['lostAll'] for b in v['best']} for m, v in div['maps'].items()}
    won = {m: {b['key']: b.get('won') for b in v['best']} for m, v in div['maps'].items()}
    singles = {}
    for c in sing['configs']:
        if c['kind'] != 'single':
            continue
        for m, s in c['perMap'].items():
            singles.setdefault(m, {})[c['key']] = s['lostAll']
    return best, names, lost, won, singles


def spearman(a, b):
    def rank(xs):
        idx = sorted(range(len(xs)), key=lambda i: xs[i])
        r = [0.0] * len(xs)
        i = 0
        while i < len(idx):
            j = i
            while j + 1 < len(idx) and xs[idx[j + 1]] == xs[idx[i]]:
                j += 1
            for k in range(i, j + 1):
                r[idx[k]] = (i + j) / 2
            i = j + 1
        return r
    ra, rb = rank(a), rank(b)
    ma, mb = sum(ra) / len(ra), sum(rb) / len(rb)
    num = sum((x - ma) * (y - mb) for x, y in zip(ra, rb))
    da = sum((x - ma) ** 2 for x in ra) ** 0.5
    db = sum((y - mb) ** 2 for y in rb) ** 0.5
    return num / (da * db)


bb, nb, lb, wb, sb = load(mine)
names = dict(nb)
other = {}
for m, d in OTHERS.items():
    b, n, l, w, s = load(d)
    names.update(n)
    other[m] = (b[m], s[m])
bat = sb[ME]
print('Crossing top 5:', ' | '.join(f'{names[k]} {lb[ME][k]:.1f}' for k in bb[ME]))
print('Crossing singles (best 8):', ', '.join(f'{k} {v:.1f}' for k, v in sorted(bat.items(), key=lambda x: x[1])[:8]))
air = sorted(bat, key=bat.get).index('airstrike') + 1 if 'airstrike' in bat else None
print(f'Air Strike alone on the Crossing: {bat.get("airstrike", float("nan")):.1f}, #{air} of {len(bat)}; in {sum("airstrike" in k for k in bb[ME])} of its top-5 kits')
for m, (top, sing) in other.items():
    a, b = set(bb[ME]), set(top)
    shared = a & b
    common = [k for k in bat if k in sing]
    rho = spearman([bat[k] for k in common], [sing[k] for k in common])
    first = min(sing, key=sing.get)
    print(f'{m}: jaccard {len(shared) / len(a | b):.2f} shared {[names[k] for k in shared]}; spearman {rho:.2f} over {len(common)}; #1 kit {names[top[0]]}; best single {first}')
print('Crossing #1 kit in another top 5:', any(bb[ME][0] in top for top, _ in other.values()))
print('Crossing best single:', min(bat, key=bat.get), '; the other maps\':', [min(s, key=s.get) for _, s in other.values()])
print('Crossing top-5 kits in any other top 5:', [names[k] for k in bb[ME] if any(k in top for top, _ in other.values())])
