// Pruebas del proxy /api/publico/leads (Vercel Function). Ejecutar: node --test tests/
// No hace llamadas de red: fetch se reemplaza por un doble controlado.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';

const require = createRequire(import.meta.url);
const handler = require('../api/publico/leads.js');

const DESTINO = 'https://servicio-production-a2d7.up.railway.app/publico/leads';
const SITEVERIFY = 'https://www.google.com/recaptcha/api/siteverify';
const fetchOriginal = globalThis.fetch;
const entornoOriginal = { ...process.env };

function peticion({ method = 'POST', headers = {}, body = '{"nombre":"x"}' } = {}) {
    const req = Readable.from([Buffer.from(body)]);
    req.method = method;
    req.headers = headers;
    return req;
}

function respuesta() {
    return {
        statusCode: 0,
        headers: {},
        body: undefined,
        status(code) { this.statusCode = code; return this; },
        json(obj) { this.body = obj; return this; },
        send(texto) { this.body = texto; return this; },
        setHeader(k, v) { this.headers[k.toLowerCase()] = v; }
    };
}

function verificacion(sobre = {}) {
    return {
        success: true,
        action: 'consulta',
        hostname: 'www.hotelherencia.cl',
        challenge_ts: new Date().toISOString(),
        score: 0.9,
        ...sobre
    };
}

let llamadas;

function simularFetch({ siteverify = verificacion(), destino = { status: 201, body: '{"referencia":"abc"}' }, falloDestino = false } = {}) {
    llamadas = [];
    globalThis.fetch = async (url, opciones) => {
        llamadas.push({ url, opciones });
        if (url === SITEVERIFY) {
            return new Response(JSON.stringify(siteverify), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        if (url === DESTINO) {
            if (falloDestino) {
                throw new Error('red');
            }
            return new Response(destino.body, { status: destino.status, headers: { 'content-type': 'application/json' } });
        }
        throw new Error(`URL inesperada: ${url}`);
    };
}

const cabecerasValidas = { 'idempotency-key': 'clave-123', 'x-recaptcha-token': 't'.repeat(40) };

beforeEach(() => {
    process.env.RECAPTCHA_SECRET_KEY = 'secreto-de-prueba';
    delete process.env.RECAPTCHA_MIN_SCORE;
    delete process.env.RECAPTCHA_HOSTNAMES;
    simularFetch();
});

afterEach(() => {
    globalThis.fetch = fetchOriginal;
    process.env = { ...entornoOriginal };
});

test('rechaza métodos distintos de POST con 405 y Allow', async () => {
    const res = respuesta();
    await handler(peticion({ method: 'GET' }), res);
    assert.equal(res.statusCode, 405);
    assert.equal(res.headers.allow, 'POST');
    assert.equal(llamadas.length, 0);
});

test('exige Idempotency-Key (422)', async () => {
    const res = respuesta();
    await handler(peticion({ headers: { 'x-recaptcha-token': 't'.repeat(40) } }), res);
    assert.equal(res.statusCode, 422);
    assert.equal(llamadas.length, 0);
});

test('rechaza cuerpos de más de 8 KB (413)', async () => {
    const res = respuesta();
    await handler(peticion({ headers: cabecerasValidas, body: 'x'.repeat(9000) }), res);
    assert.equal(res.statusCode, 413);
    assert.equal(llamadas.length, 0);
});

test('sin secreto configurado responde 503 y no llama a nadie', async () => {
    delete process.env.RECAPTCHA_SECRET_KEY;
    const res = respuesta();
    await handler(peticion({ headers: cabecerasValidas }), res);
    assert.equal(res.statusCode, 503);
    assert.equal(llamadas.length, 0);
});

test('sin token de reCAPTCHA responde 403 y no reenvía', async () => {
    const res = respuesta();
    await handler(peticion({ headers: { 'idempotency-key': 'clave-123' } }), res);
    assert.equal(res.statusCode, 403);
    assert.equal(llamadas.length, 0);
});

for (const [caso, sobre] of [
    ['success=false', { success: false }],
    ['acción distinta', { action: 'login' }],
    ['hostname ajeno', { hostname: 'evil.example' }],
    ['token antiguo (>120 s)', { challenge_ts: new Date(Date.now() - 300000).toISOString() }]
]) {
    test(`verificación inválida (${caso}) → 403 sin llegar a DESTINO`, async () => {
        simularFetch({ siteverify: verificacion(sobre) });
        const res = respuesta();
        await handler(peticion({ headers: cabecerasValidas }), res);
        assert.equal(res.statusCode, 403);
        assert.deepEqual(llamadas.map((l) => l.url), [SITEVERIFY]);
    });
}

test('puntaje bajo el mínimo configurado → 403', async () => {
    process.env.RECAPTCHA_MIN_SCORE = '0.5';
    simularFetch({ siteverify: verificacion({ score: 0.1 }) });
    const res = respuesta();
    await handler(peticion({ headers: cabecerasValidas }), res);
    assert.equal(res.statusCode, 403);
});

for (const hostname of ['hotelherencia.cl', 'www.hotelherencia.cl']) {
    test(`verificación válida desde ${hostname} reenvía a DESTINO y devuelve su respuesta`, async () => {
        simularFetch({ siteverify: verificacion({ hostname }) });
        const res = respuesta();
        await handler(peticion({ headers: cabecerasValidas }), res);
        assert.equal(res.statusCode, 201);
        assert.equal(res.body, '{"referencia":"abc"}');
        assert.equal(res.headers['cache-control'], 'no-store');
        const destino = llamadas.find((l) => l.url === DESTINO);
        assert.ok(destino, 'debe llamar a DESTINO');
        assert.equal(destino.opciones.headers['Idempotency-Key'], 'clave-123');
        assert.equal(destino.opciones.redirect, 'error');
    });
}

test('el secreto viaja solo a siteverify, nunca a DESTINO', async () => {
    const res = respuesta();
    await handler(peticion({ headers: cabecerasValidas }), res);
    const destino = llamadas.find((l) => l.url === DESTINO);
    assert.ok(!JSON.stringify(destino.opciones).includes('secreto-de-prueba'));
});

test('falla de red hacia DESTINO → 502 genérico', async () => {
    simularFetch({ falloDestino: true });
    const res = respuesta();
    await handler(peticion({ headers: cabecerasValidas }), res);
    assert.equal(res.statusCode, 502);
    assert.deepEqual(res.body, { detail: 'no se pudo enviar' });
});
