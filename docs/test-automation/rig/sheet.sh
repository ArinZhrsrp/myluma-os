#!/bin/bash
# usage: sheet.sh WIDTH HEIGHT out.png "?mode=x#page1" "#page2" ...   → one image with the pages side by side
W=$1; H=$2; OUT=$3; shift 3; i=0; files=()
for q in "$@"; do f="s_$i.png"; sed -i '' 's/--force-device-scale-factor=2/--force-device-scale-factor=1/' shot.sh; ./shot.sh $W $H "$q" $f & files+=($f); i=$((i+1)); done; wait
python3 - "$OUT" "${files[@]}" <<'P'
import sys
from PIL import Image
out=sys.argv[1]; ims=[Image.open(f).crop((0,0,0,0)) if False else Image.open(f) for f in sys.argv[2:]]
w=sum(i.width for i in ims)+10*(len(ims)-1); h=max(i.height for i in ims)
s=Image.new('RGB',(w,h),(40,40,40)); x=0
for i in ims: s.paste(i,(x,0)); x+=i.width+10
s.save(out)
P
