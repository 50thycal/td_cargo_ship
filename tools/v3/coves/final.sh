#!/bin/bash
# The Coves' final read: 192 seeds, every Armory, normal then tough, into
# <dir>/normal.txt and <dir>/tough.txt.
#   tools/v3/coves/final.sh <dir>
cd "$(dirname "$0")/../../.."
mkdir -p "$1"
tools/v3/coves/readall.sh "$1/normal.txt" --seeds=192
tools/v3/coves/readall.sh "$1/tough.txt" --seeds=192 --tough
