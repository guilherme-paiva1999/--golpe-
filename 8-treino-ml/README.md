# Treino e medição com páginas reais (em andamento)

Coleta de páginas de golpe e de sites reais, abertas no Chromium com a extensão de verdade, para medir o acerto da extensão
inteira e treinar um modelo com o **conteúdo das páginas** (não só o nome do site).

| Arquivo | O que faz |
|---|---|
| `dados/lista.tsv` | Rótulo e endereço: 581 golpes no ar (Phishing.Database e OpenPhish, ligados ao Brasil), 83 sites do Procon-SP ("evitar") e 900 sites brasileiros reais (ranking Tranco) |
| `dados/coleta*.jsonl.gz` | O que a extensão decidiu em cada página e dados da página (texto até 6 mil caracteres, formulários, links, botão de compra) |
| `vivo.sh` | Confere se um endereço está no ar |
| `coletar.js` | Abre cada endereço no Chromium com a extensão (sem as listas de golpes, para medir o golpe "desconhecido") |
| `enriquecer.js` | Idade do domínio (RDAP) e situação, abertura e atividades do CNPJ (BrasilAPI), devagar, respeitando os limites |
| `refazer.js` | Refaz a decisão da extensão com o código dela e os dados corretos de idade e CNPJ |
| `caracteristicas.js` | Características de cada página para o modelo |

Os textos são de páginas públicas e dos feeds públicos de golpes. Não abra os endereços de golpe fora de um ambiente isolado.
