import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const codigo = fs.readFileSync(path.resolve('assets/js/main.js'), 'utf8');

function cargarMain() {
  const ctx = {
    window: { addEventListener: () => {}, location: { origin: 'https://www.hotelherencia.cl', href: 'https://www.hotelherencia.cl/' } },
    document: { addEventListener: () => {}, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null },
    URL,
    URLSearchParams,
    console,
    setTimeout,
    clearTimeout,
  };
  vm.runInNewContext(codigo, ctx);
  return ctx;
}

test('formatearClp formatea montos chilenos con punto de miles', () => {
  const m = cargarMain();
  assert.equal(m.formatearClp(55000), '$55.000');
  assert.equal(m.formatearClp(47000), '$47.000');
  assert.equal(m.formatearClp(0), '');
});

test('actualizarPreciosTarjetas actualiza [data-precio-tipo] vía textContent sin tocar otros', () => {
  const m = cargarMain();
  const nodos = [
    { getAttribute: () => 'doble', textContent: 'fallback' },
    { getAttribute: () => 'matrimonial', textContent: 'fallback' },
  ];
  const doc = { querySelectorAll: () => nodos };
  const n = m.actualizarPreciosTarjetas([
    { tipo: 'doble', precio_base_clp: 55000 },
    { tipo: 'matrimonial', precio_base_clp: 58000 },
  ], doc);
  assert.equal(n, 2);
  assert.equal(nodos[0].textContent, 'Desde $55.000 / noche · IVA incl.');
  assert.equal(nodos[1].textContent, 'Desde $58.000 / noche · IVA incl.');
});
