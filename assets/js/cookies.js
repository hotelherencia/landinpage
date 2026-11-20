(function (root) {
  'use strict';

  const CLAVE_CONSENTIMIENTO = 'hh_consentimiento_cookies_v1';
  const VERSION_CONSENTIMIENTO = 1;

  function leerConsentimiento(almacen) {
    try {
      const crudo = almacen && almacen.getItem(CLAVE_CONSENTIMIENTO);
      if (!crudo) return null;
      const obj = JSON.parse(crudo);
      if (!obj || typeof obj !== 'object' || obj.version !== VERSION_CONSENTIMIENTO) return null;
      if (typeof obj.analitica !== 'boolean') return null;
      return {
        version: VERSION_CONSENTIMIENTO,
        esenciales: true,
        analitica: obj.analitica,
        decidido_en: typeof obj.decidido_en === 'string' ? obj.decidido_en : null,
      };
    } catch {
      return null;
    }
  }

  function guardarConsentimiento(almacen, analitica) {
    const registro = {
      version: VERSION_CONSENTIMIENTO,
      esenciales: true,
      analitica: Boolean(analitica),
      decidido_en: new Date().toISOString(),
    };
    try {
      if (almacen) almacen.setItem(CLAVE_CONSENTIMIENTO, JSON.stringify(registro));
    } catch {
      // Navegación privada o almacenamiento bloqueado: la elección vive en memoria de la sesión.
    }
    return registro;
  }

  function analiticaAutorizada(almacen) {
    const estado = leerConsentimiento(almacen);
    return Boolean(estado && estado.analitica === true);
  }

  function debeMostrarBanner(almacen) {
    return leerConsentimiento(almacen) === null;
  }

  function iniciarBannerCookies() {
    if (typeof document === 'undefined') return;
    const banner = document.getElementById('cookie-banner');
    if (!banner) return;
    if (typeof window !== 'undefined') window.__hhRequiereConsentimiento = true;
    let almacen = null;
    try {
      almacen = window.localStorage;
    } catch {
      almacen = null;
    }
    const panelConfig = banner.querySelector('[data-cookie-config]');
    const checkAnalitica = banner.querySelector('[data-cookie-analitica]');
    const btnAceptar = banner.querySelector('[data-cookie-aceptar]');
    const btnRechazar = banner.querySelector('[data-cookie-rechazar]');
    const btnConfig = banner.querySelector('[data-cookie-abrir-config]');
    const btnGuardar = banner.querySelector('[data-cookie-guardar]');

    function sincronizarEstado() {
      const actual = leerConsentimiento(almacen);
      window.__hhConsentimientoCookies = actual;
      if (checkAnalitica) {
        checkAnalitica.checked = Boolean(actual && actual.analitica);
      }
    }

    function cerrar() {
      banner.hidden = true;
      if (panelConfig) panelConfig.hidden = true;
    }

    function abrir() {
      sincronizarEstado();
      banner.hidden = false;
    }

    sincronizarEstado();
    if (debeMostrarBanner(almacen)) {
      abrir();
    }

    if (btnAceptar) {
      btnAceptar.addEventListener('click', () => {
        guardarConsentimiento(almacen, true);
        sincronizarEstado();
        cerrar();
      });
    }
    if (btnRechazar) {
      btnRechazar.addEventListener('click', () => {
        guardarConsentimiento(almacen, false);
        sincronizarEstado();
        cerrar();
      });
    }
    if (btnConfig && panelConfig) {
      btnConfig.addEventListener('click', () => {
        panelConfig.hidden = !panelConfig.hidden;
      });
    }
    if (btnGuardar) {
      btnGuardar.addEventListener('click', () => {
        guardarConsentimiento(almacen, Boolean(checkAnalitica && checkAnalitica.checked));
        sincronizarEstado();
        cerrar();
      });
    }

    document.querySelectorAll('[data-abrir-cookies]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        abrir();
      });
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', iniciarBannerCookies);
    } else {
      iniciarBannerCookies();
    }
  }

  const api = {
    CLAVE_CONSENTIMIENTO,
    leerConsentimiento,
    guardarConsentimiento,
    analiticaAutorizada,
    debeMostrarBanner,
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.HerenciaCookies = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
