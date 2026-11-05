# É Golpe? v2

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
Phishing.Database e URLhaus (abuse.ch). Confira as licenças antes de publicar.

## Presunção de golpe (v2.3)
Todo site desconhecido começa suspeito e só deixa de ser quando prova o contrário. Sinais lidos na página
(só verdadeiro/falso sai da página): pede pagamento, mensagem de pressão, desconto exagerado, formulário
que envia a outro site, pede senha, sem CNPJ/contato. A **idade do domínio** (consultada só quando a
página mostra dinheiro, senha ou pressão) pesa muito: menos de 30 dias soma 35 pontos; mais de 1 ano
tira 20 e mais de 3 anos tira 30. Rigor "alto" (padrão) avisa a partir de 25 pontos e bloqueia a partir de 60.
Selo no ícone: ✓ provado, ? não verificado, ! atenção, X perigo.
Os botões "É golpe" e "É seguro" guardam os seus rótulos neste computador ("Baixar meus dados") para treinar um modelo depois.
Os pesos foram definidos à mão, **não treinados**; `ml/testar_pontuacao.js` testa só a lógica.

## Lojas precisam provar mais de 75 de 100 (v2.4)
Se a página vende ou pede pagamento, ela começa com 0 de confiança e precisa passar de **75**.
Provas: idade do domínio (3 anos +35, 1 ano +25, 6 meses +10), https +10, CNPJ com dígitos válidos +10,
contato +10 (+5 se o e-mail é do próprio site), políticas de trocas/privacidade/entrega +15, gateway de
pagamento conhecido +10. Sinais ruins tiram: site de menos de 30 dias −40, pressão −15, desconto exagerado −15,
formulário para outro site −20, hospedagem gratuita −15. Menos de 30 de confiança bloqueia; de 30 a 75 avisa.
**Hospedagem gratuita** (`vercel.app`, `blogspot.com`...) não prova idade: a idade seria a do serviço.
Os pesos foram definidos à mão. `ml/testar_confianca.js` testa só a lógica.

## Feed do OpenPhish
O `openphish.eu` não abre a partir deste ambiente, mas o feed público está espelhado no GitHub
(`openphish/public_feed`). Foi adicionado como fonte de golpes, atualizada a cada 6 horas.
Medido em 273 sites de golpe recentes: as regras pegam 1,1%; só 2,6% já estavam no Phishing.Database;
58,6% estão em hospedagem gratuita. Ou seja, o feed traz cobertura que as outras listas ainda não têm.
Confira os termos de uso do OpenPhish antes de publicar a extensão.

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
