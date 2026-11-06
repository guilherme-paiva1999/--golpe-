# É Golpe? · aplicativo do celular

O aplicativo e a extensão são **um produto só**, com um código só. O aplicativo é a tela
`verificar.html`, que fica dentro da pasta da extensão (`1-extensao-codigo/`).

## Quem faz o quê

| | Aplicativo (celular e computador) | Extensão do Chrome (computador) |
|---|---|---|
| Quando age | **Antes** de abrir o link | **Depois** que a página abre, em todos os sites |
| Como a pessoa usa | Cola o link ou toca em **Compartilhar → É Golpe?** no WhatsApp (Android) | Sozinha, sem a pessoa pedir |
| O que confere | O endereço: listas de golpes, imitação de banco ou do gov.br, aprendizado de máquina, idade do site, empresa na Receita, consumidor.gov.br, nota do Reclame Aqui | Tudo isso **e a página**: pressa, desconto exagerado, formulário para outro site, marca falsa em página de login, aviso na hora de pagar |
| Bloqueia sozinho | Não | Sim, antes de a página carregar |

No computador, a mesma tela abre pelo botão **"Verificar um link antes de abrir"** do popup da extensão. Ali ela usa os dados
da extensão: pessoa de confiança, notas do Reclame Aqui e listas de golpes já baixadas. Se a pessoa decidir abrir o site,
a extensão continua de olho na página.

## Testar no computador (sem a extensão)
```
cd 1-extensao-codigo
python3 -m http.server 8080
```
Abra `http://localhost:8080/verificar.html` e use o modo de celular do navegador (F12, ícone do celular).

## Endereço do aplicativo
**https://guilherme-paiva1999.github.io/--golpe-/**

Publicado pelo GitHub Pages com a automação `.github/workflows/publicar-aplicativo.yml`: a cada envio para a `main` que mude
`1-extensao-codigo/`, o site é atualizado sozinho em 1 a 2 minutos (acompanhe em **Actions** no GitHub).
Só vão os arquivos do aplicativo; as páginas de teste ficam de fora, porque imitam logins falsos e poderiam ser marcadas como golpe.

Para ligar (uma vez só): **Settings › Pages › Build and deployment › Source: GitHub Actions**. Depois, em **Actions ›
Publicar aplicativo › Run workflow**, publique a primeira vez.

## Instalar no celular
- **Android:** abra no Chrome, toque nos três pontinhos e em **Instalar aplicativo**. Depois disso, o **É Golpe?** aparece no Compartilhar do WhatsApp.
- **iPhone:** abra no Safari, toque em Compartilhar e em **Adicionar à Tela de Início**. No iPhone não há "Compartilhar com": copie o link e toque em **Colar**.

## Como a conta é feita no aplicativo
O aplicativo não vê a página, só o link. Um link desconhecido **começa em 50%**, perde os pontos de risco do endereço e depois
ganha ou perde com as provas, com os mesmos pesos da tela de bloqueio. Confiável só com **90% ou mais**.
O ponto de partida de 50% foi escolhido para o protótipo, não medido.

## Pontos em aberto
- **Consultas pela internet no celular:** a BrasilAPI e a lista do Phishing.Database permitem consulta de dentro de um site (conferido).
  A idade do site (RDAP) e as listas do URLhaus e do Procon-SP não puderam ser conferidas, porque a rede do ambiente de testes
  bloqueia esses endereços. Se não funcionarem no celular, o aplicativo segue sem elas; a solução é um servidor pequeno.
  Dentro da extensão, todas funcionam normalmente.
- A primeira abertura no celular baixa a lista do Phishing.Database (cerca de 11 MB). Depois fica guardada e atualiza uma vez por dia.
- O celular e o computador **não trocam dados entre si** (pessoa de confiança, notas do Reclame Aqui). Para isso seria preciso
  uma conta de usuário e um servidor.
