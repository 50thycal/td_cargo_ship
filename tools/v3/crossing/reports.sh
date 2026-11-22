#!/bin/bash
# Dunmar Crossing's record reports (24 seeds) for every Armory, written to
# tools/v3/map-report/results/crossing[-armory]*; with a suffix (before), the
# files are renamed crossing-<suffix>[-armory]* (the map card as it was).
#   tools/v3/crossing/reports.sh [suffix] [--kits=plan]
cd "$(dirname "$0")/../../.."
suffix=$1; shift
R=tools/v3/map-report/results
for a in player latest plating none; do
  if [ "$a" = none ]; then arm=""; tag=""; else arm="--armory=$a"; tag="-$a"; fi
  npx vite-node tools/v3/map-report/report.ts -- --map=crossing --seeds=24 $arm "$@" > /dev/null 2>&1
  if [ -n "$suffix" ]; then
    for ext in .md .json -heat.html; do
      [ -f "$R/crossing$tag$ext" ] && mv "$R/crossing$tag$ext" "$R/crossing-$suffix$tag$ext"
    done
  fi
done
