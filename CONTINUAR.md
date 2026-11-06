# Como continuar o É Golpe? em outro computador

## 1. Baixar o projeto
```
git clone https://github.com/guilherme-paiva1999/--golpe-.git e-golpe
cd e-golpe
```
Precisa do Git e de estar logado no GitHub (`gh auth login`) para enviar mudanças.

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
```
Teste real num Google Chrome (abre um Chrome escondido com perfil temporário, precisa de internet):
```
cd teste-real
npm install
node testar.js
```
As capturas de tela ficam em `teste-real/capturas/` (não vão para o GitHub).

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
  que abre o Detector oficial. A logo veio do Wikimedia Commons (domínio público), mas é marca registrada: para uso comercial,
  pedir autorização.
- **Confiança em porcentagem**, aparece na hora (sem "carregando"). **Só é confiável com 90% ou mais** (rigor normal: 60% ou mais). Mudou de 80% para 90% na 3.3.0.
- **Aprendizado de máquina** só soma pontos, nunca bloqueia sozinho, e olha só o domínio principal (pega ~10% dos golpes com
  ~1% de falsos alertas; detalhes no README da extensão).
- **Visual** da tela de bloqueio e dos avisos: sóbrio e limpo (vermelho-escuro, octógono com X, "PERIGO", lista de motivos,
  três botões). O visual de "cartaz de campanha" da v3.1 foi descartado por estar poluído.
- **Aplicativo e extensão juntos** (3.4.0): o aplicativo confere o link antes de abrir; a extensão cuida das páginas. Um código só: o aplicativo é a `verificar.html` da pasta da extensão.
- **Pessoa de confiança**: os dados ficam só no computador; nada é enviado sozinho (abre o WhatsApp e a pessoa confirma).
- Segredos (senhas, chaves, `.env`, bancos de dados) **nunca** vão para o GitHub. O repositório é **privado**: no outro computador, entre com a sua conta (`gh auth login`) antes de clonar.

## 6. Ideias que ficaram para depois
- "Cadastre sua marca" (citado no pitch de 3 minutos).
- Levar o visual limpo também para a tela de boas-vindas e o popup.
- Frase-tese da indústria criativa no início do pitch de 3 minutos.
