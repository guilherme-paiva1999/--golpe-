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

## v3.11: o nome agora é "Isso é golpe?"
A extensão e o aplicativo passaram a se chamar **Isso é golpe?** (antes: "É Golpe?"), igual aos slides e ao pitch:
nome no Chrome, popup, boas-vindas, tela de bloqueio, aplicativo, aviso no Reclame Aqui e mensagens para a pessoa de confiança.

## v3.18.2: limite de confiável em 80% (80 já conta)

Pedido do Guilherme: **confiável com 80% ou mais** (a regra é "maior ou igual": exatamente 80% já é confiável; rigor normal continua 60%).
Foi 80% até a v3.2, 90% da v3.3 à v3.16, 80% da v3.16.4 à v3.18.0, 90% só na v3.18.1 (não chegou ao GitHub) e agora 80% de novo.

## v3.18.1: limite de confiável volta a 90% (substituída pela v3.18.2)

Pedido do Guilherme: **confiável só com 90% ou mais** (rigor normal continua 60%). Era 80% da v3.16.4 à v3.18.0 e 90% da v3.3 à v3.16.
Mudou em `limiteConfianca`, na tela de aviso e de bloqueio, no popup, na boas-vindas e nos testes. Os pitches em markdown voltaram a dizer 90%.

## v3.18.0: confirma se as empresas são do mesmo grupo e o Reclame Aqui entra na conta

**1) Mesmo grupo, de verdade.** Quando o CNPJ da página é diferente do dono do endereço (registro.br), a v3.17.2 aceitava qualquer dono ativo
como "provável grupo". Agora a extensão **confere o quadro societário público da Receita** (BrasilAPI e Minha Receita) das duas empresas:
- **Mesmo grupo** se uma é sócia da outra, se as duas têm a mesma empresa como sócia, ou se têm **2 ou mais sócios/administradores em comum**.
  Vale a idade e a situação da dona do endereço, e a linha verde diz o motivo ("faz parte do mesmo grupo... as duas têm 4 sócios ou
  administradores em comum"). Conferido com dados reais: C&A Modas × Cofra Latin America = mesmo grupo (4 em comum); C&A × Magazine Luiza = não.
- **Sem relação**: vira **ponto de atenção** ("o CNPJ da página (...) e a empresa dona do endereço (...) não parecem ser do mesmo grupo: não
  achamos sócios em comum"), tira 15 pontos e a idade da empresa da página não vale (protege contra CNPJ copiado de uma empresa conhecida).
- Se a consulta falhar e não der para verificar: não pune, mas avisa que não deu para confirmar.
- Privacidade: dos sócios só ficam guardadas chaves (empresas sócias e um código curto de nome + CPF parcial das pessoas), nunca os nomes.

**2) Reclame Aqui entra na conta, no peso mínimo** (pedido do Guilherme, em pontos de 0 a 100): **5 escudos +10, 4 escudos +5, 3 escudos
neutro (nem ganha nem perde), 2 escudos −5, 1 escudo −10**. Só usa a nota lida automaticamente (espera até 5 segundos); se ela não vier,
vale a nota que a pessoa registrou no popup, como antes. Nota boa entra na lista verde ("Reclame Aqui: 4 de 5 escudos (+5 pontos de
confiança)") e nota baixa na vermelha ("Reclame Aqui: 1 escudo (-10 pontos de confiança)").
- Testes: `ml/testar_cnpj.js` (22), `ml/testar_loja.js` (20, inclui as notas 5, 4, 3, 2 e 1).

## v3.17.2: CNPJ de outra empresa do mesmo grupo não é golpe (caso C&A)

A C&A (`cea.com.br`) mostrava 29% de confiança com 9 pontos a favor e nota 5 de 5 no Reclame Aqui. A página mostra o CNPJ da **C&A Modas**
(45.242.914/0001-05), mas o endereço está registrado no registro.br em nome da **Cofra Latin America Ltda.** (05.236.528/0001-88), a empresa
do mesmo grupo. A regra da v3.15 tratava isso como CNPJ copiado: tirava 15 pontos, jogava a idade da empresa fora (base de 35%) e deixava a
pressão pesar por inteiro. Resultado: 29%.
- Agora a extensão **consulta também a empresa dona do endereço**. Se ela é real e ativa, a loja usa a idade e a situação dela (aqui, ativa
  desde 2002 = base de 70%, e a pressão deixa de pesar), e a linha diz: "O endereço do site está registrado em nome de X (CNPJ ...), ativa,
  aberta há N anos. O CNPJ da página (...) é de outra empresa, provavelmente do mesmo grupo." (entra em "Pontos a favor").
- Só se a dona do endereço **não existir ou estiver inativa** vale o aviso antigo ("Atenção: o CNPJ da página não é o da empresa dona do
  endereço"), com −15 pontos e sem a idade da empresa da página (protege contra CNPJ copiado).
- O aviso não aparece mais duas vezes na lista vermelha.
- Testes: `ml/testar_cnpj.js` (21) e `ml/testar_loja.js` (14, com um caso no estilo C&A: 99% mesmo com pressão).

## v3.17.1: loja confiável aparece na tela e a escolha "o que mostrar" no início

- **Loja acima de 80% agora aparece como confiável.** Uma loja com 84% não mostrava nada porque a opção vinha em "só avisar sobre sites
  suspeitos". O padrão agora é **"Mostrar todos os sites"**: selo verde pequeno nas lojas confiáveis e aviso nas suspeitas. O popup também
  mostra "✓ Loja confiável · 84% de confiança" (antes dizia "não verificado").
- **Escolha no início** (tela de boas-vindas, passo 2): "Mostrar todos os sites" (padrão) ou "Só mostrar os sites suspeitos ou maliciosos".
  No popup há uma terceira, "Aviso total até nos confiáveis". A chave da opção mudou de `avisoConfiaveis` para `mostrar` (`todos`,
  `suspeitos`, `total`), para ninguém ficar preso na escolha antiga.
- Vale para páginas de compra, como todo o resto (a extensão continua quieta em páginas que não pedem dinheiro).
- Teste no Chrome: confere que "todos" vem marcado e que "só suspeitos" é salvo.

## v3.17.0: duas listas, confirmações abertas e aviso também para lojas confiáveis

- **Duas listas coloridas** no aviso e na tela de bloqueio, em vez de uma lista só: **⚠ Pontos de atenção** (vermelho, com ✕) e
  **✓ Pontos a favor** (verde, com ✓). O que a loja tem a favor agora aparece em frases (site com mais de N anos, cadeado, CNPJ válido,
  contato, políticas, meio de pagamento conhecido, CNPJ conferido na Receita). Para daltônicos, laranja/preto e azul.
- **Reclame Aqui num cartão verde só:** em cima, a nota ("De acordo com o Reclame Aqui: [escudos] 4 de 5") ou a mensagem "O Reclame Aqui
  ainda não analisou este site"; embaixo, "→ Confira você mesmo no Reclame Aqui". Sem a nota, aparece só a linha de baixo.
- **Três confirmações abertas** (entram nas listas quando chegam, sem texto de "carregando"; não mudam a porcentagem):
  - **Ranking Tranco** (arquivo local `dados/tranco-100k.txt`, os 100 mil sites mais visitados, lista de 07/11/2026; Tranco, tranco-list.eu,
    Le Pochat et al., NDSS 2019). Estar na lista é a favor; não estar não vira linha (é normal para lojas menores).
  - **Internet Archive (Wayback Machine):** desde quando o site aparece nos arquivos. Sem histórico entra em "atenção".
  - **crt.sh:** data do primeiro certificado público do domínio. Demora de 15 a 25 segundos em domínios grandes, por isso chega por último;
    certificado de menos de 90 dias entra em "atenção". Cada resposta fica guardada (7 dias o Archive, 30 dias o crt.sh).
  - Podem ser desligadas no popup ("Conferir também no Internet Archive, no ranking Tranco e no crt.sh"). Envia o domínio ao Internet Archive e ao crt.sh.
- **Aviso também para lojas confiáveis (80% ou mais), no popup:** "Só avisar sobre sites suspeitos" (padrão), "Mostrar também um selo verde
  pequeno nos confiáveis" ou "Mostrar o aviso total até nos confiáveis" (tela verde "Esta loja parece confiável", com as duas listas).
  Aparece uma vez por site por dia e só em páginas de compra. O popup tem botões para ver os dois exemplos.
- Testes: `node ml/testar_confirmacoes.js` (18) e o teste no Chrome.

## v3.16.4: limite de 80%, layout verde do Reclame Aqui e recarga automática

- **Confiável a partir de 80%** (antes 90%, desde a v3.3). Rigor normal continua 60%. Mudou em `limiteConfianca` (background.js), na tela de
  bloqueio, no aviso, no popup e nos testes. Os materiais de apresentação ainda falam em 90% (ver `3-apresentacao/`).
- **Reclame Aqui em um só visual verde, com a logo:** "De acordo com o Reclame Aqui: [escudos] N de 5 escudos (rótulo)" e, embaixo, o
  botão verde "→ Confira você mesmo no Reclame Aqui". O antigo botão "Verificar no Reclame Aqui" saiu da tela de aviso e de bloqueio
  (eram dois botões para a mesma coisa). Sem a nota (opção desligada, site novo ou desafio do Reclame Aqui), fica só o botão verde.
- **Recarga automática (só extensão carregada de uma pasta):** a cada minuto a extensão lê o `manifest.json` da própria pasta e, se a
  versão mudou, chama `chrome.runtime.reload()`. Quem instala pela Chrome Web Store não passa por isso. Testado: o alarme dispara e a
  extensão se recarrega; no Chrome de teste (carregado por automação) a extensão não volta depois do reload, o que não acontece em
  "Carregar sem compactação". Por isso toda mudança precisa subir o número da versão.

## v3.16.2: escudos do Reclame Aqui, ligados por padrão, e um erro no ícone

- **Escudos do Reclame Aqui no aviso e na tela de bloqueio**, ligados por padrão (dá para desligar no popup): "De acordo com o Reclame Aqui:
  [escudos] 5 de 5 escudos (Confiável)" e, embaixo, "→ Confira você mesmo no Reclame Aqui". Os escudos são desenhados pela extensão (de 0 a 5).
  Se o Reclame Aqui ainda não analisou o site, aparece só isso e o link. A permissão do site do Reclame Aqui agora vem no manifesto.
  Conferido num Chrome normal (com tela): Magazine Luiza 5 de 5, KaBuM 4 de 5, site novo "ainda não analisou". Num Chrome sem tela, o
  Cloudflare do Reclame Aqui barra a consulta (nesse caso a extensão não contorna: mostra só o link).
- **Erro "setBadgeBackgroundColor ... Missing required property 'color'"** (página de erros da extensão): ao limpar o selo do ícone (estado
  "nenhum", sem cor) a extensão pedia uma cor que não existe. Agora só pede a cor quando há uma.

## v3.16.1: consulta do CNPJ mais confiável

No Magazine Luiza o aviso dizia "a Receita Federal não respondeu agora" e a confiança caía: a BrasilAPI levou 8,8 segundos para esse
CNPJ e a extensão desistia aos 6. Agora a consulta usa **duas fontes abertas ao mesmo tempo** (BrasilAPI e Minha Receita, mesmos dados da
Receita) e vale a primeira que responder (271 ms no teste), espera até 12 segundos e, se as duas falharem, usa o último resultado
guardado, mesmo velho. A mensagem de falha também ficou mais clara.

## v3.16: a confiança da loja parte da empresa; nota do Reclame Aqui no aviso; "Ouvir" só para quem pede

**Nova conta da loja (decisão do Guilherme).** O ponto de partida é a empresa (CNPJ na Receita Federal):
- **CNPJ ativo, pelos anos de empresa:** menos de 5 anos = confiança **baixa** (parte de 35% a 50%); de 5 a 10 anos = **média** (50% a
  70%); **10 anos ou mais = alta (70%)**. Sobe aos poucos, sem degraus bruscos. As provas da página (cadeado, contato, políticas,
  idade do site...) somam por cima, com peso de 30%.
- **Sem CNPJ ativo** (não existe, baixado, inapto ou nenhum): já **não é confiável** e a confiança **cai muito**: parte de no máximo 20% e só cai.
- **Palavras de pressão e descontos grandes:** pesam por inteiro (15 pontos cada) quando a empresa não tem CNPJ ativo ou tem até 5 anos;
  vão perdendo peso até 10 anos; **de 10 anos em diante deixam de pesar** ("promoção com prazo" é normal em empresa antiga).
- Empresa com menos de 6 meses perde 15; menos de 1 ano, 5. Sem atividade de comércio na Receita, perde 10 (como antes).
- O CNPJ da página que não é o do dono do domínio (registro.br) não ganha a base de idade: protege contra golpe que copia o CNPJ de
  uma empresa antiga. Se a Receita não responde, a conta segue sem a empresa (não pune a loja).
- Exemplos (testes): empresa de 29 anos com pressão, desconto e todas as provas: 99%; com poucas provas: 87%; 7 anos: 75%, e a
  pressão tira só uma parte (66%); 2 anos: 58%, e a pressão tira 15 (43%); sem CNPJ: 20%, e com pressão 5%.
- Testes: `node ml/testar_loja.js` (12). Substitui, na loja, o `aplicarEmpresa` (continua valendo fora das lojas).

**Nota do Reclame Aqui no aviso (opcional, desligada).** No popup: "Mostrar a nota do Reclame Aqui nos avisos". A extensão consulta
em segundo plano a página pública do Detector, lê o veredito nos dados estruturados (schema.org, JSON-LD) e mostra "Segundo o Reclame
Aqui: Confiável (5 de 5 escudos). Verifique você mesmo: [link]". Não muda a porcentagem. Pede a permissão do site só quando a pessoa
liga a opção. Se o Reclame Aqui responder com o desafio anti-robô (Cloudflare), **não contornamos**: aparece "não deixou consultar
automaticamente" e o link; a consulta fica em pausa por 30 minutos. Nos testes com Chrome sem tela (headless) o desafio apareceu
sempre; num Chrome normal ainda não foi medido. Testes: `node ml/testar_ra_nota.js` (leitura do veredito).

**"Ouvir o aviso"** só aparece para quem marcou "Ler os avisos em voz alta" na tela de boas-vindas (antes aparecia sempre).

## v3.15: a extensão faz a conferência que o aviso mandava a pessoa fazer

O aviso dizia "abra o site oficial digitando o endereço e confira o CNPJ da loja". Agora isso é feito pela extensão:
- **Conferência do CNPJ** ("Já conferimos por você"): consulta o CNPJ na Receita Federal (BrasilAPI) e mostra na tela de aviso e de bloqueio:
  nome da empresa, situação e tempo de abertura. Compara o CNPJ da página com o do **dono do domínio no registro.br**: se forem de
  empresas diferentes (os 8 primeiros números), avisa e tira 15 pontos. Rodapé com vários CNPJs (loja e financeira do cartão):
  vale o que é do dono do domínio. Antes pegava o primeiro (no Magazine Luiza, o da Luizacred, e o aviso dizia que "a empresa não tem
  atividade de comércio").
- **Site oficial:** quando o endereço ou a página imita uma marca conhecida (Nubank, Itaú, Apple...), a tela ganha o botão
  "Abrir o site oficial (nubank.com.br)". O endereço vem da tabela da extensão, nunca da página.
- **Empresa antiga pesa mais:** com 10 anos ou mais, +20 se o CNPJ é o do dono do domínio (confirmado no registro.br) e +8 se só está
  escrito na página (qualquer um pode escrever o CNPJ de outra empresa); de 5 a 10 anos, +12 e +5.
- **Site internacional** (endereço que não termina em .br): a loja ganha o aviso "Este é um site internacional" (-10 pontos, nível
  atenção, sem bloquear). Fora do .br, carrinho ou botão de compra já bastam para a página contar como loja (muitas lojas
  internacionais só mostram os preços depois de um clique).
- **Reclame Aqui sozinho (opcional, desligado):** no popup, "Abrir o Reclame Aqui sozinho quando aparecer um aviso" abre a nota da loja em
  outra aba, uma vez por site e por dia. O Reclame Aqui não deixa a página dele aparecer dentro da nossa tela (`x-frame-options:
  SAMEORIGIN`), por isso é outra aba. Fica desligado porque envia o endereço da loja ao Reclame Aqui sem o clique da pessoa.
- Testes: `node ml/testar_cnpj.js` (20), `ml/testar_empresa.js` (26); o teste no Chrome confere o botão do site oficial.

## v3.14: Reclame Aqui abre direto na nota do site

O Detector de Site Confiável tem um endereço público por site: `https://www.reclameaqui.com.br/detector-site-confiavel/<site>`.
Os botões verdes (tela de bloqueio, aviso na página, popup e aplicativo) agora abrem esse endereço, e a pessoa já vê o veredito
(conferido com `magazineluiza.com.br`: "Confiável, 5 de 5 escudos, RA1000"). Para um site que o Reclame Aqui ainda não conhece,
a página dele começa a análise e pede "não sou um robô" para a própria pessoa.
- Não é robô: é um link do próprio Reclame Aqui que a pessoa abre com o clique dela. Nada é lido, preenchido ou clicado por nós.
- Funciona também no celular (antes o endereço só era copiado para colar).
- Saiu o `reclameaqui.js` (preenchia o campo do Detector) e o "raPendente". O link fica em `pessoa.js` (`EGolpeRA.link`).
- Testes: `node ml/testar_reclameaqui.js` (link direto) e o teste no Chrome confere que o botão abre a nota do site.

## v3.13: alfabeto cirílico (letras russas disfarçadas)

Golpistas trocam letras latinas por letras russas idênticas: o endereço `аррӏе.com` (no computador, `xn--80ak6aa92e.com`) aparece
como "apple.com"; na página, "Nеtfliх" e "Pіx" parecem normais, mas não batem com filtros comuns. Havia um caso real na coleta
(`ficos.com.br`, "Nеtfliх") e 5 endereços com cirílico no Phishing.Database.

- **`alfabetos.js`** (cópia em Python: `ml/alfabetos.py`): decodifica o endereço (punycode), mede quanto é cirílico, acha palavras
  que **misturam** os dois alfabetos e devolve o "esqueleto" em letras latinas. O russo de verdade (`мвд.рф`, "Личный кабинет")
  fica como está. Carregado no background, no content script e no aplicativo.
- **Regra do endereço:** letras russas imitando uma marca (`аррӏе.com`, `gоogle.cf`, `nubаnk.com.br`) = **70 pontos (perigo, bloqueia
  antes de abrir)**, com o motivo "O endereço imita "apple" trocando letras por letras russas iguais". Outros disfarces: 30 (como
  antes). Site escrito em russo de verdade (`.рф`): 10 pontos (antes eram 30). Os hífens do "xn--" não contam mais como "vários hífens".
- **Modelo do nome do site, retreinado** com 4 características novas (`cirilico`, `mistura_alfabetos`, `tudo_parecido`,
  `marca_homografo`), 567 sites reais com nome em cirílico (Umbrella + Tranco) e 4.000 golpes **gerados** com letras disfarçadas
  (as listas abertas quase não têm exemplos; gerar é fazer o mesmo que o golpista faz). Teste com sites que o modelo nunca viu:
  dados reais **AUC 0,892** (antes 0,889); golpes gerados com letras disfarçadas: pega **99%**; sites reais em cirílico: **0%** de
  falsos alertas. Limiares refeitos para a mesma taxa de falsos alertas de antes em 15 mil sites do Tranco fora do treino: 0,881 e 0,949.
- **Modelo da página, retreinado:** palavras de alfabeto misturado são lidas em letras latinas ("Nеtfliх" vira "Netflix") e 2
  características novas (`misturaAlfabetos`, `cirilico`), 41 no total. No treino, cada página de golpe ganhou uma cópia com 1 a 4
  palavras disfarçadas (só no treino; o acerto é medido nas páginas reais). Teste por domínio: **AUC 0,916**; com 2% de falsos
  alertas pega **55%** dos golpes (antes 52,5%); com 1%, 38% (antes 36%). A página real do "Nеtfliх" dá 99,6%.
- As regras do `content.js` (Pix, pagamento, pressão, marcas na página, posts) também leem o texto em letras latinas.
- Testes: `node ml/testar_alfabetos.js` (JavaScript = Python, 101/101), `ml/testar_modelo.js` (45/45, com endereços em cirílico),
  `ml/testar_gov_marca.js` (casos de cirílico) e `ml/testar_modelo_pagina_extensao.js` (página com letras disfarçadas continua golpe).

## v3.12: a inteligência artificial lê a página

- `modelo-pagina.js` + `ml/modelo-pagina.json` (126 KB): regressão logística com o texto da página (pedaços de 3 a 5 letras,
  TF-IDF, 5.000 pedaços) e 39 características. Treino em `8-treino-ml/final.py` (1.195 páginas: 299 golpes no ar e 896 sites reais).
- Escolhido na comparação com rede neural, floresta e boosting (`8-treino-ml/README.md`). Teste por domínio: AUC 0,92;
  com 2% de falsos alertas pega 52% dos golpes (+15 pontos); com 1%, 36% (+25 pontos). **Soma pontos, nunca bloqueia sozinho.**
- O `content.js` manda as medidas da página (`medidasDaPagina`) junto com os sinais, só em páginas de dinheiro. Ficam no
  computador: vão só para o background da própria extensão. O background valida tudo (`limparMedidas`).
- Sem medidas (aplicativo, checagem antes de abrir, tela de bloqueio), vale o modelo do nome do site (`modelo.js`).
- Testes: `node ml/testar_modelo_pagina.js` (JavaScript = Python, 40/40) e `node ml/testar_modelo_pagina_extensao.js` (ponta a ponta).

## v3.10: sites que prometem espionar ou clonar a conta de outra pessoa
Num site real (`www.sppy.site`, "Clonar perfil agora… 100% anônimo, sem notificar o usuário"), a extensão via o endereço suspeito
(terminação .site, 41 dias de vida), mas ficava quieta, porque a página não pedia pagamento logo de cara. Agora a página conta como
golpe quando tem um **botão de ação** ("Clonar", "Espionar", "Investigar", "Rastrear", "Hackear"…) **e** a promessa no texto
("de qualquer pessoa", "sem notificar", "100% anônimo", "mensagens apagadas"…): soma 50 pontos de risco e o motivo
"O site promete espiar ou clonar a conta de outra pessoa…". Uma notícia que só fala desse golpe não tem o botão e não conta
(conferido ao vivo: G1 e CNN Brasil abrem normalmente). Também deixa de repetir a idade do site na tela de bloqueio.

## v3.9: dados da empresa na BrasilAPI (situação, tempo de empresa e atividades)
Quando há CNPJ (na página ou no registro.br), a BrasilAPI informa:
- **Situação:** inexistente, baixada, suspensa ou inapta tira 25 e, em loja, bloqueia (como antes).
- **Tempo de empresa:** menos de 6 meses −15; de 6 meses a 1 ano −5; 5 anos ou mais +5. Empresas novas são usadas em golpes.
- **Atividades econômicas (CNAE principal e secundárias):** se a página **vende produtos** e a empresa não tem nenhuma atividade de
  comércio ou indústria (divisões 10 a 33, 45, 46, 47, intermediação 7490-1/04 ou portais 6319), tira 10, com o motivo
  "A empresa não tem atividade de comércio registrada na Receita (atividade principal: …)". Sozinho, não bloqueia.
- A tela de bloqueio e o aplicativo mostram "aberta há N anos" e a atividade principal.
Testes: `node ml/testar_empresa.js` e `node ml/testar_verificacao.js`.

## v3.8: sites de notícias não são mais tratados como loja
A medição com sites reais mostrou CNN Brasil e Estadão bloqueados como "loja sem CNPJ": a página tinha "R$" (cotações,
"vendido por R$ 22 milhões") e a palavra "comprar" no texto. Agora só é loja quando a página tem preço **e** um **botão** de compra
("Comprar", "Adicionar ao carrinho/sacola", "Finalizar compra") ou link de carrinho, sacola ou checkout. Pressão ("últimas horas")
e desconto sozinhos também não fazem mais a página contar como página de dinheiro. Conferido ao vivo: CNN Brasil, Estadão, G1 e UOL
abrem sem análise; KaBuM continua analisada como loja.

## v3.7: loja estrangeira
Loja **fora do .br**, **sem CNPJ** e **não voltada ao Brasil** (sem preços em R$ e página que não está em português) também é
bloqueada, mas com outro aviso: **"Esta é uma loja estrangeira"**, "Ela está fora dos nossos cuidados: não tem CNPJ e não segue as leis
brasileiras de defesa do consumidor. Mas o que podemos dizer sobre ela está logo abaixo", com a lista do que vimos e a verificação
completa já aberta. Loja sem CNPJ com preços em R$ ou em português, mesmo em .com ou .shop, continua com o aviso de "sem CNPJ":
é o disfarce comum de loja falsa. Página de teste: `teste/loja-estrangeira.html`.

## v3.6: só em páginas de dinheiro, e loja sem CNPJ é bloqueada
- **Só age onde há dinheiro.** Avisos, análise da página e selo no ícone só aparecem quando a página vende, pede pagamento ou Pix,
  usa pressão ("últimas unidades") ou desconto exagerado, manda dados de cartão, CPF ou senha para outro site, ou pede senha
  dizendo ser um banco, o gov.br ou outra marca. Em sites de leitura e vídeo a extensão fica quieta.
  Continuam valendo em qualquer site: o **bloqueio antes de abrir** de endereços que estão em listas de golpes ou que imitam
  banco ou gov.br (pontos de risco ≥ 70), e a proteção de posts com frases de golpe com dinheiro ("faça um Pix", "lucro garantido").
- **Loja sem CNPJ ativo é bloqueada.** Numa página que vende ou pede pagamento, a extensão procura o CNPJ na página e, nos sites .br,
  o do responsável pelo domínio no registro.br, e confere na Receita pela BrasilAPI. Sem CNPJ (ou site em nome de pessoa física),
  ou com CNPJ inexistente, baixado ou inapto: bloqueia. Se a BrasilAPI não responder, essa regra não bloqueia.
  Teste: `node ml/testar_cnpj.js`.
- **Um número só na tela de bloqueio.** Quando a loja é bloqueada pela página, a tela mostra a mesma porcentagem que causou o bloqueio
  (antes ela recalculava outra). A lista de provas continua embaixo.

## v3.5: Reclame Aqui com o endereço já preenchido (substituído na v3.14 pelo link direto da nota)
Ao clicar em **"Verificar no Reclame Aqui"** (popup, tela de bloqueio, aviso na página ou "Verificar um link"), a extensão guarda
o endereço por 2 minutos e abre o Detector de Site Confiável. O `reclameaqui.js`, que só roda na página do Detector, escreve o
endereço no campo e mostra um aviso pequeno. Ele **não envia** o formulário nem lê o resultado: a pessoa clica no botão do próprio
Reclame Aqui, então continua sem consulta automática (o site proíbe robôs). Se o campo não for encontrado em 15 segundos,
nada muda e o endereço continua copiado para colar. Abrir o Reclame Aqui sem clicar no botão não preenche nada.
No aplicativo do celular não há como mexer em outro site: o endereço fica só copiado.
O campo é achado pelo tipo (`url`) ou pelo texto (site, endereço, link, domínio). Foi testado numa página parecida, não no site real,
que bloqueia navegadores automáticos: se o Reclame Aqui mudar a página, pode ser preciso ajustar o `reclameaqui.js`.

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
