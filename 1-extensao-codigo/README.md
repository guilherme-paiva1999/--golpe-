# É Golpe? v3

## Instalar
1. Extraia o ZIP.
2. Abra `chrome://extensions` e ligue o **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e escolha a pasta extraída (a que tem o `manifest.json`).
4. Fixe o ícone na barra (peça de quebra-cabeça, depois o alfinete).
5. Aguarde 1 a 2 minutos: a extensão baixa as listas de golpes. O horário aparece no popup.

Depois de instalar, **recarregue as abas que já estavam abertas**. Páginas abertas antes não recebem a extensão.

## Testes rápidos (nada disso é perigoso)

### A) Botões de teste no popup
Em qualquer site comum (http ou https), clique no ícone e use "Testar os avisos nesta página":
- **Aviso de atenção** (amarelo, triângulo)
- **Aviso de perigo** (vermelho, octógono)
- **Aviso de pagamento**
- **Tela de bloqueio**

Ligue o **Modo simples** no popup e repita para ver as letras grandes. Clique em **Ouvir o aviso** para testar a voz. `Esc` fecha o aviso.

### B) Bloqueio real
Digite na barra de endereço: `http://nubank-atualizar-cadastro.xyz/login`
O site não existe, e a extensão bloqueia **antes** de a página abrir. Deve aparecer a tela vermelha de bloqueio. Para continuar é preciso clicar duas vezes em "Continuar mesmo assim".

### C) Páginas de teste (posts, pagamento, senha sem cadeado)
Na pasta do projeto, rode:
```
python3 -m http.server 8000 --directory teste
```
e abra `http://localhost:8000/`:
- **feed.html**: o post com frases de golpe fica desfocado, com aviso e botão "Ver mesmo assim".
- **pagamento.html**: aparece o aviso "Pare e pense" na parte de baixo.
- **senha-http.html**: aviso de atenção por pedir senha sem cadeado.

## Arquivos
- `manifest.json`: permissões mínimas; o acesso a todos os sites só é pedido se o usuário ligar a análise de imagens.
- `background.js`: listas no IndexedDB, nota de risco por pontos, idade do domínio (RDAP), bloqueio.
- `content.js`: avisos em Shadow DOM, aviso de pagamento, proteção de posts e imagens, modo de teste.
- `bloqueado.html/js`: página de bloqueio.
- `popup.html/js`: situação do site, configurações e botões de teste.
- `teste/`: páginas de teste.

## Fontes de dados
Só fontes abertas, que permitem uso comercial: Phishing.Database (licença MIT), URLhaus (abuse.ch, CC0),
lista do Procon-SP (dado público), RDAP (registro.br e rdap.org), BrasilAPI (código aberto) e consumidor.gov.br
(dados abertos). O feed público do OpenPhish foi **retirado na v3.0** porque os termos dele não permitem uso comercial.

## Presunção de golpe (v2.3)
Todo site desconhecido começa suspeito e só deixa de ser quando prova o contrário. Sinais lidos na página
(só verdadeiro/falso sai da página): pede pagamento, mensagem de pressão, desconto exagerado, formulário
que envia a outro site, pede senha, sem CNPJ/contato. A **idade do domínio** (consultada só quando a
página mostra dinheiro, senha ou pressão) pesa muito: menos de 30 dias soma 35 pontos; mais de 1 ano
tira 20 e mais de 3 anos tira 30. Rigor "alto" (padrão) avisa a partir de 25 pontos e bloqueia a partir de 60.
Selo no ícone: ✓ provado, ? não verificado, ! atenção, X perigo.
Os botões "É golpe" e "É seguro" guardam os seus rótulos neste computador ("Baixar meus dados") para treinar um modelo depois.
Os pesos foram definidos à mão, **não treinados**; `ml/testar_pontuacao.js` testa só a lógica.

## Lojas precisam provar confiança (v2.4; limite de 90% desde a v3.3)
Se a página vende ou pede pagamento, ela começa com 0 de confiança e precisa passar de **75**.
Provas: idade do domínio (3 anos +35, 1 ano +25, 6 meses +10), https +10, CNPJ com dígitos válidos +10,
contato +10 (+5 se o e-mail é do próprio site), políticas de trocas/privacidade/entrega +15, gateway de
pagamento conhecido +10. Sinais ruins tiram: site de menos de 30 dias −40, pressão −15, desconto exagerado −15,
formulário para outro site −20, hospedagem gratuita −15. Menos de 30 de confiança bloqueia; de 30 a 75 avisa.
**Hospedagem gratuita** (`vercel.app`, `blogspot.com`...) não prova idade: a idade seria a do serviço.
Os pesos foram definidos à mão. `ml/testar_confianca.js` testa só a lógica.

## Feed do OpenPhish (retirado na v3.0)
Na v2.4 o feed público do OpenPhish (espelhado em `openphish/public_feed`) foi usado como fonte. Ele **não é mais usado**:
o feed gratuito é só para uso não comercial. Na v3.0, a cada 6 horas são atualizadas as listas abertas (Phishing.Database e URLhaus).
O que foi medido na época, para referência:
Medido em 273 sites de golpe recentes: as regras pegam 1,1%; só 2,6% já estavam no Phishing.Database;
58,6% estão em hospedagem gratuita. Ou seja, o feed traz cobertura que as outras listas ainda não têm.

## Lista "Evite esses sites" do Procon-SP (v2.5)
Fonte: https://sistemas.procon.sp.gov.br/evitesite/list/evitesites.php (83 sites, atualizada em 12/05/2026 segundo a página).
A lista reúne sites com reclamações de consumidores, notificados que não responderam ou não encontrados, então
**não é uma lista de golpe confirmado**: gera um aviso forte (nível atenção, 50 pontos), sem bloqueio direto.
Nenhum dos 83 aparece no Phishing.Database nem no feed do OpenPhish: é cobertura brasileira nova.
Confira os termos de uso do Procon-SP antes de publicar a extensão.

## Imitação do governo e marca falsa na página (v2.6)
- **Gov.br:** endereço com "gov", "inss", "detran", "receitafederal" etc. que **não** termina em `.gov.br` soma 60 pontos
  (governos de outros países, como `gov.uk`, ficam de fora). "Restituição", "FGTS", "IRPF" sozinhos somam 20; com
  "resgate", "valores", "consulta" etc., 60. Ex.: `resgate-valores-gov.me` é bloqueado antes de abrir.
- **Marca falsa (AiTM):** se o título ou os cabeçalhos da página dizem ser Microsoft, Google, gov.br, um banco etc.,
  e a página pede senha ou pagamento num endereço que não é o oficial, o resultado é **perigo**, mesmo em site antigo
  (muitos ataques usam sites invadidos). Botões "Entrar com Google" não contam.
- A tela de bloqueio mostra os motivos que vieram da página.
- Testes de lógica: `node ml/testar_gov_marca.js`. Páginas de teste em `teste/`.

## Reclame Aqui (v2.7)
O Reclame Aqui não tem API pública, bloqueia consultas automáticas (Cloudflare) e o `robots.txt` proíbe robôs
na busca e no detector. Por isso a extensão **não consulta o Reclame Aqui sozinha**. Ela:
- mostra o botão **"Verificar no Reclame Aqui"** (no alerta e no popup), que abre o Detector de Site Confiável
  oficial e copia o endereço do site;
- deixa a pessoa registrar no popup **o que o Reclame Aqui mostrou**. Esse registro entra na pontuação:
  em lojas soma na confiança (Verificado +20, Ótimo +15, Bom +10, Regular 0, Ruim −20, Não recomendado −40,
  Sem cadastro −5); nos demais sites, o contrário nos pontos de risco.
Testes de lógica: `node ml/testar_reclameaqui.js`.

## Receita Federal (BrasilAPI) e consumidor.gov.br (v2.8)
- **BrasilAPI** (gratuita, código aberto): se a página mostra um CNPJ, a extensão consulta a situação na Receita.
  Ativo +10 de confiança; aberto há menos de 6 meses −15; **inexistente, baixado ou inapto −25**. Sem resposta, não conta.
  Só o CNPJ (dado público da empresa) é enviado; o resultado fica guardado por 7 dias.
- **consumidor.gov.br** (dados abertos oficiais): resumo de abril a setembro de 2026 de 1.053 empresas com 20+ reclamações
  (1,94 milhão de reclamações), em `dados/consumidor.json`. Liga ao site pelo nome exato (do domínio ou da Receita).
  Cadastrada +5; responde 95%+ +5; resolve 60%+ +5; resolve menos de 30% −10; nota abaixo de 2 −5.
  Não estar cadastrada não conta contra (o cadastro é voluntário). Só números por empresa; nenhum dado de quem reclamou.
  Para atualizar: baixar os "Dados – Mês/Ano" em consumidor.gov.br (Dados Abertos) e rodar `python3 ml/consumidor.py dados/consumidor.json arquivos.zip`.
- Testes de lógica: `node ml/testar_empresa.js`.

## v3.0: acessibilidade, pessoa de confiança, verificação completa e aprendizado de máquina

### Tela de boas-vindas (`boas-vindas.html/js`)
Abre sozinha na instalação (e depois pelo botão **"Acessibilidade e pessoa de confiança"** do popup).
A pessoa escolhe a acessibilidade (pode marcar mais de uma):

| Perfil | O que liga |
|---|---|
| Idoso(a) ou dificuldade com a internet | Letras grandes, avisos simples, voz automática e **cadastro da pessoa de confiança** (recomendado) |
| Cego(a) ou usa leitor de tela | Avisos com `role="alertdialog"`, foco no botão seguro e anúncios `aria-live`. A voz própria fica desligada para não falar junto com o NVDA/JAWS |
| Baixa visão | Letras e botões grandes |
| Daltônico(a) | Azul (seguro), laranja (atenção) e preto (perigo), sempre com símbolo e palavra, no lugar de verde e vermelho (selo do ícone, popup, avisos e bloqueio) |
| Dificuldade para ler | Voz automática e avisos simples |

A voz automática usa `chrome.tts` (permissão `tts`), que funciona mesmo sem clique.

### Pessoa de confiança (`pessoa.js`)
Nome + WhatsApp (com DDD) e/ou e-mail, guardados **só neste computador**. Na tela de bloqueio, nos avisos e no popup aparece
o botão **"Perguntar para Maria se é golpe"**: abre o WhatsApp (`wa.me`) ou o e-mail com a mensagem pronta e o **link do site**.
Nada é enviado sozinho: a pessoa confirma o envio no WhatsApp. Também há "Copiar a mensagem".

### Tela de bloqueio no mesmo padrão do alerta
**Confiança em porcentagem** (com barra e frase, nunca só cor), "O que fazer", botões grandes (voltar, perguntar à pessoa de confiança,
**Verificar no Reclame Aqui** em destaque, verde e com a logo), "O que encontramos" e a **verificação completa**, que olha as mesmas coisas que o
Detector de Site Confiável do Reclame Aqui, só com fontes abertas e sem abrir o site:

| Item | Fonte | Efeito na confiança |
|---|---|---|
| Listas de golpes | Phishing.Database, URLhaus, Procon-SP | em lista de golpe: confiança 0 |
| Idade do site | RDAP (registro.br para .br) | < 30 dias −40, < 90 −25, < 6 meses −10, desconhecida −10; 1 ano +10, 3 anos +20 |
| Cadeado | endereço | sem https −10 (com https não soma: golpe também usa) |
| Empresa responsável | **CNPJ do dono do domínio (registro.br) → BrasilAPI** | inexistente/baixado/inapto −25; ativa +10 (aberta há < 6 meses −15); pessoa física −5 |
| Reclamações | consumidor.gov.br (dados abertos) | +5 a +15, ou −10 se resolve pouco |
| Reclame Aqui | nota registrada pela pessoa | Verificado +20 … Não recomendado −40 |
| Inteligência artificial | modelo do nome do site | aparece como contra/informação (os pontos já entram no bloqueio) |

Um site bloqueado começa com no máximo 30% (o que o bloqueou) e cada prova muda a confiança. O CNPJ do responsável pelo
domínio também passou a valer nas lojas quando a página não mostra CNPJ. O número de CPF nunca é guardado.

### Confiável só com 90% ou mais (v3.3)
A confiança aparece sempre em **porcentagem**, na hora (sem texto de "carregando"; quando a verificação completa termina, o número é ajustado). Um site só é **confiável com 90% ou mais** (rigor alto, o padrão; 60% ou mais no rigor normal). Antes era "mais de 80%" (v3.0) e "mais de 75" (v2.4).
Com 90%, uma loja só passa se juntar quase todas as provas: por exemplo, 3 anos ou mais, https, CNPJ, contato, políticas e pagamento conhecido (90%), ou essas provas sem o pagamento conhecido, mais o CNPJ ativo na Receita ou uma boa nota do Reclame Aqui.

### Logo do Reclame Aqui
`icons/reclameaqui.png` vem do Wikimedia Commons (`File:Reclame-aqui-logo.png`, imagem em domínio público). O nome e a logo são **marca registrada** do Reclame Aqui: aqui só identificam o botão que leva ao site deles. Para uso comercial, peça autorização ao Reclame Aqui.

### Aprendizado de máquina ligado (`modelo.js` + `ml/modelo.json`)
O classificador do nome do site (gradient boosting, `ml/treinar.py`) agora roda dentro da extensão. `modelo.js` recalcula os
mesmos 28 sinais de `ml/recursos.py`; `node ml/testar_modelo.js` confere que JavaScript e Python dão a mesma probabilidade (38/38).
Ele é aplicado só ao **domínio principal** (subdomínios como `www.` confundem o modelo) e **soma pontos, nunca decide sozinho**:
probabilidade ≥ 0,876 soma 15 pontos de risco; ≥ 0,95 soma 25. Medido em 40 mil sites do ranking Tranco e 40 mil golpes do Phishing.Database:

| Limiar | Golpes pegos | Falsos alertas (todos) | Falsos alertas (.br) |
|---|---|---|---|
| 0,876 | 10,1% | 1,1% | 0,0% |
| 0,95 | 6,0% | 0,2% | 0,0% |

### Testes
```
node ml/testar_verificacao.js   # verificação completa e pessoa de confiança
node ml/testar_modelo.js        # paridade do modelo (rodar antes: python3 ml/gerar_paridade.py)
node ml/testar_confianca.js && node ml/testar_reclameaqui.js && node ml/testar_empresa.js
node ml/testar_gov_marca.js && node ml/testar_pontuacao.js
```

## v3.4: aplicativo e extensão juntos
A tela **"Verificar um link"** (`verificar.html`, `verificar.js`, `verificar.css`) serve aos dois:
- **Na extensão:** botão "Verificar um link antes de abrir" no popup. Usa o armazenamento da extensão
  (pessoa de confiança, notas do Reclame Aqui, listas já baixadas).
- **No celular:** a mesma pasta publicada como site vira o aplicativo (PWA, com `manifest.webmanifest` e `app-sw.js`).
  Lá, o `ponte.js` imita o `chrome.storage` com o armazenamento do aparelho.
A tela carrega o próprio `background.js`; o `ponte.js` desliga nela os ouvintes (bloqueio, alarmes, mensagens),
porque quem bloqueia páginas é só o service worker. A tela confere só o **link** (não vê a página):
começa em 50%, tira os pontos de risco do endereço e soma as provas com os pesos da tela de bloqueio. Confiável com 90% ou mais.

## v3.2: visual sóbrio e limpo
A tela de bloqueio e o aviso de tela cheia nas páginas usam um visual simples: fundo vermelho-escuro (azul no modo daltônico),
octógono com "X", o rótulo PERIGO, título direto, o site numa caixa escura, a confiança em porcentagem com uma barra fina,
um parágrafo curto, a lista do que encontramos e três botões (voltar, perguntar à pessoa de confiança e Reclame Aqui).
A verificação completa, os outros jeitos de perguntar e o "Ouvir o aviso" ficam em "Ver a verificação completa".
(A v3.1 testou um visual de cartaz de campanha, que foi trocado por este por estar poluído.)
