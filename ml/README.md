# Experimento de aprendizado de máquina (não está ligado à extensão)

Treina um classificador **só com o nome do site** (host).

- Golpes: Phishing.Database (até 15 por domínio). Legítimos: sites do ranking Cisco Umbrella.
- Separação treino/teste por domínio. O risco por final de domínio (.xyz etc.) usa só o treino.
- Rodar: `python3 treinar.py PASTA_COM_phishing.txt_E_top-1m.csv` (precisa de scikit-learn).

## Resultado (teste com 24 mil sites que o modelo nunca viu)
| Medida | Valor |
|---|---|
| Acurácia | 81% |
| Golpes pegos (recall) | 72% |
| Sites normais marcados como golpe | 10% |
| Com limiar para 1% de falsos alertas | pega só 56% dos golpes |
| Precisão se só 1% dos sites forem golpe | ~7% |

**Conclusão:** só o nome do site não chega a 94%. Muitos golpes da lista são sites comuns invadidos
(`deckegroup.com`, `coralon.com`), indistinguíveis de um site normal pelo nome. Por isso o modelo
não foi ligado à extensão: com tantos falsos alertas, ele faria mais mal que bem.

Para chegar perto de 94% é preciso olhar a **página** (campo de senha, formulário que envia para outro
domínio, links, texto), e treinar com dados rotulados dessas páginas.
