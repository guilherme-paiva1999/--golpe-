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
