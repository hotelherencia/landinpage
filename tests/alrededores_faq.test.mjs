import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const html = fs.readFileSync(path.resolve('index.html'), 'utf8');

test('index.html incluye bloque de Alrededores en Chillán y Región de Ñuble', () => {
  assert.match(html, /id="alrededores"/);
  assert.match(html, /Plaza de Armas y Catedral/);
  assert.match(html, /Termas y Nevados de Chillán/);
  assert.match(html, /Terminal María Teresa/);
});

test('index.html incluye buscador y chips de preguntas recomendadas sin alterar FAQ', () => {
  assert.match(html, /id="faq-buscar"/);
  assert.match(html, /data-faq-chip="llegada"/);
  assert.match(html, /data-faq-chip="desayuno"/);
  assert.match(html, /data-faq-chip="estacionamiento"/);
});
