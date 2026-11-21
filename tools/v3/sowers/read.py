# A tuning read on four processes at once (tools/v3/sowers/seeds.ts), pooled:
# won %, ships lost in waves 1-5 and 1-10, and each wave's and boss round's
# losses over the runs that reached it (normal) or every run (--tough).
#   python3 tools/v3/sowers/read.py [--map=sowers] [--armory=player] [--seeds=192]
#       [--from=900] [--tough] [--no-enc] [--pilot=sharp] [--procs=4]
import json
import subprocess
import sys

args = sys.argv[1:]
opt = lambda k, d: next((a.split('=', 1)[1] for a in args if a.startswith(f'--{k}=')), d)
n = int(opt('seeds', '192'))
procs = int(opt('procs', '4'))
start = int(opt('from', '900'))
flags = [a for a in args if a in ('--tough', '--no-enc') or a.startswith('--pilot=')]
base = ['npx', 'vite-node', 'tools/v3/sowers/seeds.ts', '--', f'--map={opt("map", "sowers")}', f'--armory={opt("armory", "player")}', *flags]
chunk = -(-n // procs)
ps = []
for i in range(procs):
    f = start + i * chunk
    c = min(chunk, start + n - f)
    if c > 0:
        ps.append(subprocess.Popen(base + [f'--from={f}', f'--seeds={c}'], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True))
runs = []
for p in ps:
    out, _ = p.communicate()
    runs += [json.loads(l) for l in out.splitlines() if l.startswith('{')]
W = 13
per = []
for w in range(W):
    r = [x for x in runs if (w + 1) in x['reached']]
    per.append((sum(x['lost'][w] if w < len(x['lost']) else 0 for x in r) / len(r) if r else float('nan'), len(r)))
won = sum(x['won'] for x in runs) / len(runs)
s5 = sum(sum(x['lost'][:5]) for x in runs) / len(runs)
s10 = sum(sum(x['lost'][:10]) for x in runs) / len(runs)
print(f"{opt('map', 'sowers')} {opt('armory', 'player')}{' tough' if '--tough' in flags else ''}{' no-enc' if '--no-enc' in flags else ''}{''.join(' ' + f[2:] for f in flags if f.startswith('--pilot='))} n={len(runs)}: won {100 * won:.0f}%, lost 1-5 {s5:.2f}, 1-10 {s10:.2f}")
print('  ' + ' '.join(f"{w + 1 if w < 10 else 'B' + str(w - 9)}:{v:.2f}" for w, (v, _) in enumerate(per)))
print('  reached ' + ' '.join(str(c) for _, c in per))
