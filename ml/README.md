# Acerto real da extensão (medido)

Golpes que **não** estão nas listas, testados com as regras reais de `background.js`
(`node medir_extensao.js`). 11.963 golpes do Phishing.Database, sem contar sites normais:

| O que | Resultado |
|---|---|
| Golpes que a extensão avisa (atenção ou perigo) | **3,7%** (444 de 11.963) |
| Golpes bloqueados (nível perigo) | 0,02% (2) |
| Golpes .br avisados | 1,8% (4 de 225) |
| Golpes que já estão nas listas | ~100% (a lista contém o endereço) |
| Falsos alertas em sites normais | 0,1% (17 de 12.034) |

As regras quase não pegam golpe desconhecido: muitos golpes da lista são sites comuns invadidos,
iguais a um site normal pelo nome. A proteção hoje vem das listas, que só conhecem golpes já denunciados.

# Experimentos de aprendizado de máquina (não estão ligados à extensão)

Meta pedida: acerto de pelo menos 94%. **Não foi atingida de forma honesta.** Abaixo, o que foi medido.

## 1) Só o nome do site (`treinar.py`)
Golpes: Phishing.Database. Legítimos: ranking Cisco Umbrella. Teste com 24 mil sites nunca vistos,
separados por domínio.

| Acerto | Golpes pegos | Normais marcados como golpe |
|---|---|---|
| 81% | 72% | 10% |

Muitos golpes da lista são sites comuns invadidos (`deckegroup.com`), iguais a um site normal pelo nome.

## 2) Endereço completo, conjunto de Vrbančič (`treinar_url.py`, `avaliar_generalizacao.py`)
88.647 endereços (30.497 de golpe, sem duplicatas).

| Teste | Acerto | Golpes pegos | Normais marcados como golpe |
|---|---|---|---|
| Só estrutura do endereço, teste igual ao treino | 93,5% | 89% | 4% |
| Com consultas de rede (idade do domínio etc.), teste igual ao treino | 96,7% | 95% | 2,6% |
| Estrutura, só endereços **com** caminho | 88% | 92% | 21% |
| Estrutura, **sem** caminho | 98% | **2%** | 0% |
| Estrutura, aplicado a outra fonte (24 mil nomes de sites) | **54,5%** | 9% | 0,7% |
| Com consultas de rede, só endereços com caminho | 95% | 97% | 10% |

**Por que o 93–97% engana:** 80% dos sites normais do conjunto não têm caminho (só a página inicial) e
97,6% dos golpes têm. O modelo aprende "tem caminho = golpe". Sem caminho ele pega 2% dos golpes; em
outra fonte de dados o acerto cai para o nível de cara ou coroa. Ligado à extensão, ele marcaria como
golpe qualquer notícia ou produto com endereço comprido.

## Conclusão
- Nenhum modelo aqui está pronto para decidir sozinho. Nada foi ligado à extensão.
- A idade do domínio e outras consultas de rede ajudam de verdade (2,6% de falsos alertas contra 4%).
- O que falta é um conjunto de **páginas** (senha, formulário para outro domínio, links, texto) de
  golpes e de sites normais, de preferência do Brasil, coletado de forma equilibrada. Não foi possível
  baixar um aqui.
- Em uso real, golpes são raros. Mesmo com 2,6% de falsos alertas, a maioria dos alertas seria falsa.
  Por isso as listas e as regras seguem como a decisão principal.
