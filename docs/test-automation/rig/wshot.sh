#!/bin/bash
# usage: wshot.sh WIDTH HEIGHT TAB out.png [extra js]   (Work add-on switched on in the stub; opens Work, then a tab)
W=$1; H=$2; TAB=$3; O=$4; X=$5
JS="LumaPlan.plan='zenith';LumaPlan.addons=['work'];LumaPlan.addonInfo={};LUMA_USER.id='u1';goTo('work');setTimeout(function(){var b=document.querySelector('[data-wktab=$TAB]');if(b)b.click();$X},1800)"
./shot.sh $W $H "?mode=work&js=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$JS")#dashboard" $O
