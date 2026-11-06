'use strict';
/* Ponte entre a tela "Verificar um link" (verificar.html) e o núcleo da extensão (background.js).
   A mesma tela roda de dois jeitos:
   - DENTRO DA EXTENSÃO (aberta pelo popup): usa o armazenamento da extensão, então a pessoa de confiança,
     as notas do Reclame Aqui e as listas de golpes já baixadas são as mesmas.
   - COMO APLICATIVO (site instalável no celular): imita o armazenamento do Chrome com o do aparelho.
   Nos dois casos, os "ouvintes" do background.js (bloqueio de navegação, alarmes, mensagens) ficam desligados
   nesta tela: quem bloqueia páginas é só o service worker da extensão. */
(function () {
  const real = (typeof chrome !== 'undefined' && chrome && chrome.runtime && chrome.runtime.id && chrome.storage) ? chrome : null;
  const memoria = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
  const abrir = (nome) => { try { const s = window[nome]; s.setItem('eg:teste', '1'); return s; } catch (e) { return memoria(); } };
  const area = (store) => ({
    async get(chaves) {
      const saida = {};
      for (const k of (chaves == null ? [] : [].concat(chaves))) {
        try { const v = store.getItem('eg:' + k); if (v !== null) saida[k] = JSON.parse(v); } catch (e) { /* valor inválido */ }
      }
      return saida;
    },
    async set(obj) {
      for (const k of Object.keys(obj)) { try { store.setItem('eg:' + k, JSON.stringify(obj[k])); } catch (e) { /* sem espaço */ } }
    }
  });
  const evento = { addListener() {} };
  const nada = async () => {};
  window.EGolpeModo = real ? 'extensao' : 'aplicativo';
  window.EGolpeChromeReal = real;
  window.chrome = {
    runtime: { id: real ? real.runtime.id : 'aplicativo', onInstalled: evento, onStartup: evento, onMessage: evento,
      getURL: (p) => (real ? real.runtime.getURL(p) : p), getPlatformInfo() {} },
    alarms: { get: async () => ({}), create() {}, onAlarm: evento },
    webNavigation: { onBeforeNavigate: evento },
    storage: real ? real.storage : { local: area(abrir('localStorage')), session: area(abrir('sessionStorage')) },
    action: { setBadgeText: nada, setBadgeBackgroundColor: nada },
    tabs: { create: nada, update: nada, remove: nada, goBack: nada },
    permissions: { contains: async () => false },
    tts: null
  };
})();
