#!/bin/sh
# imprime "URL<TAB>codigo<TAB>tipo" com timeout curto, seguindo redirecionamentos
r=$(curl -s -L -m 12 --max-redirs 5 -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124 Safari/537.36" -o /dev/null -w "%{http_code}\t%{content_type}" "$1" 2>/dev/null)
printf "%s\t%s\n" "$1" "$r"
