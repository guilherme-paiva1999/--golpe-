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
