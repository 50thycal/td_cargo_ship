# Move the tests' and e2e's log-version pins from one LOG_VERSION to the next.
#   python3 tools/v3/playtest-fixes/pins.py 33 34
import re
import sys

old, new = sys.argv[1], sys.argv[2]
FILES = {
    'tests/v3/enemiesRound8.test.ts': [r'expect\(log\.v\)\.toBe\(OLD(?=\))'],
    'tests/v3/events.test.ts': [r'expect\(log\.v\)\.toBe\(OLD(?=\))'],
    'tests/v3/eventsRound7.test.ts': [r'expect\(log\.v\)\.toBe\(OLD(?=\))'],
    'e2e/v3-convoy.mjs': [r'done\.v === OLD'],
    'e2e/v3-map-lab.mjs': [r'done\.log\.v === OLD', r'version OLD'],
    'e2e/v3.mjs': [r'logged\.v === OLD', r'saved\.v === OLD'],
    'e2e/v3-map-cards.mjs': [r'saved\.v === OLD'],
}
for path, pats in FILES.items():
    s = open(path).read()
    n = 0
    for p in pats:
        rx = re.compile(p.replace('OLD', re.escape(old)))
        s, k = rx.subn(lambda m: m.group(0)[: -len(old)] + new, s)
        n += k
    open(path, 'w').write(s)
    print(f'{path}: {n}')
