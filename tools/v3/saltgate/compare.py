# Saltgate Canal against the other four chapter 2 maps (docs/design/
# v3-combo-diversity.md): Jaccard of the top-5 kits, rank correlation of
# the weapons alone, each map's #1 kit and best single.
#   python3 tools/v3/saltgate/compare.py [saltgate dir] [others dir]
import json
import sys

R = 'tools/v3/combo-sweep/results'
mine = sys.argv[1] if len(sys.argv) > 1 else f'{R}/v42-ch2'
others = sys.argv[2] if len(sys.argv) > 2 else f'{R}/v37-ch2'
OTHER = ['island', 'behemoth', 'needle', 'archipelago']


def load(d):
    div = json.load(open(f'{d}/diversity.json'))
    sing = json.load(open(f'{d}/singles.json'))
    best = {m: [b['key'] for b in v['best'][:5]] for m, v in div['maps'].items()}
    names = {b['key']: b['name'] for v in div['maps'].values() for b in v['best']}
    lost = {m: {b['key']: b['lostAll'] for b in v['best']} for m, v in div['maps'].items()}
    singles = {}
    for c in sing['configs']:
        if c['kind'] != 'single':
            continue
        for m, s in c['perMap'].items():
            singles.setdefault(m, {})[c['key']] = s['lostAll']
    return best, names, lost, singles


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


bs, ns, ls, ss = load(mine)
bo, no, lo, so = load(others)
names = {**no, **ns}
print('Saltgate top 5:', ' | '.join(f'{names[k]} {ls["saltgate"][k]:.1f}' for k in bs['saltgate']))
sg = ss['saltgate']
print('Saltgate singles:', ', '.join(f'{k} {v:.1f}' for k, v in sorted(sg.items(), key=lambda x: x[1])[:6]))
for m in OTHER:
    a, b = set(bs['saltgate']), set(bo[m])
    shared = a & b
    common = [k for k in sg if k in so[m]]
    rho = spearman([sg[k] for k in common], [so[m][k] for k in common])
    first = min(so[m], key=so[m].get)
    print(f'{m}: jaccard {len(shared) / len(a | b):.2f} shared {[names[k] for k in shared]}; spearman {rho:.2f}; #1 kit {names[bo[m][0]]}; best single {first}')
print('Saltgate #1 kit in another top 5:', any(bs['saltgate'][0] in bo[m] for m in OTHER))
