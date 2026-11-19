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

const CUERPO_VALIDO = { nombre: 'Ana Pérez', correo: 'ana@example.com', telefono: '+56 9 1234 5678', huespedes: 2, check_in: null, check_out: null, mensaje: null };

function peticion({ method = 'POST', headers = {}, body = JSON.stringify(CUERPO_VALIDO) } = {}) {
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
            return new Response(destino.body, { status: destino.status, headers: { 'content-type': destino.tipo || 'application/json' } });
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

test('reenvía a la plataforma un token de reCAPTCHA propio (Google acepta cada token una sola vez)', async () => {
    const res = respuesta();
    await handler(peticion({ headers: { ...cabecerasValidas, 'x-recaptcha-token-servicio': 's'.repeat(40) } }), res);
    assert.equal(res.statusCode, 201);
    const verificado = new URLSearchParams(llamadas.find((l) => l.url === SITEVERIFY).opciones.body).get('response');
    const destino = llamadas.find((l) => l.url === DESTINO);
    assert.equal(verificado, 't'.repeat(40));
    assert.equal(destino.opciones.headers['X-Recaptcha-Token'], 's'.repeat(40), 'el token ya gastado no se reenvía');
});

test('propaga un X-Request-Id válido y genera uno si llega inválido', async () => {
    let res = respuesta();
    await handler(peticion({ headers: { ...cabecerasValidas, 'x-request-id': 'landing-abc.123' } }), res);
    assert.equal(res.headers['x-request-id'], 'landing-abc.123');
    assert.equal(llamadas.find((l) => l.url === DESTINO).opciones.headers['X-Request-Id'], 'landing-abc.123');
    simularFetch();
    res = respuesta();
    await handler(peticion({ headers: { ...cabecerasValidas, 'x-request-id': 'x\r\nSet-Cookie: a=b' } }), res);
    assert.match(res.headers['x-request-id'], /^[a-f0-9]{16}$/);
});

test('normaliza el cuerpo: NFC, sin controles ni marcas bidi, correo en minúsculas; SQLi y HTML viajan como texto', async () => {
    const res = respuesta();
    const cuerpo = {
        ...CUERPO_VALIDO,
        nombre: "  Jose\u0301 \u202Eevil\u0000 Robert'); DROP TABLE leads;--  ",
        correo: 'Ana@Example.COM',
        mensaje: '<script>alert(1)</script>\r\nhola'
    };
    await handler(peticion({ headers: cabecerasValidas, body: JSON.stringify(cuerpo) }), res);
    assert.equal(res.statusCode, 201);
    const enviado = JSON.parse(llamadas.find((l) => l.url === DESTINO).opciones.body);
    assert.equal(enviado.nombre, "José evil Robert'); DROP TABLE leads;--");
    assert.equal(enviado.correo, 'ana@example.com');
    assert.equal(enviado.mensaje, '<script>alert(1)</script>\nhola');
});

for (const [caso, cambio] of [
    ['clave no permitida', { __proto__x: 1, admin: true }],
    ['nombre de 201 caracteres', { nombre: 'a'.repeat(201) }],
    ['nombre no texto', { nombre: { $ne: '' } }],
    ['correo con espacio', { correo: 'a b@c.cl' }],
    ['teléfono con letras', { telefono: '+56 9 1234 abcd' }],
    ['teléfono con HTML', { telefono: '<b>912345678</b>' }],
    ['huéspedes 0', { huespedes: 0 }],
    ['huéspedes 31', { huespedes: 31 }],
    ['huéspedes texto', { huespedes: '2' }],
    ['fecha imposible', { check_in: '2030-02-30', check_out: '2030-03-02' }],
    ['XSS en fecha', { check_in: '<img src=x onerror=alert(1)>', check_out: '2030-03-02' }],
    ['salida antes de llegada', { check_in: '2030-03-05', check_out: '2030-03-02' }],
    ['más de 30 noches', { check_in: '2030-03-01', check_out: '2030-04-15' }],
    ['solo una fecha', { check_in: '2030-03-01' }],
    ['mensaje de 2001', { mensaje: 'x'.repeat(2001) }]
]) {
    test(`entrada inválida (${caso}) → 422 sin gastar reCAPTCHA ni llegar a DESTINO`, async () => {
        const res = respuesta();
        await handler(peticion({ headers: cabecerasValidas, body: JSON.stringify({ ...CUERPO_VALIDO, ...cambio }) }), res);
        assert.equal(res.statusCode, 422);
        assert.equal(llamadas.length, 0);
    });
}

test('cuerpo que no es JSON u objeto → 422', async () => {
    for (const body of ['no-json', '[1,2]', 'null', '"texto"']) {
        simularFetch();
        const res = respuesta();
        await handler(peticion({ headers: cabecerasValidas, body }), res);
        assert.equal(res.statusCode, 422, body);
    }
});

test('el log estructurado no contiene datos personales, tokens ni secreto', async () => {
    const lineas = [];
    const original = console.log;
    console.log = (l) => lineas.push(l);
    try {
        const res = respuesta();
        await handler(peticion({ headers: { ...cabecerasValidas, 'x-recaptcha-token-servicio': 's'.repeat(40) } }), res);
    } finally {
        console.log = original;
    }
    assert.equal(lineas.length, 1);
    const evento = JSON.parse(lineas[0]);
    assert.equal(evento.estado, 201);
    assert.equal(evento.resultado, 'ok');
    assert.equal(typeof evento.ms, 'number');
    for (const prohibido of ['Ana', 'ana@example.com', '1234', 'tttt', 'ssss', 'secreto-de-prueba']) {
        assert.ok(!lineas[0].includes(prohibido), prohibido);
    }
});

async function conLog(fn) {
    const lineas = [];
    const original = console.log;
    console.log = (l) => lineas.push(l);
    try {
        await fn();
    } finally {
        console.log = original;
    }
    return lineas;
}

// Regresión fix-e2e: en producción el proxy respondía 403 sin dejar la causa en el log.
test('un rechazo de Google deja motivo y códigos en el log, sin token ni secreto', async () => {
    simularFetch({ siteverify: { success: false, 'error-codes': ['invalid-input-secret'] } });
    const res = respuesta();
    const lineas = await conLog(() => handler(peticion({ headers: cabecerasValidas }), res));
    assert.equal(res.statusCode, 403);
    const evento = JSON.parse(lineas[0]);
    assert.equal(evento.resultado, 'recaptcha_rechazado');
    assert.equal(evento.motivo, 'success_false');
    assert.deepEqual(evento.recaptcha.codigos, ['invalid-input-secret']);
    for (const prohibido of ['tttt', 'secreto-de-prueba']) {
        assert.ok(!lineas[0].includes(prohibido), prohibido);
    }
});

for (const [caso, sobre, motivo] of [
    ['acción distinta', { action: 'login' }, 'accion_distinta'],
    ['hostname ajeno', { hostname: 'evil.example' }, 'host_no_permitido'],
    ['token antiguo', { challenge_ts: new Date(Date.now() - 300000).toISOString() }, 'token_vencido']
]) {
    test(`motivo en el log: ${caso}`, async () => {
        simularFetch({ siteverify: verificacion(sobre) });
        const res = respuesta();
        const lineas = await conLog(() => handler(peticion({ headers: cabecerasValidas }), res));
        assert.equal(JSON.parse(lineas[0]).motivo, motivo);
    });
}

test('puntaje bajo queda registrado con el puntaje recibido', async () => {
    process.env.RECAPTCHA_MIN_SCORE = '0.7';
    simularFetch({ siteverify: verificacion({ score: 0.3 }) });
    const res = respuesta();
    const lineas = await conLog(() => handler(peticion({ headers: cabecerasValidas }), res));
    const evento = JSON.parse(lineas[0]);
    assert.equal(evento.motivo, 'puntaje_bajo');
    assert.equal(evento.recaptcha.puntaje, 0.3);
});

test('RECAPTCHA_MIN_SCORE con coma decimal ("0,5") se entiende como 0.5', async () => {
    process.env.RECAPTCHA_MIN_SCORE = '0,5';
    simularFetch({ siteverify: verificacion({ score: 0.9 }) });
    const res = respuesta();
    await handler(peticion({ headers: cabecerasValidas }), res);
    assert.equal(res.statusCode, 201);
});

test('RECAPTCHA_MIN_SCORE ilegible ya no rechaza todo: usa 0.5 y lo avisa en el log', async () => {
    process.env.RECAPTCHA_MIN_SCORE = 'alto';
    simularFetch({ siteverify: verificacion({ score: 0.9 }) });
    const res = respuesta();
    const lineas = await conLog(() => handler(peticion({ headers: cabecerasValidas }), res));
    assert.equal(res.statusCode, 201);
    assert.equal(JSON.parse(lineas[0]).min_score_invalido, true);

    simularFetch({ siteverify: verificacion({ score: 0.2 }) });
    const res2 = respuesta();
    await handler(peticion({ headers: cabecerasValidas }), res2);
    assert.equal(res2.statusCode, 403);
});

test('503 de la plataforma se reenvía y queda como destino_503 en el log', async () => {
    simularFetch({ destino: { status: 503, body: '{"detail":"x"}' } });
    const res = respuesta();
    const lineas = await conLog(() => handler(peticion({ headers: cabecerasValidas }), res));
    assert.equal(res.statusCode, 503);
    assert.equal(JSON.parse(lineas[0]).resultado, 'destino_503');
});

// SA-LND-01: la respuesta se sirve en el origen de la landing; solo se reenvía JSON con tipo fijo.
test('la respuesta reenviada siempre sale como JSON con nosniff', async () => {
    simularFetch({ destino: { status: 201, body: '{"referencia":"abc"}', tipo: 'application/json; charset=utf-8' } });
    const res = respuesta();
    await handler(peticion({ headers: cabecerasValidas }), res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.body, '{"referencia":"abc"}');
});

test('una respuesta HTML del destino no se refleja: 502 genérico', async () => {
    simularFetch({ destino: { status: 502, body: '<html><script>alert(1)</script></html>', tipo: 'text/html' } });
    const res = respuesta();
    const lineas = await conLog(() => handler(peticion({ headers: cabecerasValidas }), res));
    assert.equal(res.statusCode, 502);
    assert.deepEqual(res.body, { detail: 'no se pudo enviar' });
    assert.notEqual(res.headers['content-type'], 'text/html');
    assert.equal(JSON.parse(lineas[0]).resultado, 'destino_no_json_502');
});

test('JSON declarado pero ilegible tampoco se refleja', async () => {
    simularFetch({ destino: { status: 200, body: '<b>no json</b>' } });
    const res = respuesta();
    await handler(peticion({ headers: cabecerasValidas }), res);
    assert.equal(res.statusCode, 502);
    assert.deepEqual(res.body, { detail: 'no se pudo enviar' });
});
