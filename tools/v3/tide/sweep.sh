#!/bin/bash
# The Tide's combo sweep and diversity check (the chapter 2 way, as the
# Coves': singles on 12 seeds, every pair on 6, its 6 best pairs with every
# third weapon on 6, its 10 best kits on 16), into
# tools/v3/combo-sweep/results/v59-ch4.
#   tools/v3/tide/sweep.sh
cd "$(dirname "$0")/../../.."
OUT=tools/v3/combo-sweep/results/v59-ch4
mkdir -p $OUT
npm run -s v3:combo-sweep -- --stage=singles --maps=tide --out=$OUT
npm run -s v3:combo-sweep -- --stage=pairs --maps=tide --out=$OUT
npx vite-node tools/v3/combo-sweep/diversity.ts -- --dirs=$OUT --maps=tide --top=6 --seeds=6 --confirm=10 --confirm-seeds=16 --json=$OUT/diversity.json
