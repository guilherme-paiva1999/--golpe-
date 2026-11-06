# Como o vídeo "Isso é golpe? funcionando" foi gravado

Gravação real do aplicativo e da extensão (versão 3.9.0), em ritmo calmo e com legendas. Nada foi injetado nas decisões:
o aplicativo e a extensão decidem sozinhos; as legendas só explicam o que aparece.

- `sites/`: páginas fictícias (`.example`, não existem na internet): um jornal, uma loja sem CNPJ e uma loja estrangeira.
  O link de banco falso (`nubank-atualizar-cadastro.xyz`) também não existe.
- `gravar.js`: abre o Chromium com a extensão, grava a tela (1280×720) e põe as legendas.

```
node gravar.js PASTA_DE_SAIDA
ffmpeg -i PASTA_DE_SAIDA/page@....webm -c:v libx264 -crf 22 -pix_fmt yuv420p -r 30 -movflags +faststart video.mp4
```
(o nome do arquivo .webm certo fica em `PASTA_DE_SAIDA/marcas.json`)
