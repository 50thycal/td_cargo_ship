#!/bin/bash
# The Tide's final read: 192 seeds, every Armory, normal then tough, into
# <dir>/normal.txt and <dir>/tough.txt.
#   tools/v3/tide/final.sh <dir>
cd "$(dirname "$0")/../../.."
mkdir -p "$1"
tools/v3/tide/readall.sh "$1/normal.txt" --seeds=192
tools/v3/tide/readall.sh "$1/tough.txt" --seeds=192 --tough
