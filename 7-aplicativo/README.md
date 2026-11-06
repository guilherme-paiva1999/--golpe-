# É Golpe? · aplicativo (protótipo)

Aplicativo para celular que confere um link **antes de abrir**. A pessoa cola o link ou, no Android,
toca em **Compartilhar** no WhatsApp e escolhe **É Golpe?**. Aparece o resultado (Confiável, Atenção ou Perigo),
a confiança em %, os motivos e os botões de ajuda (pessoa de confiança, Reclame Aqui e voz).

É um site instalável (PWA): funciona no Android e no iPhone, sem passar pelas lojas de aplicativos.

## Como testar no computador
Na pasta `7-aplicativo/`:
```
python3 -m http.server 8080
```
Abra `http://localhost:8080/`. Para ver como celular, use o modo de celular do navegador (F12, ícone do celular).

## Como testar no celular
O celular precisa abrir o aplicativo por **https** (sem https não instala e o "Compartilhar" não aparece).
Para isso, publique a pasta `7-aplicativo/` num serviço de sites grátis (Netlify, Cloudflare Pages ou GitHub Pages).
Depois, no Android: abra o endereço no Chrome, toque nos três pontinhos e em **Instalar aplicativo**.
No iPhone: abra no Safari, toque em Compartilhar e em **Adicionar à Tela de Início**.

## Mesmo cérebro da extensão
A pasta `nucleo/` é uma **cópia** dos arquivos da extensão: regras, listas, pesos, modelo de aprendizado de máquina
e dados do consumidor.gov.br. O `ponte.js` imita as funções do Chrome que o núcleo usa, com o armazenamento do aparelho.
Assim o aplicativo dá as mesmas respostas da extensão.

**Mudou algo em `1-extensao-codigo/`? Rode `./copiar-nucleo.sh`** para levar a mudança ao aplicativo.

## Diferenças da extensão
- O aplicativo **não vê a página**, só o link. Sinais como "últimas unidades", desconto exagerado e formulário
  para outro site ficam de fora.
- Por isso a conta é: **link desconhecido começa em 50%**, perde os pontos de risco do endereço (imitação de marca ou do gov.br,
  terminação suspeita, aprendizado de máquina, sem cadeado) e depois ganha ou perde com as provas, com os mesmos pesos da tela de bloqueio
  (idade do site, empresa na Receita, consumidor.gov.br, nota do Reclame Aqui). Confiável só com **90% ou mais**.
  O ponto de partida de 50% foi escolhido para o protótipo, não medido.
- Não bloqueia sozinho: o aplicativo só é usado quando a pessoa pergunta.

## Arquivos
| Arquivo | O que faz |
|---|---|
| `index.html`, `app.css`, `app.js` | Telas: início, resultado e ajustes |
| `ponte.js` | Imita `chrome.storage` e `chrome.runtime` para o núcleo da extensão rodar no celular |
| `nucleo/` | Cópia dos arquivos da extensão (não edite aqui) |
| `manifest.webmanifest` | Nome, ícones e o "Compartilhar" do Android |
| `sw.js` | Guarda o aplicativo no aparelho para abrir sem internet |
| `copiar-nucleo.sh` | Copia o núcleo da extensão para cá |

## Pontos em aberto
- **Consultas pela internet:** dentro de um site, o navegador só deixa consultar serviços que permitem isso (CORS).
  A BrasilAPI e a lista do Phishing.Database permitem (conferido). A idade do site (RDAP) e as listas do URLhaus e do Procon-SP
  não puderam ser conferidas aqui, porque a rede deste ambiente bloqueia esses endereços. Se não funcionarem no celular,
  o aplicativo segue sem elas, e a solução é um servidor pequeno que faça essas consultas.
- A primeira abertura baixa a lista do Phishing.Database (cerca de 11 MB). Depois fica guardada e atualiza uma vez por dia.
- No iPhone não existe "Compartilhar com" para sites instalados: a pessoa copia o link e toca em **Colar**.
