#!/bin/bash
# The Coves' tuning read for every Armory (tools/v3/rigs/read.py on the
# Coves), one after another into one file:
#   tools/v3/coves/readall.sh <outfile> [--seeds=192] [--tough] [--no-enc]
out=$1; shift
cd "$(dirname "$0")/../../.."
: > "$out"
for a in player latest plating none; do python3 tools/v3/rigs/read.py --map=coves --armory=$a "$@" >> "$out" 2>&1; done
