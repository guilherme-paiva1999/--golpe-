# Treino e medição com páginas reais (em andamento)

Coleta de páginas de golpe e de sites reais, abertas no Chromium com a extensão de verdade, para medir o acerto da extensão
inteira e treinar um modelo com o **conteúdo das páginas** (não só o nome do site).

| Arquivo | O que faz |
|---|---|
| `dados/lista.tsv` | Rótulo e endereço: 581 golpes no ar (Phishing.Database e OpenPhish, ligados ao Brasil), 83 sites do Procon-SP ("evitar") e 900 sites brasileiros reais (ranking Tranco) |
| `montar_lista2.py`, `coletar2.js`, `avaliar_novo.py` | Segunda coleta (v3.19.4): lista de golpes atuais e de lojas reais; coleta de página inicial, produto e carrinho num Chrome sem extensão; comparação do modelo atual com o retreinado |
| `dados/coleta*.jsonl.gz`, `dados/lista2.tsv` | O que a extensão decidiu em cada página e dados da página (texto até 6 mil caracteres, formulários, links, botão de compra) |
| `vivo.sh` | Confere se um endereço está no ar |
| `coletar.js` | Abre cada endereço no Chromium com a extensão (sem as listas de golpes, para medir o golpe "desconhecido") |
| `enriquecer.js` | Idade do domínio (RDAP) e situação, abertura e atividades do CNPJ (BrasilAPI), devagar, respeitando os limites |
| `refazer.js` | Refaz a decisão da extensão com o código dela e os dados corretos de idade e CNPJ |
| `caracteristicas.js` | Características de cada página para o modelo |

Os textos são de páginas públicas e dos feeds públicos de golpes. Não abra os endereços de golpe fora de um ambiente isolado.

## Rede neural x aprendizado de máquina clássico (07/11/2026)

Mesmas páginas (338 golpes no ar e 896 sites reais brasileiros; 243 golpes que já tinham saído do ar foram descartados),
teste por domínio (o modelo nunca vê o mesmo site no treino e no teste). `comparar.py`, `curva.py` e `sem_caminho.py`.

**Sem o "caminho" do endereço** (a coleta tem golpes com caminho e sites reais na página inicial, o que inflaria tudo):

| Modelo | Acerto | Golpes pegos com 2% de falso alerta | AUC |
|---|---|---|---|
| Regressão logística, texto da página + características (clássico) | 85,2% | **50,9%** | **0,916** |
| Rede neural, características | 82,8% | 44,7% | 0,870 |
| Regressão logística, características (clássico) | 79,7% | 43,5% | 0,869 |
| Floresta de árvores, características (clássico) | 83,7% | 40,2% | 0,877 |
| Boosting de árvores, características (clássico) | 82,5% | 36,7% | 0,866 |

Com o "caminho" (otimista), a floresta chegou a AUC 0,924 e a rede neural com texto + características a 0,930: empate.
Curva de aprendizado (com caminho): a floresta já está no máximo com 25% dos dados (AUC ~0,92); a rede neural sobe
de 0,815 para 0,895 e quase para entre 75% e 100%.

**Conclusão:** com estes dados, a rede neural empata ou perde para o clássico. O melhor e mais simples foi a regressão
logística com o texto da página + as características. Mesmo assim, ainda há viés (sites reais são páginas iniciais grandes;
golpes são páginas pequenas), então os números de verdade devem ser menores. O que mais falta são dados: páginas de lojas
reais (produto e pagamento, não só a inicial), mais golpes atuais, e a idade e o CNPJ de cada site no treino.

## Alfabeto cirílico (v3.13.0)

O mesmo treino, agora lendo letras russas disfarçadas (`1-extensao-codigo/alfabetos.js` e `ml/alfabetos.py`):
- O texto que o modelo lê passa pelo "esqueleto" latino ("Nеtfliх" vira "Netflix"); entram `misturaAlfabetos` e `cirilico` (41 características).
- Na coleta há 1 golpe com palavras disfarçadas e páginas reais com menus em russo. Por isso, **só no treino**, cada golpe ganha uma
  cópia com 1 a 4 palavras disfarçadas (`final.py`, função `aumentar`). O acerto é sempre medido nas páginas reais.
- Resultado (teste por domínio): AUC 0,916; com 2% de falsos alertas pega 55,2%; com 1%, 38,1%.
- `amostras_reais.py` gera as páginas de exemplo do teste ponta a ponta (inclui a página real do "Nеtfliх").
- Como rodar: `gzip -dc dados/coleta.jsonl.gz > coleta.jsonl`, `node caracteristicas.js coleta.jsonl nada.json feats.jsonl` e
  `python final.py modelo-pagina.json amostras-pagina.json` (no Windows, com `PYTHONUTF8=1`).

## Modelo final na extensão (v3.12.0)

`final.py` treina e exporta `1-extensao-codigo/ml/modelo-pagina.json`. Antes, a limpeza passou a tirar também os
**golpes que redirecionaram para outro site** (68 casos: página de venda de domínio da GoDaddy, Instagram, o site verdadeiro,
página de erro), que ensinavam errado. Ficaram 1.195 páginas (299 golpes, 896 reais).

- Regressão logística (`class_weight='balanced'`, C=4) com TF-IDF de pedaços de 3 a 5 letras do título + texto (até 4.000
  caracteres) e 39 características padronizadas. Fora: o caminho do endereço (viés) e idade/CNPJ (não consultados no treino).
- Vocabulário: 5.000, 10.000, 20.000 e 40.000 deram o mesmo acerto (AUC 0,915 a 0,922); ficou o de 5.000 (126 KB).
- Teste por domínio: **AUC 0,92**; com limiar 0,835 (2% de falsos alertas) pega 52,5% dos golpes; com 0,945 (1%), 36%.
- Paridade: `node ml/testar_modelo_pagina.js` confere que o JavaScript dá a mesma probabilidade que o Python.

## Segunda coleta e retreino (v3.19.4)

Resultado e limites estão em `1-extensao-codigo/README.md` (seção v3.19.4). Resumo: o modelo antigo tinha AUC 0,81 em páginas novas (0,92 nos dados que
ele conhecia); o retreinado (1.811 páginas) tem 0,93. Aprendizado importante: **página de erro do Chrome entrou como "real"** e arruinou a validação até ser descartada;
antes de treinar com dados novos, confira sempre se há páginas de erro (`final` começando com `chrome-error`).
