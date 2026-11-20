import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  CLAVE_CONSENTIMIENTO,
  leerConsentimiento,
  guardarConsentimiento,
  analiticaAutorizada,
  debeMostrarBanner,
} = require('../assets/js/cookies.js');

function crearAlmacen() {
  const mapa = new Map();
  return {
    getItem: (k) => (mapa.has(k) ? mapa.get(k) : null),
    setItem: (k, v) => mapa.set(k, String(v)),
  };
}

test('primera visita muestra el banner y bloquea analítica por defecto', () => {
  const almacen = crearAlmacen();
  assert.equal(debeMostrarBanner(almacen), true);
  assert.equal(analiticaAutorizada(almacen), false);
  assert.equal(leerConsentimiento(almacen), null);
});

test('rechazar (solo esenciales) oculta el banner y mantiene analítica desactivada', () => {
  const almacen = crearAlmacen();
  guardarConsentimiento(almacen, false);
  assert.equal(debeMostrarBanner(almacen), false);
  assert.equal(analiticaAutorizada(almacen), false);
  assert.equal(leerConsentimiento(almacen).esenciales, true);
});

test('aceptar todas oculta el banner y habilita analítica', () => {
  const almacen = crearAlmacen();
  guardarConsentimiento(almacen, true);
  assert.equal(debeMostrarBanner(almacen), false);
  assert.equal(analiticaAutorizada(almacen), true);
});

test('valor corrupto en almacenamiento vuelve a pedir consentimiento sin habilitar analítica', () => {
  const almacen = crearAlmacen();
  almacen.setItem(CLAVE_CONSENTIMIENTO, '{corrupto');
  assert.equal(debeMostrarBanner(almacen), true);
  assert.equal(analiticaAutorizada(almacen), false);
});
