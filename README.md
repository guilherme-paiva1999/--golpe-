# É Golpe? · tudo o que foi produzido

Extensão do Chrome que avisa sobre golpes, feita para o Hackathon "Negócios em Transformação" (UniSenac, Senac, Sebrae).
Versão da extensão neste pacote: **3.18.4**.

## O que tem em cada pasta

| Pasta | Conteúdo |
|---|---|
| `1-extensao-codigo/` | Código completo: extensão, páginas de teste (`teste/`), experimentos de aprendizado de máquina e testes de lógica (`ml/`), resumo do consumidor.gov.br (`dados/`). O `README.md` explica cada regra. |
| `2-extensao-pronta-para-instalar/` | ZIP para instalar no Chrome. |
| `3-apresentacao/` | Canvas (PDF, PNG e HTML editável), pitch de 3 minutos (indústria criativa) e o pitch anterior de 4min20, prévias das telas. |
| `4-logotipo/` | Logotipo em SVG e PNG (fundo claro e escuro) e ícone. |
| `5-video/` | Vídeo da extensão funcionando (gravação real, sem dados injetados) e o roteiro que gravou o vídeo, com os sites fictícios. |
| `6-prototipo-interativo/` | Primeira demonstração interativa (página HTML). |
| `7-aplicativo/` | Como publicar e instalar o aplicativo do celular. O código do aplicativo fica junto com a extensão, em `1-extensao-codigo/verificar.html`. |

Os arquivos `.html` do canvas e do protótipo abrem em qualquer navegador. Eles foram feitos para a plataforma de artefatos, então não têm cabeçalho HTML completo; mesmo assim funcionam.

## Para continuar em outro computador

Veja [`CONTINUAR.md`](CONTINUAR.md): como baixar, instalar, rodar os testes e as decisões já tomadas.

## Links

- Código no GitHub: https://github.com/guilherme-paiva1999/--golpe- (histórico completo de commits)
- Aplicativo (GitHub Pages): https://guilherme-paiva1999.github.io/--golpe-/
- Canvas online: https://claude.ai/artifact/TsDp8xN4Fo1cE6e6m6fBu2
- Protótipo interativo online: https://claude.ai/artifact/Pjj9iQcpdWSEbqNVqBePTK

## Instalar a extensão

1. Extraia `2-extensao-pronta-para-instalar/e-golpe-extensao.zip`.
2. Em `chrome://extensions`, ligue o **Modo do desenvolvedor**.
3. **Carregar sem compactação** e escolha a pasta com o `manifest.json`.
4. Na primeira vez abre a tela de boas-vindas: escolha a acessibilidade e, se quiser, a pessoa de confiança.
5. Recarregue as abas abertas. O popup tem botões para testar os avisos.

## Novidades da 3.18.4

- O aviso e o bloqueio cabem **numa tela só**: as duas listas lado a lado e o Reclame Aqui na direita, sem precisar descer.

## Novidades da 3.18.3

- Em sites que **trocam de página sem recarregar** (H&M e outras lojas modernas), o aviso agora aparece **ao clicar no produto**, sem precisar apertar F5.

## Novidades da 3.18.2

- **Confiável com 80% ou mais** (80 já conta).

## Novidades da 3.18.1 (substituída)

- Confiável só com 90% ou mais.

## Novidades da 3.18.0

- Quando o CNPJ da página é de outra empresa que a dona do endereço, a extensão **confere se são do mesmo grupo** (sócios em comum na Receita). Do mesmo grupo: tudo certo. Sem relação: ponto de atenção.
- A nota do Reclame Aqui **entra na conta**, no peso mínimo: 5 escudos +10, 4 +5, 3 neutro, 2 −5, 1 −10.

## Novidades da 3.17.2

- CNPJ de **outra empresa do mesmo grupo** deixou de ser tratado como golpe (caso C&A, que dava 29%): se a dona do endereço no registro.br é real e ativa, vale a idade dela.

## Novidades da 3.17.1

- Loja com 80% ou mais **aparece como confiável** (selo verde e no popup). Antes não aparecia nada.
- Escolha **no início**: mostrar todos os sites (padrão) ou só os suspeitos ou maliciosos.

## Novidades da 3.17.0

- O aviso agora tem **duas listas coloridas**: pontos de atenção (vermelho) e pontos a favor (verde).
- O Reclame Aqui virou **um cartão verde só**: a nota (ou "ainda não analisou") e o "Confira você mesmo".
- Três confirmações abertas: **ranking Tranco**, **Internet Archive** e **crt.sh**.
- Opção no popup para mostrar **também nas lojas confiáveis** (80% ou mais): selo pequeno ou aviso total.

## Novidades da 3.16.4

- **Confiável a partir de 80%** (antes 90%).
- O Reclame Aqui aparece em um só visual verde com a logo: "De acordo com o Reclame Aqui: N de 5 escudos" e "→ Confira você mesmo no Reclame Aqui".
  O botão antigo "Verificar no Reclame Aqui" saiu das telas de aviso e de bloqueio.
- A extensão carregada da pasta se recarrega sozinha quando a versão muda.

## Novidades da 3.16.0

- **Nova conta de confiança da loja:** parte da empresa. CNPJ ativo há 10 anos ou mais parte de 70% (confiança alta; de 5 a 10 anos,
  média; menos de 5, baixa) e as palavras de pressão deixam de pesar; sem CNPJ ativo a confiança cai muito (parte de 20% e só cai); o
  peso da pressão diminui de forma gradual entre 5 e 10 anos.
- **Nota do Reclame Aqui no aviso** (opção desligada): "Segundo o Reclame Aqui: ...", com o link para a pessoa conferir.
- O botão **"Ouvir o aviso"** só aparece para quem marcou a leitura em voz alta no início.

## Novidades da 3.15.0

- O aviso não manda mais a pessoa "conferir o CNPJ e abrir o site oficial": a extensão **confere sozinha** (Receita Federal + dono do
  domínio no registro.br) e mostra o resultado. Marca imitada: botão para abrir o **site oficial**.
- Empresa antiga e confirmada como dona do site pesa mais na confiança. Lojas **internacionais** (.com etc.) ganham aviso próprio.
- Opção (desligada) para abrir o **Reclame Aqui sozinho** quando aparecer um aviso.

## Novidades da 3.14.0

- O botão verde **Verificar no Reclame Aqui** agora abre **direto na nota do site**, sem a pessoa precisar clicar em analisar.
  Funciona no computador e no celular. Para sites novos, o próprio Reclame Aqui pede para a pessoa confirmar que não é um robô.

## Novidades da 3.13.0

- Os dois modelos de inteligência artificial foram **treinados também com o alfabeto cirílico** (letras russas). Golpistas trocam
  letras por letras russas idênticas: `аррӏе.com` parece "apple.com" e "Nеtfliх" parece "Netflix". Agora a extensão lê como a pessoa lê.
- Endereço com letras russas imitando uma marca (Apple, Google, Nubank...) é **bloqueado antes de abrir**. Site russo de verdade
  (`.рф`) não é tratado como golpe.
- Acerto nos dados reais igual ou um pouco melhor que antes; detalhes no README da extensão (seção v3.13).

## Novidades da 3.12.0

- A inteligência artificial agora **lê a página**, e não só o nome do site. Foi o modelo com mais acerto no teste:
  regressão logística com o texto da página e 39 características (preços, Pix, formulários, CNPJ, políticas...).
  Em sites que ele nunca viu: AUC 0,92 (o modelo do nome tinha ~0,8); pega cerca de metade dos golpes com 2% de falsos alertas.
  Ele **soma pontos e nunca bloqueia sozinho**. O texto é lido no próprio computador e não é enviado para lugar nenhum.
- Onde não há página para ler (aplicativo e checagem antes de abrir), continua o modelo do nome do site.

## Novidades da 3.11.0

- A extensão e o aplicativo agora se chamam **Isso é golpe?** (antes: "É Golpe?").

## Novidades da 3.10.0

- Sites que **prometem espionar ou clonar a conta de outra pessoa** (como os de "clonar perfil do Instagram") são bloqueados.
- Vídeo curto da extensão funcionando num site real: `5-video/video-extensao-curto.mp4`.

## Novidades da 3.9.0

- **Dados da empresa na BrasilAPI:** além de ativa ou inativa, a extensão pesa o **tempo de empresa** (nova pesa contra) e confere se as **atividades econômicas** combinam com vender produtos.

## Novidades da 3.8.0

- **Sites de notícias** (CNN Brasil, Estadão, G1, UOL) não são mais confundidos com lojas: só é loja quando há preço e **botão de compra** ou carrinho.

## Novidades da 3.7.0

- **Loja estrangeira** (fora do .br, sem CNPJ, sem R$ nem português) é bloqueada com o aviso "Esta é uma loja estrangeira: está fora dos nossos cuidados, mas o que podemos dizer sobre ela é…", seguido do que a extensão conseguiu ver.

## Novidades da 3.6.0

- A extensão **só age em páginas de dinheiro**: compra, pagamento, Pix, promoção com pressão ou desconto exagerado, e login que diz ser banco ou gov.br. Em sites de leitura e vídeo ela fica quieta.
- **Loja sem CNPJ ativo é bloqueada** (consulta na Receita pela BrasilAPI), e a tela de bloqueio mostra **a mesma porcentagem** que causou o bloqueio.

## Novidades da 3.5.0

- O botão **"Verificar no Reclame Aqui"** abre o Detector de Site Confiável **já na nota do site** (desde a 3.14.0).

## Novidades da 3.4.0: aplicativo e extensão juntos

- **Um código só para os dois.** A tela "Verificar um link" (`verificar.html`) é o aplicativo do celular e também uma tela da extensão.
- **Divisão de trabalho:** o aplicativo confere o **link antes de abrir** (no celular ou no computador). A extensão confere **cada página** que abre no computador: bloqueia antes de carregar, lê a página e avisa na hora de pagar.
- No popup da extensão, novo botão **"Verificar um link antes de abrir"**. Dentro da extensão, a tela usa os mesmos dados: pessoa de confiança, notas do Reclame Aqui e listas de golpes.

## Novidades da 3.3.0

- Para ser **confiável**, o site agora precisa de **90% ou mais** de confiança (antes: mais de 80%).
- **Protótipo do aplicativo para celular** (veja `7-aplicativo/README.md`).
- Planta simples e acessível do projeto (WCAG 2.2 e NBR 9050:2020) em `3-apresentacao/planta-e-golpe.html`.

## Novidades da 3.0.0

- **Tela de boas-vindas** na instalação: a pessoa escolhe a acessibilidade (idoso/dificuldade com a internet, cego/leitor de tela,
  baixa visão, daltônico, dificuldade para ler). Cada perfil liga letras grandes, voz automática e/ou cores para daltonismo.
- **Pessoa de confiança**: para idosos (recomendado) e quem quiser. Na tela de bloqueio aparece "Perguntar para Maria se é golpe",
  que abre o WhatsApp com a mensagem e o link do site. Nada é enviado sozinho.
- **Tela de bloqueio nova**: confiança em %, "O que fazer", botão do **Reclame Aqui grande, verde e com a logo**, e a verificação completa com as
  mesmas coisas que o Reclame Aqui confere (idade do site, empresa responsável pelo CNPJ do registro.br, situação na Receita pela
  BrasilAPI, reclamações no consumidor.gov.br, listas de golpes). Cada prova ruim diminui a confiança.
- **Aprendizado de máquina ligado**: o modelo do nome do site roda na extensão e soma pontos (pega ~10% dos golpes com ~1% de falsos alertas).
- **Só fontes abertas**: o feed do OpenPhish (que não permite uso comercial) foi retirado.
- Confiança sempre em porcentagem, que aparece na hora (sem "carregando"): **só é confiável acima de 80%** (mudou para 90% ou mais na 3.3.0).
- Botão do Reclame Aqui **verde, com a logo** do Reclame Aqui (3.0.1).
- Visual **sóbrio e limpo** na tela de bloqueio e nos avisos: o essencial na tela, detalhes num clique (3.2.0).

## O que a extensão faz (2.8.0)

- **Presunção de golpe:** todo site começa suspeito. Lojas (venda ou pagamento) precisam de **mais de 75 de 100** de confiança.
- **Provas de confiança:** idade do domínio, https, CNPJ válido e **ativo na Receita** (BrasilAPI), contato, políticas, gateway de pagamento, reputação no **consumidor.gov.br**, nota do **Reclame Aqui** registrada pela pessoa.
- **Sinais de golpe:** pressão ("últimas unidades"), desconto exagerado, formulário para outro site, site novo, hospedagem gratuita, **imitação do gov.br**, **marca falsa em página de login (AiTM)**.
- **Listas:** Phishing.Database, URLhaus (a cada 6 horas) e "Evite esses sites" do Procon-SP (o OpenPhish foi retirado na 3.0.0).
- **Avisos:** tela vermelha com PARE, motivos e o que fazer, modo simples, leitura em voz alta, botão para o Reclame Aqui, bloqueio antes de abrir.

## Pedidos que ficaram pendentes (não implementados)

- ~~Limite das lojas de 75 para 80% e confiança em porcentagem~~ (feito na 3.0.0).
- ~~Tela de bloqueio no mesmo padrão do alerta~~ (feito na 3.0.0).
- ~~Botão "Verificar no Reclame Aqui" mais em destaque~~ (feito na 3.0.0).
- **"Cadastre sua marca"**: citado no pitch de 3 minutos como próximo passo, ainda não existe.
- Frase-tese da indústria criativa no início do pitch de 3 minutos (sugerida, não aplicada).

## Números verificados (lidos nas páginas)

- 82% das pessoas com 60 anos ou mais em SP já sofreram tentativas de golpes virtuais (Fundação Seade, SP TIC, jul–set/2025, via Agência SP, 16/03/2026; conferido em 06/11/2026).

- 48% desistiram de comprar on-line por desconfiança (Serasa, via CNN Brasil, 11/02/2025).
- 4 em cada 10 brasileiros já foram vítimas de golpes (Serasa, via Mercado&Consumo, 05/08/2024).
- 82% compram on-line ao menos uma vez por mês (Serasa, Relatório de Identidade e Fraude 2025).
- Quase 1,5 milhão de tentativas de fraude de identidade digital no 1º tri de 2026, +36,6% (Serasa, via Lets Money).
- CERT.br 2026 (jan–out): varejo foi a categoria com mais páginas falsas (1.616 de 5.484). Licença CC BY-NC-ND 4.0: cite a fonte. Conferido em 06/11/2026.
- Feed do OpenPhish: as regras pegaram 1,1% dos golpes recentes; só 2,6% já estavam no Phishing.Database.

## Aprendizado de máquina: resultado honesto

A meta de 94% **não foi atingida** de forma honesta. Só com o nome do site: 81% de acerto e 10% de falsos alertas.
Com o endereço completo, o "93–97%" do conjunto público engana (o modelo aprende "tem caminho = golpe").
Na 3.0.0 o modelo do nome do site foi ligado como sinal extra (soma pontos, não decide sozinho). Detalhes em `1-extensao-codigo/README.md` e `1-extensao-codigo/ml/README.md`.

## Licenças das fontes (confira antes de uso comercial)

No Hackathon (protótipo acadêmico), o uso é em geral não comercial. Se virar produto pago:
o OpenPhish exige o feed pago (por isso foi retirado na 3.0.0); integração automática com o Reclame Aqui só com parceria;
os números do CERT.br podem ser citados, mas não embutidos (licença NC).

## Rede do ambiente de nuvem

Para pesquisar e testar, foram liberados no ambiente "Default" estes sites: serasaexperian, meioemensagem,
letsmoney, baguete, mercadoeconsumo, poder360, monitormercantil, cnnbrasil, sistemas.procon.sp.gov.br,
catalogodefraudes.rnp.br, stats.cert.br, brasilapi.com.br, www.reclameaqui.com.br, consumidor.gov.br e dados.gov.br.
Se não precisar mais deles, remova nas configurações de rede do ambiente.
