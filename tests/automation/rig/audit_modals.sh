#!/bin/bash
# usage: audit.sh WIDTH "&mode=study&pages=study,calendar"
W=$1; H=800; Q=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "?audit=modals$2")
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --window-size=$((W+20)),$((H+20)) --virtual-time-budget=90000 --dump-dom "http://localhost:8765/__frame?w=$W&h=$H&q=$Q" 2>/dev/null | python3 -c "
import sys,html,re
d=sys.stdin.read(); m=re.search(r'AUDIT-START(.*?)AUDIT-END',d,re.S)
print(html.unescape(m.group(1)).strip() if m else 'NO RESULT')"
