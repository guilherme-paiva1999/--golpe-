'use strict';
/* Ponte entre o aplicativo e o núcleo da extensão (nucleo/background.js).
   O núcleo foi escrito para o Chrome e usa "chrome.storage", "chrome.runtime" etc.
   Aqui essas funções são imitadas com o armazenamento do próprio aparelho (localStorage),
   para que o aplicativo use exatamente as mesmas regras, listas, pesos e modelo da extensão.
   Nada sai do aparelho além das consultas que a extensão já faz (listas, RDAP, BrasilAPI). */
(function () {
  const memoria = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
  const abrir = (nome) => { try { const s = window[nome]; s.setItem('eg:teste', '1'); return s; } catch (e) { return memoria(); } };
  const area = (store) => ({
    async get(chaves) {
      const lista = chaves == null ? [] : [].concat(chaves);
      const saida = {};
      for (const k of lista) {
        try { const v = store.getItem('eg:' + k); if (v !== null) saida[k] = JSON.parse(v); } catch (e) { /* valor inválido: ignora */ }
      }
      return saida;
    },
    async set(obj) {
      for (const k of Object.keys(obj)) { try { store.setItem('eg:' + k, JSON.stringify(obj[k])); } catch (e) { /* sem espaço: segue */ } }
    }
  });
  const evento = { addListener() {} };
  const nada = async () => {};
  window.chrome = {
    runtime: { id: 'aplicativo', onInstalled: evento, onStartup: evento, onMessage: evento,
      getURL: (p) => 'nucleo/' + p, getPlatformInfo() {} },
    alarms: { get: async () => ({}), create() {}, onAlarm: evento },
    webNavigation: { onBeforeNavigate: evento },
    storage: { local: area(abrir('localStorage')), session: area(abrir('sessionStorage')) },
    action: { setBadgeText: nada, setBadgeBackgroundColor: nada },
    tabs: { create: nada, update: nada, remove: nada, goBack: nada },
    permissions: { contains: async () => false },
    tts: null
  };
})();
