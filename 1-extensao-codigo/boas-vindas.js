'use strict';

const $ = (id) => document.getElementById(id);
const P = self.EGolpePessoa;
const PADRAO = { limite: 3, consultaIdade: false, imagens: false, modoSimples: false, rigor: 'alto', perfis: [], vozAutomatica: false, daltonico: false };

// O que cada perfil liga. Combinações somam (ex.: idoso + daltônico).
const AJUSTES = {
  idoso: { modoSimples: true, vozAutomatica: true },
  cego: {},                                   // o leitor de tela já lê os avisos; voz própria fica desligada
  baixaVisao: { modoSimples: true },
  daltonico: { daltonico: true },
  leitura: { modoSimples: true, vozAutomatica: true },
  padrao: {}
};
const NOMES = { idoso: 'Idoso(a) ou com dificuldade com a internet', cego: 'Cego(a) ou usa leitor de tela', baixaVisao: 'Baixa visão',
  daltonico: 'Daltônico(a)', leitura: 'Dificuldade para ler', padrao: 'Sem ajustes' };

const lerConfig = async () => ({ ...PADRAO, ...((await chrome.storage.local.get('config')).config || {}) });
const salvarConfig = async (parte) => chrome.storage.local.set({ config: { ...(await lerConfig()), ...parte } });
const perfisMarcados = () => [...document.querySelectorAll('input[name=perfil]:checked')].map((i) => i.value);

function anunciar(t) { $('anuncio').textContent = ''; setTimeout(() => { $('anuncio').textContent = t; }, 50); }

function mostrar(n) {
  for (let i = 1; i <= 4; i++) $('passo' + i).hidden = i !== n;
  window.scrollTo(0, 0);
  $('t' + n).focus();
}

function aplicarTamanho() { document.body.classList.toggle('grande', $('modoSimples').checked); }

// "Não preciso de ajustes" desmarca os outros, e vice-versa.
document.querySelectorAll('input[name=perfil]').forEach((cx) => cx.addEventListener('change', () => {
  if (!cx.checked) return;
  document.querySelectorAll('input[name=perfil]').forEach((o) => {
    if (o !== cx && (cx.value === 'padrao' || o.value === 'padrao')) o.checked = false;
  });
  const grande = perfisMarcados().some((p) => AJUSTES[p].modoSimples);
  document.body.classList.toggle('grande', grande);
}));

function previa() {
  const nome = $('nome').value;
  $('previa').textContent = P.mensagem(nome, 'https://exemplo-de-site-suspeito.com/pagamento');
}

function lerPessoa() {
  return { nome: $('nome').value.trim(), telefone: $('telefone').value.trim(), email: $('email').value.trim() };
}

function validar(pessoa) {
  if (!pessoa.nome) return 'Escreva o nome da pessoa.';
  if (pessoa.telefone && !P.telefone(pessoa.telefone)) return 'O WhatsApp precisa ter DDD e número. Ex.: (11) 98765-4321.';
  if (pessoa.email && !P.emailValido(pessoa.email)) return 'O e-mail não parece certo. Ex.: maria@email.com.';
  if (!P.telefone(pessoa.telefone) && !P.emailValido(pessoa.email)) return 'Informe o WhatsApp ou o e-mail da pessoa.';
  return '';
}

function mostrarErro(t) {
  $('erro3').hidden = !t;
  $('erro3').textContent = t;
}

async function terminar() {
  const cfg = await lerConfig();
  const { pessoaConfianca } = await chrome.storage.local.get('pessoaConfianca');
  const itens = [];
  itens.push('Acessibilidade: ' + (cfg.perfis.length ? cfg.perfis.map((p) => NOMES[p]).join(', ') : NOMES.padrao) + '.');
  if (cfg.modoSimples) itens.push('Letras grandes e avisos simples: ligado.');
  if (cfg.vozAutomatica) itens.push('Leitura dos avisos em voz alta: ligada.');
  if (cfg.daltonico) itens.push('Cores para daltonismo: ligadas.');
  itens.push(P.valida(pessoaConfianca) ? 'Pessoa de confiança: ' + pessoaConfianca.nome + '.' : 'Pessoa de confiança: não cadastrada (dá para cadastrar depois no ícone da extensão).');
  $('resumo').replaceChildren(...itens.map((t) => Object.assign(document.createElement('li'), { textContent: t })));
  await chrome.storage.local.set({ boasVindasFeitas: true });
  mostrar(4);
  anunciar('Pronto! Você está protegido.');
}

async function iniciar() {
  const cfg = await lerConfig();
  const { pessoaConfianca } = await chrome.storage.local.get('pessoaConfianca');
  document.querySelectorAll('input[name=perfil]').forEach((cx) => { cx.checked = (cfg.perfis || []).includes(cx.value); });
  if (pessoaConfianca) {
    $('nome').value = pessoaConfianca.nome || '';
    $('telefone').value = pessoaConfianca.telefone || '';
    $('email').value = pessoaConfianca.email || '';
  }
  document.body.classList.toggle('grande', !!cfg.modoSimples);
  previa();

  $('ir2').addEventListener('click', async () => {
    const perfis = perfisMarcados();
    const sugestao = { modoSimples: false, vozAutomatica: false, daltonico: false };
    for (const p of perfis) Object.assign(sugestao, Object.fromEntries(Object.entries(AJUSTES[p]).filter(([, v]) => v)));
    const anteriores = cfg.perfis || [];
    const mudou = perfis.join() !== anteriores.join();
    // Mantém ajustes feitos à mão se a pessoa não mudou os perfis.
    $('modoSimples').checked = mudou ? sugestao.modoSimples : cfg.modoSimples;
    $('vozAutomatica').checked = mudou ? sugestao.vozAutomatica : cfg.vozAutomatica;
    $('daltonico').checked = mudou ? sugestao.daltonico : cfg.daltonico;
    await salvarConfig({ perfis: perfis.filter((p) => p !== 'padrao') });
    cfg.perfis = perfis.filter((p) => p !== 'padrao');
    aplicarTamanho();
    mostrar(2);
  });
  $('modoSimples').addEventListener('change', aplicarTamanho);
  $('volta1').addEventListener('click', () => mostrar(1));
  $('ir3').addEventListener('click', async () => {
    await salvarConfig({ modoSimples: $('modoSimples').checked, vozAutomatica: $('vozAutomatica').checked, daltonico: $('daltonico').checked });
    const idoso = perfisMarcados().includes('idoso');
    $('avisoIdoso').hidden = !idoso;
    $('pular').textContent = idoso ? 'Pular por enquanto (não recomendado)' : 'Pular por enquanto';
    mostrar(3);
  });
  $('volta2').addEventListener('click', () => mostrar(2));
  $('nome').addEventListener('input', previa);
  $('testar').addEventListener('click', () => {
    const pessoa = lerPessoa();
    const erro = validar(pessoa);
    mostrarErro(erro);
    if (erro) return;
    const link = P.linkWhats(pessoa, P.mensagemTeste(pessoa.nome)) || P.linkEmail(pessoa, P.mensagemTeste(pessoa.nome));
    window.open(link, '_blank', 'noopener');
  });
  $('salvar').addEventListener('click', async () => {
    const pessoa = lerPessoa();
    const erro = validar(pessoa);
    mostrarErro(erro);
    if (erro) return;                       // a mensagem de erro tem role="alert": o leitor de tela anuncia
    await chrome.storage.local.set({ pessoaConfianca: pessoa });
    terminar();
  });
  $('pular').addEventListener('click', terminar);
  $('mudar').addEventListener('click', () => mostrar(1));
  $('verBloqueio').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('bloqueado.html') + '?u=' + encodeURIComponent('https://nubank-atualizar-cadastro.xyz/login') });
  });
  $('t1').focus();
}

iniciar();
