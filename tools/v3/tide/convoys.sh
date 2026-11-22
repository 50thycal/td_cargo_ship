#!/bin/bash
# The Tide's convoy as a lever (rule m-shape-convoy): the tuning read
# (usual Armory) with MAP_CONVOY.tide set to each flow:formation in turn,
# restored afterwards.
#   tools/v3/tide/convoys.sh <outfile> "1:pairs 1:box 2:pairs" [--seeds=48] [--tough]
out=$1; shift
sets=$1; shift
cd "$(dirname "$0")/../../.."
f=src/v3/data/convoy.ts
cp $f /tmp/tide-convoy.bak.$$
: > "$out"
for s in $sets; do
  flow=${s%%:*}; form=${s##*:}
  sed -i -E "s/^  tide: \{ flow: [0-9], formation: '[a-z]+'/  tide: { flow: $flow, formation: '$form'/" $f
  echo "== $s" >> "$out"
  python3 tools/v3/rigs/read.py --map=tide --armory=player "$@" >> "$out" 2>&1
done
cp /tmp/tide-convoy.bak.$$ $f
rm /tmp/tide-convoy.bak.$$
