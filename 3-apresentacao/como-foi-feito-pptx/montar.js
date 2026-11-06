// Monta o PowerPoint de apoio ao pitch "Isso é golpe?" no estilo da apresentação do Canva da equipe.
const pptxgen = require('pptxgenjs');
const fs = require('fs'), path = require('path');
const A = path.join(__dirname, 'ass');
const VIDEO = '/home/user/--golpe-/5-video/video-isso-e-golpe-40s.mp4';
const CAPA_VIDEO = path.join(__dirname, '..', 'video', 'still40.jpg');
const SAIDA = process.argv[2];
const W = 13.333, H = 7.5;
const F = 'Nunito';
const VERDE = 'B8F5B0', NEON = '5BE36A', AMARELO = 'F2C230', BRANCO = 'F2F7EE', SUAVE = 'C9D9C4';
const b64 = (f) => 'image/' + (f.endsWith('.png') ? 'png' : 'jpeg') + ';base64,' + fs.readFileSync(f).toString('base64');
const tam = (f) => { const b = fs.readFileSync(f); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.title = 'Isso é golpe? · Feira do Empreendedor';
pres.author = 'Equipe Isso é golpe?';
pres.theme = { headFontFace: F, bodyFontFace: F };

// Slide da equipe (feito no Canva), em tela cheia, sem nada por cima.
const daEquipe = (n, alt, notas, secao) => {
  const s = pres.addSlide({ sectionTitle: secao });
  s.addImage({ data: b64(path.join(A, `s-${n}.png`)), x: 0, y: 0, w: W, h: H, altText: alt });
  s.addNotes(notas);
  return s;
};
// Slide novo: mesmo fundo do Canva e título pixelado com brilho.
const novo = (titulo, notas, secao) => {
  const s = pres.addSlide({ sectionTitle: secao });
  s.background = { data: b64(path.join(A, 'fundo.jpg')) };
  const f = path.join(A, `t-${titulo}.png`), d = tam(f), h = 0.78, w = d.w / d.h * h;
  s.addImage({ data: b64(f), x: (W - w) / 2, y: 0.38, w, h, altText: '' });
  s.addNotes(notas);
  return s;
};
const painel = (s, x, y, w, h, cor = '3F8A3A', nome = 'painel') => s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
  x, y, w, h, rectRadius: 0.18, fill: { color: '0A240A', transparency: 18 }, line: { color: cor, width: 1.5 },
  shadow: { type: 'outer', color: NEON, blur: 14, offset: 0, angle: 0, opacity: 0.35 }, objectName: nome });
const texto = (s, t, o) => s.addText(t, { isTextBox: true, fontFace: F, color: BRANCO, margin: 0, valign: 'top', ...o });
const icone = (s, n, x, y, d = 0.62) => s.addImage({ data: b64(path.join(A, `i-${n}.png`)), x, y, w: d, h: d, altText: '' });
const clipe = (s, x, y) => s.addImage({ data: b64(path.join(A, 'clipe.png')), x, y, w: 0.62, h: 0.57, rotate: 8, altText: '' });

// 1. Capa (Canva)
pres.addSection({ title: 'Gancho' });
daEquipe(1, 'Capa: Isso é golpe, com triângulo de alerta e botão Start',
  'Você já olhou para um site e pensou: “isso é golpe?”\n\n[Pausa. Levante a mão.] Levanta a mão quem já pensou isso. [Pausa.]', 'Gancho');

// 2. Os números
{
  const s = novo('motivo', 'Essa dúvida tem motivo. Segundo o Anuário Brasileiro de Segurança Pública, o Brasil registrou 2 milhões e 261 mil casos de estelionato em 2025: quase 430% a mais do que em 2018. E, entre julho de 2024 e junho de 2025, 24 milhões de brasileiros foram vítimas de golpes com Pix ou boleto.\n\nQuem mais sofre? Segundo a Fundação Seade, 82% das pessoas com 60 anos ou mais em São Paulo já sofreram tentativas de golpe pela internet.', 'Gancho');
  const dados = [
    ['2,26 milhões', 'casos de estelionato no Brasil em 2025, quase 430% a mais que em 2018', VERDE, '3F8A3A'],
    ['24 milhões', 'de brasileiros vítimas de golpe com Pix ou boleto em um ano', VERDE, '3F8A3A'],
    ['82%', 'das pessoas com 60 anos ou mais em SP já sofreram tentativas de golpe pela internet', AMARELO, AMARELO]
  ];
  const w = 3.75, g = 0.42, x0 = (W - 3 * w - 2 * g) / 2;
  dados.forEach(([n, t, cor, borda], i) => {
    const x = x0 + i * (w + g);
    painel(s, x, 1.9, w, 3.3, borda, 'numero' + (i + 1));
    texto(s, n, { x: x + 0.3, y: 2.3, w: w - 0.6, h: 0.8, fontSize: 34, bold: true, color: cor });
    texto(s, t, { x: x + 0.3, y: 3.3, w: w - 0.6, h: 1.7, fontSize: 19, bold: true, color: BRANCO });
  });
  clipe(s, x0 + 2 * (w + g) + w - 0.45, 1.65);
  texto(s, 'Fontes: 20º Anuário Brasileiro de Segurança Pública (FBSP); pesquisa Datafolha com o FBSP (jul/2024 a jun/2025); Fundação Seade, série SP TIC (jul a set/2025).',
    { x: 0.8, y: 6.55, w: W - 1.6, h: 0.45, fontSize: 11, color: SUAVE, bold: false, align: 'center' });
}

// 3. Indústria criativa
{
  const s = novo('criativa', 'E a desconfiança machuca também quem vende de verdade. Na indústria criativa, o patrimônio é a marca, e é exatamente a marca que o golpista copia: a loja com as fotos roubadas de uma estilista, o ingresso falso de um show, o curso clonado de um professor.', 'Gancho');
  texto(s, [{ text: 'O patrimônio é a marca. ', options: { color: BRANCO } }, { text: 'E é a marca que o golpista copia.', options: { color: VERDE } }],
    { x: 1.2, y: 1.55, w: W - 2.4, h: 1.0, fontSize: 30, bold: true, align: 'center', valign: 'middle' });
  const ex = [['camiseta', 'A loja com as fotos roubadas de uma estilista'], ['ingresso', 'O ingresso falso de um show'], ['professor', 'O curso clonado de um professor']];
  const w = 3.6, g = 0.45, x0 = (W - 3 * w - 2 * g) / 2;
  ex.forEach(([ic, t], i) => {
    const x = x0 + i * (w + g);
    painel(s, x, 3.0, w, 3.1, '3F8A3A', 'exemplo' + (i + 1));
    icone(s, ic, x + (w - 0.9) / 2, 3.4, 0.9);
    texto(s, t, { x: x + 0.35, y: 4.55, w: w - 0.7, h: 1.3, fontSize: 20, bold: true, align: 'center' });
  });
  icone(s, 'alerta-am', W - 1.45, 0.4, 0.75);
}

// 4. Feira do Empreendedor (Canva)
pres.addSection({ title: 'Quem somos e o MVP' });
daEquipe(2, 'Feira do Empreendedor: fotos do evento FE26 e da equipe',
  'E foi pensando nessas pessoas que este projeto nasceu, aqui na Feira do Empreendedor.', 'Quem somos e o MVP');

// 5. Ícone (Canva)
daEquipe(3, 'Ícone do Isso é golpe: escudo verde com sinal de certo',
  'Por isso que eu, Guilherme, e meus colegas Ian, Arthur, Aghata, João e Rudá criamos o Isso é Golpe?…', 'Quem somos e o MVP');

// 6. Quem somos e a regra dos 90%
{
  const s = novo('quem', 'Por isso que eu, Guilherme, e meus colegas Ian, Arthur, Aghata, João e Rudá criamos o Isso é Golpe?: uma proteção que confere sites e links antes de você pagar, para ajudar quem compra pela internet, principalmente idosos e famílias, a não cair em golpe e a confiar nas lojas honestas.\n\nA regra é simples: todo site começa suspeito e só é confiável se provar, com 90% ou mais de confiança.', 'Quem somos e o MVP');
  s.addImage({ data: b64(path.join(A, 'escudo.png')), x: 0.85, y: 1.75, w: 3.6, h: 3.6, altText: 'Escudo verde do Isso é golpe' });
  texto(s, 'Guilherme, Ian, Arthur, Aghata, João e Rudá', { x: 4.9, y: 1.7, w: 7.6, h: 0.6, fontSize: 24, bold: true, color: VERDE });
  texto(s, 'Uma proteção que confere sites e links antes de você pagar, para quem compra pela internet, principalmente idosos e famílias.',
    { x: 4.9, y: 2.45, w: 7.6, h: 1.3, fontSize: 20, bold: true });
  painel(s, 4.9, 4.05, 7.6, 1.75, NEON, 'regra');
  texto(s, [{ text: 'Todo site começa suspeito. ', options: { color: BRANCO } }, { text: 'Só é confiável com 90% ou mais de confiança.', options: { color: AMARELO } }],
    { x: 5.25, y: 4.3, w: 6.9, h: 1.3, fontSize: 22, bold: true, valign: 'middle' });
}

// 7. E isso já funciona (vídeo de 40 s)
{
  const s = novo('funciona', 'E isso já funciona. [O vídeo começa ao clicar nele, ou sozinho no modo de apresentação. Fale por cima.]\n\nNa instalação, a pessoa escolhe como prefere usar: letras grandes, aviso em voz alta, leitor de tela ou cores para daltonismo.\n\nQuando ela abre uma loja, a gente consulta a Receita Federal: se a empresa existe, se está ativa, há quanto tempo existe e se é registrada para vender. Loja sem CNPJ é bloqueada antes de a pessoa digitar o cartão, com o motivo em palavras simples e um botão para perguntar para alguém de confiança pelo WhatsApp.', 'Quem somos e o MVP');
  const w = 9.6, h = 5.4, x = (W - w) / 2, y = 1.55;
  painel(s, x - 0.12, y - 0.12, w + 0.24, h + 0.24, NEON, 'moldura do vídeo');
  s.addMedia({ type: 'video', path: VIDEO, x, y, w, h, cover: b64(CAPA_VIDEO) });
}

// 8. Quem faz o quê (Canva)
pres.addSection({ title: 'Como funciona e negócio' });
daEquipe(5, 'Tabela quem faz o quê: aplicativo antes de abrir o link, extensão depois que a página abre',
  'São duas peças que trabalham juntas. No celular, o aplicativo confere o link antes de abrir. No computador, a extensão do Chrome age sozinha, só onde tem dinheiro: loja, Pix e pagamento.', 'Como funciona e negócio');

// 9. Diferencial
{
  const s = novo('alem', 'O Google e os antivírus avisam sobre vírus. A gente vai além: é feito para o Brasil, com Receita Federal, Pix, Procon e Reclame Aqui, e explica tudo em palavras simples.', 'Como funciona e negócio');
  texto(s, 'O Google e os antivírus avisam sobre vírus.', { x: 1.0, y: 1.45, w: W - 2.0, h: 0.6, fontSize: 24, bold: true, align: 'center', color: SUAVE });
  const itens = [['brasil', 'Feito para o Brasil', 'Receita Federal, Pix, Procon e Reclame Aqui'], ['conversa', 'Palavras simples', 'A confiança em porcentagem e o motivo, sem termo técnico']];
  const w = 5.5, g = 0.6, x0 = (W - 2 * w - g) / 2;
  itens.forEach(([ic, t, d], i) => {
    const x = x0 + i * (w + g);
    painel(s, x, 2.45, w, 3.5, NEON, 'diferencial' + (i + 1));
    icone(s, ic, x + 0.45, 2.9, 0.9);
    texto(s, t, { x: x + 0.45, y: 4.0, w: w - 0.9, h: 0.6, fontSize: 26, bold: true, color: VERDE });
    texto(s, d, { x: x + 0.45, y: 4.7, w: w - 0.9, h: 1.0, fontSize: 19, bold: true });
  });
  clipe(s, x0 + w - 0.5, 2.2);
}

// 10. Selo "Isso não é golpe"
{
  const s = novo('selo', 'E como a gente se sustenta? Com o selo “Isso não é golpe”. Para quem compra, é de graça. Quem paga é a loja honesta: o pequeno criador, a marca independente, que assina o selo para provar que é de verdade. Para ganhar o selo, a loja passa pela nossa verificação: CNPJ ativo, tempo de empresa, atividade registrada para vender e reputação. E o selo não se compra: se a loja deixar de cumprir as regras, perde o selo. O tamanho do problema mostra o tamanho do mercado: 24 milhões de vítimas em um único ano.', 'Como funciona e negócio');
  const c = [['gratis', 'De graça', 'para quem compra.', VERDE, '3F8A3A'], ['loja', 'A loja assina', 'O pequeno criador e a marca independente provam que são de verdade.', VERDE, NEON], ['proibido-am', 'Não se compra', 'CNPJ ativo, tempo de empresa, atividade e reputação. Saiu das regras, perde o selo.', AMARELO, AMARELO]];
  const w = 3.75, g = 0.42, x0 = (W - 3 * w - 2 * g) / 2;
  c.forEach(([ic, t, d, cor, borda], i) => {
    const x = x0 + i * (w + g);
    painel(s, x, 1.65, w, 3.55, borda, 'selo' + (i + 1));
    icone(s, ic, x + 0.4, 1.95, 0.75);
    texto(s, t, { x: x + 0.4, y: 2.9, w: w - 0.8, h: 0.6, fontSize: 24, bold: true, color: cor });
    texto(s, d, { x: x + 0.4, y: 3.55, w: w - 0.8, h: 1.6, fontSize: 17, bold: true });
  });
  texto(s, [{ text: 'O tamanho do mercado: ', options: { color: BRANCO } }, { text: '24 milhões de vítimas em um único ano.', options: { color: VERDE } }],
    { x: 0.8, y: 5.7, w: W - 1.6, h: 0.55, fontSize: 22, bold: true, align: 'center' });
  texto(s, 'Fonte: pesquisa Datafolha com o Fórum Brasileiro de Segurança Pública, jul/2024 a jun/2025.', { x: 0.8, y: 6.55, w: W - 1.6, h: 0.4, fontSize: 11, color: SUAVE, align: 'center' });
}

// 11. Conversa (validação) e 12. Menu de acessibilidade (Canva)
pres.addSection({ title: 'Validação e fechamento' });
daEquipe(6, 'Conversa com uma pessoa com deficiência visual: “Letras maiores e menos brilho na tela”',
  'A gente não fez isso sozinho. Conversamos com uma pessoa com deficiência visual para entender como ela usa a internet. O pedido dela foi direto: “letras maiores e menos brilho na tela”.', 'Validação e fechamento');
daEquipe(4, 'Proposta de interface do menu de acessibilidade, com a tela de boas-vindas da extensão',
  'Foi isso que orientou o nosso menu de acessibilidade.', 'Validação e fechamento');

// 13. Links e fechamento (fundo do slide Links do Canva)
{
  const s = daEquipe(7, 'Links', 'O próximo passo é lançar o selo “Isso não é golpe”, junto com o “Cadastre sua marca”: o criador registra o site oficial, e qualquer cópia dispara o alerta.\n\nNós somos o Isso é Golpe? e estamos mudando a forma como o brasileiro descobre se um site é golpe: antes de pagar, e não depois. Obrigado!', 'Validação e fechamento');
  texto(s, 'Próximo passo', { x: 1.7, y: 2.05, w: 9.5, h: 0.5, fontSize: 22, bold: true, color: AMARELO });
  texto(s, 'Lançar o selo “Isso não é golpe” e o “Cadastre sua marca”: o criador registra o site oficial, e qualquer cópia dispara o alerta.',
    { x: 1.7, y: 2.6, w: 9.4, h: 1.0, fontSize: 19, bold: true });
  texto(s, 'Código e extensão', { x: 1.7, y: 3.85, w: 9.5, h: 0.5, fontSize: 22, bold: true, color: VERDE });
  texto(s, [{ text: 'github.com/guilherme-paiva1999/--golpe-', options: { hyperlink: { url: 'https://github.com/guilherme-paiva1999/--golpe-' }, color: BRANCO } }],
    { x: 1.7, y: 4.4, w: 9.4, h: 0.5, fontSize: 19, bold: true });
  const f = path.join(A, 't-obrigado.png'), d = tam(f), h = 0.8, w = d.w / d.h * h;
  s.addImage({ data: b64(f), x: 11.4 - w, y: 5.45, w, h, altText: 'Obrigado!' });
}

pres.writeFile({ fileName: SAIDA }).then((f) => console.log('ok', f));
