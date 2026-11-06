'use strict';
/* Pessoa de confiança: monta a mensagem "isso é golpe?" com o link do site.
   Usado pela tela de bloqueio, pelos avisos nas páginas e pela tela de boas-vindas.
   Nada é enviado sozinho: abre o WhatsApp (ou o e-mail) com a mensagem pronta e a pessoa decide enviar.
   Os dados ficam só neste computador (chrome.storage.local, chave "pessoaConfianca"). */
self.EGolpePessoa = {
  // Telefone brasileiro com DDD -> formato internacional só com números (55 + DDD + número).
  telefone(tel) {
    let d = String(tel || '').replace(/\D/g, '');
    if (d.startsWith('00')) d = d.slice(2);
    if (d.length === 10 || d.length === 11) d = '55' + d;
    return d.startsWith('55') && d.length >= 12 && d.length <= 13 ? d : '';
  },
  emailValido(e) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || '').trim());
  },
  primeiroNome(nome) {
    return String(nome || '').trim().split(/\s+/)[0] || '';
  },
  mensagem(nome, url) {
    const n = this.primeiroNome(nome);
    return 'Oi' + (n ? ', ' + n : '') + '! O É Golpe? bloqueou um site que eu tentei abrir e eu fiquei na dúvida. ' +
      'Você pode ver para mim se isso é golpe?\n\n' + url + '\n\n' +
      '(Cuidado ao abrir: se puder, confira antes no Reclame Aqui.)';
  },
  mensagemTeste(nome) {
    const n = this.primeiroNome(nome);
    return 'Oi' + (n ? ', ' + n : '') + '! Coloquei você como minha pessoa de confiança no É Golpe?, ' +
      'uma extensão que avisa sobre sites de golpe. Se eu achar um site suspeito, vou te mandar o link para você me ajudar a ver se é golpe.';
  },
  linkWhats(pessoa, texto) {
    const tel = this.telefone(pessoa && pessoa.telefone);
    return tel ? 'https://wa.me/' + tel + '?text=' + encodeURIComponent(texto) : '';
  },
  linkEmail(pessoa, texto) {
    if (!pessoa || !this.emailValido(pessoa.email)) return '';
    return 'mailto:' + encodeURIComponent(pessoa.email.trim()) + '?subject=' + encodeURIComponent('Isso é golpe?') +
      '&body=' + encodeURIComponent(texto);
  },
  valida(pessoa) {
    return !!(pessoa && String(pessoa.nome || '').trim() && (this.telefone(pessoa.telefone) || this.emailValido(pessoa.email)));
  }
};
