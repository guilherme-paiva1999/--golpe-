#!/bin/sh
# Copia da extensão para o aplicativo os arquivos que os dois usam (regras, modelo, dados).
# Rode de novo sempre que mudar algum deles em 1-extensao-codigo/.
set -e
cd "$(dirname "$0")"
EXT=../1-extensao-codigo
mkdir -p nucleo/ml nucleo/dados nucleo/icons
cp "$EXT/background.js" "$EXT/modelo.js" "$EXT/pessoa.js" nucleo/
cp "$EXT/ml/modelo.json" nucleo/ml/
cp "$EXT/dados/consumidor.json" nucleo/dados/
cp "$EXT/icons/reclameaqui.png" nucleo/icons/
echo "núcleo copiado da extensão"
