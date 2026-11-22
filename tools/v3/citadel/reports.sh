#!/bin/bash
# The Citadel' record reports (24 seeds) for every Armory, written to
# tools/v3/map-report/results/citadel[-armory]*; with a suffix (before), the
# files are renamed citadel-<suffix>[-armory]* (the map card as it was).
#   tools/v3/citadel/reports.sh [suffix] [--kits=plan]
cd "$(dirname "$0")/../../.."
suffix=$1; shift
R=tools/v3/map-report/results
for a in player latest plating none; do
  if [ "$a" = none ]; then arm=""; tag=""; else arm="--armory=$a"; tag="-$a"; fi
  npx vite-node tools/v3/map-report/report.ts -- --map=citadel --seeds=24 $arm "$@" > /dev/null 2>&1
  if [ -n "$suffix" ]; then
    for ext in .md .json -heat.html; do
      [ -f "$R/citadel$tag$ext" ] && mv "$R/citadel$tag$ext" "$R/citadel-$suffix$tag$ext"
    done
  fi
done
