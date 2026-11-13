# Como continuar o É Golpe? em outro computador

## 1. Baixar o projeto
```
git clone https://github.com/guilherme-paiva1999/--golpe-.git e-golpe
cd e-golpe
```
O repositório é **público**: qualquer pessoa pode clonar, sem conta. Para **enviar** mudanças, precisa do Git, estar logado no GitHub (`gh auth login`) e ter sido adicionado como colaborador (Settings › Collaborators).

## 2. Instalar a extensão no Chrome
`chrome://extensions` → ligar **Modo do desenvolvedor** → **Carregar sem compactação** → escolher a pasta `1-extensao-codigo`.
Depois de mudar o código, clique em **Recarregar** na extensão e recarregue as abas abertas.
(O ZIP pronto, para quem não programa, fica em `2-extensao-pronta-para-instalar/`.)

## 3. Rodar os testes
Precisa do **Node.js** (testes de lógica) e, para o modelo, do **Python 3** com scikit-learn (só para treinar de novo).
```
cd 1-extensao-codigo
node ml/testar_verificacao.js
node ml/testar_modelo.js
node ml/testar_confianca.js
node ml/testar_reclameaqui.js
node ml/testar_empresa.js
node ml/testar_gov_marca.js
node ml/testar_pontuacao.js
node ml/testar_cnpj.js
node ml/testar_alfabetos.js
node ml/testar_loja.js
node ml/testar_ra_nota.js
node ml/testar_confirmacoes.js
node ml/testar_modelo_pagina.js
node ml/testar_modelo_pagina_extensao.js
```
Teste real num Google Chrome (abre um Chrome escondido com perfil temporário, precisa de internet):
```
cd teste-real
npm install
node testar.js
```
As capturas de tela ficam em `teste-real/capturas/` (não vão para o GitHub).
Teste da atualização das listas (ETag e só a diferença, v3.20; não precisa de internet): `cd teste-real && npm install && node testar_listas.js`.

## 4. Onde está cada coisa
| Arquivo | O que faz |
|---|---|
| `1-extensao-codigo/background.js` | Regras, listas de golpes, RDAP/BrasilAPI, verificação completa, aprendizado de máquina, bloqueio |
| `1-extensao-codigo/modelo.js` + `ml/modelo.json` | Modelo de aprendizado de máquina do nome do site |
| `1-extensao-codigo/content.js` | Avisos dentro das páginas |
| `1-extensao-codigo/bloqueado.html/js` | Tela de bloqueio |
| `1-extensao-codigo/boas-vindas.html/js` | Escolha da acessibilidade e pessoa de confiança |
| `1-extensao-codigo/pessoa.js` | Mensagem para a pessoa de confiança (WhatsApp/e-mail) |
| `1-extensao-codigo/popup.html/js` | Janelinha do ícone |
| `1-extensao-codigo/README.md` | Explica cada regra e cada versão em detalhe |
| `1-extensao-codigo/verificar.html/js/css` + `ponte.js` | Tela "Verificar um link": é o aplicativo do celular e também uma tela da extensão (botão no popup). Usa o próprio `background.js`, sem cópia |
| `7-aplicativo/README.md` | Como publicar e instalar o aplicativo no celular |

## 5. Decisões já tomadas (para não desfazer sem querer)
- **Só fontes abertas** que permitem uso comercial: Phishing.Database (MIT), URLhaus (CC0), Procon-SP, RDAP, BrasilAPI,
  consumidor.gov.br. O **OpenPhish foi retirado** porque o feed grátis não permite uso comercial.
- **Reclame Aqui** não é consultado automaticamente (sem API pública e o site proíbe robôs). A pessoa clica no botão verde,
  que abre o Detector oficial **direto na nota do site** pelo link público `detector-site-confiavel/<site>` (3.14.0; antes o `reclameaqui.js`
  preenchia o campo). Nada é lido nem clicado por nós; em site novo, o Reclame Aqui pede "não sou um robô" para a pessoa. A logo veio do Wikimedia Commons (domínio público), mas é marca registrada: para uso comercial,
  pedir autorização.
- **Confiança em porcentagem**, aparece na hora (sem "carregando"). **Só é confiável com 80% ou mais** ("maior ou igual": 80 já conta; rigor normal: 60% ou mais). Era 80% até a 3.2, 90% da 3.3 à 3.16, 80% da 3.16.4 à 3.18.0, 90% na 3.18.1 (não publicada) e voltou a 80% na 3.18.2 (pedido do Guilherme).
- **Aprendizado de máquina** só soma pontos, nunca bloqueia sozinho. Desde a 3.12.0, nas páginas de dinheiro vale o
  **modelo da página** (regressão logística com texto + características; AUC 0,92, ~52% dos golpes com 2% de falsos alertas).
  A **rede neural foi testada e não ganhou** do clássico com estes dados (`8-treino-ml/README.md`). Sem página para ler,
  vale o modelo do nome do site (~10% dos golpes com ~1% de falsos alertas).
- **Sites que trocam de página sem recarregar** (3.18.3, caso H&M): `content.js` vigia a troca de endereço (pushState) e refaz a checagem; teste
  `teste/spa.html`. A página inicial sem venda continua quieta de propósito.
- **Mesmo grupo e Reclame Aqui na conta** (3.18.0, pedido do Guilherme): CNPJ diferente do dono do domínio só é normal se as empresas forem do mesmo
  grupo (sócios em comum no quadro societário); senão é ponto de atenção. Escudos do RA: 5 = +10, 4 = +5, 3 = 0, 2 = -5, 1 = -10 (peso mínimo).
- **O que mostrar** (3.17.1, pedido do Guilherme): padrão "todos" = selo verde nas lojas confiáveis (80%+); escolha na boas-vindas e no popup
  (`mostrar`: todos, suspeitos, total). Só em páginas de compra.
- **Duas listas (contra/a favor) e confirmações abertas** (3.17.0, pedido do Guilherme): ranking Tranco local, Internet Archive e crt.sh só
  mostram linhas, não mudam a porcentagem. Reclame Aqui é um cartão verde só. Opção de mostrar o aviso também nas lojas confiáveis.
  Meta do Guilherme: "a melhor verificação do mercado". Pendente: Site Confiável (siteconfiavel.com.br não abre neste ambiente; falta o
  endereço da página de resultado e uma foto, enviados por ele).
- **Confiança da loja parte da empresa** (3.16.0, pedido do Guilherme): CNPJ ativo: menos de 5 anos = baixa (35 a 50%), 5 a 10 = média (50 a 70%), 10 ou mais = alta
  (70%) e a pressão não pesa; sem CNPJ ativo = cai muito (parte de 20% e só cai); pressão pesa 100% até 5 anos e perde o peso até 10 anos. Não desfazer sem combinar. `node ml/testar_loja.js`.
- **Nota do Reclame Aqui no aviso** (3.16.0, opção desligada): lê o JSON-LD público; não contorna o desafio anti-robô do Cloudflare.
- **Conferência automática** (3.15.0): o aviso mostra "Já conferimos por você" (CNPJ na Receita e dono do domínio no registro.br) e
  o botão do site oficial quando imita uma marca. Reclame Aqui sozinho é opção desligada (envia o endereço da loja sem clique).
- **Alfabeto cirílico** (3.13.0): `alfabetos.js` lê letras russas disfarçadas no endereço e na página; os dois modelos foram
  retreinados com isso. Os golpes de endereço com letras disfarçadas usados no treino são **gerados** (as listas abertas têm só 5).
  Letras russas imitando marca = 70 pontos (bloqueia). Para retreinar: `ml/treinar.py` (nome) e `8-treino-ml/final.py` (página);
  no Windows, rode o Python com `PYTHONUTF8=1`.
- **Visual** da tela de bloqueio e dos avisos: sóbrio e limpo (vermelho-escuro, octógono com X, "PERIGO", lista de motivos,
  três botões). O visual de "cartaz de campanha" da v3.1 foi descartado por estar poluído.
- **Aplicativo e extensão juntos** (3.4.0): o aplicativo confere o link antes de abrir; a extensão cuida das páginas. Um código só: o aplicativo é a `verificar.html` da pasta da extensão.
- **Só em páginas de dinheiro** (3.6.0): avisos e análise só onde há compra, pagamento, Pix, promoção ou login que diz ser banco/gov.br. Bloqueio antes de abrir de golpe confirmado continua em qualquer site.
- **Loja sem CNPJ ativo é bloqueada** (3.6.0), com a mesma porcentagem na tela de bloqueio. **Loja estrangeira** (fora do .br, sem CNPJ, sem R$ nem português) também é bloqueada, com o aviso próprio "Esta é uma loja estrangeira" (3.7.0).
- **URLhaus fora do ar:** desde nov/2026 os downloads da lista respondem 410 (não existe mais nesse endereço). A extensão segue com Phishing.Database e Procon-SP. Decidir: tirar a fonte ou trocar pelo novo acesso do abuse.ch.
- **Pessoa de confiança**: os dados ficam só no computador; nada é enviado sozinho (abre o WhatsApp e a pessoa confirma).
- Segredos (senhas, chaves, `.env`, bancos de dados) **nunca** vão para o GitHub. O repositório é **público** desde 06/11/2026: tudo o que for enviado fica visível para qualquer pessoa, inclusive o histórico. Antes de cada commit, confira se não há dados pessoais nem chaves.
- A logo do Reclame Aqui (`icons/reclameaqui.png`) é marca registrada e fica visível no repositório público.

## 6. Ideias que ficaram para depois
- "Cadastre sua marca" (citado no pitch de 3 minutos).
- Levar o visual limpo também para a tela de boas-vindas e o popup.
- Frase-tese da indústria criativa no início do pitch de 3 minutos.
