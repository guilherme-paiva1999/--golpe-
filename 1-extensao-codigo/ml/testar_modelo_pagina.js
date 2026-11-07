// Paridade: o JavaScript da extensão (modelo-pagina.js) dá a mesma probabilidade que o Python do treino?
// Uso: node ml/testar_modelo_pagina.js
const fs = require('fs'), path = require('path');
global.alfTexto = require('../alfabetos.js').alfTexto;   // v3.13
const M = require('../modelo-pagina.js');
M.carregarModeloPagina(JSON.parse(fs.readFileSync(path.join(__dirname, 'modelo-pagina.json'), 'utf8')));
const am = JSON.parse(fs.readFileSync(path.join(__dirname, 'amostras-pagina.json'), 'utf8'));
let iguais = 0, pior = 0;
for (const a of am) {
  const p = M.probGolpeTexto(a.texto, a.x);
  const d = Math.abs(p - a.p); pior = Math.max(pior, d);
  if (d < 1e-6) iguais++; else console.log('diferente:', a.p.toFixed(6), p.toFixed(6), JSON.stringify(a.texto.slice(0, 60)));
}
console.log(iguais + '/' + am.length + ' iguais (maior diferença ' + pior.toExponential(1) + ')');
process.exit(iguais === am.length ? 0 : 1);
