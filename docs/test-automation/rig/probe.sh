#!/bin/bash
# usage: probe.sh WIDTH "extra=query" "page" 'JS expression returning a string'
W=$1; EXTRA=$2; PAGE=$3; EXPR=$4
Q=$(python3 - "$EXTRA" "$PAGE" "$EXPR" <<'P'
import sys,urllib.parse
extra,page,expr=sys.argv[1:4]
js='parent.document.body.insertAdjacentHTML("beforeend","<pre id=PROBE>"+String((function(){try{return '+expr+'}catch(e){return "ERR "+e.message}})())+"</pre>")'
print(urllib.parse.quote('?'+(extra+'&' if extra else '')+'js='+urllib.parse.quote(js)+'#'+page))
P
)
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --window-size=$((W+20)),700 --virtual-time-budget=12000 --dump-dom "http://localhost:8765/__frame?w=$W&h=680&q=$Q" 2>/dev/null | python3 -c "
import sys,re,html
d=sys.stdin.read(); m=re.search(r'<pre id=\"PROBE\">(.*?)</pre>',d,re.S); print(html.unescape(m.group(1)) if m else 'NO PROBE')"
