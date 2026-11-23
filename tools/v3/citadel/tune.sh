#!/bin/bash
# The Citadel's tuning loop read: the usual Armory, tough then normal, on
# <seeds> seeds (default 96), into <dir>/tough.txt and <dir>/normal.txt.
#   tools/v3/citadel/tune.sh <dir> [seeds] [armory]
cd "$(dirname "$0")/../../.."
mkdir -p "$1"
n=${2:-96}
a=${3:-player}
python3 tools/v3/rigs/read.py --map=citadel --armory=$a --seeds=$n --tough > "$1/tough.txt" 2>&1
python3 tools/v3/rigs/read.py --map=citadel --armory=$a --seeds=$n > "$1/normal.txt" 2>&1
cat "$1/tough.txt" "$1/normal.txt"
