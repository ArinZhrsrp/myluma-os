#!/bin/bash
# usage: shot.sh WIDTH HEIGHT "?mode=study#reminders" out.png   (the app is shown inside an iframe of exactly WIDTH x HEIGHT, so media queries see a real phone width)
W=$1; H=$2; Q=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$3"); O=$4
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars --window-size=$((W+20)),$((H+20)) --force-device-scale-factor=1 --virtual-time-budget=12000 --screenshot="$O" "http://localhost:8765/__frame?w=$W&h=$H&q=$Q" >/dev/null 2>&1
