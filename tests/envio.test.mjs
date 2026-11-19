// Envío de la consulta desde el navegador (assets/js/main.js): tokens frescos al enviar, un
// reintento automático ante red caída o 502/503/504 con la misma Idempotency-Key, y mensajes
// específicos con código de referencia. Sin red: fetch y grecaptcha son dobles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const codigo = readFileSync(new URL('../assets/js/main.js', import.meta.url), 'utf8');
const CUERPO = { nombre: 'PRUEBA G', correo: 'p@example.com', telefono: '+56 9 1111 2222', huespedes: 2, check_in: null, check_out: null, mensaje: null };

function cargar({ respuestas = [], grecaptcha = true } = {}) {
    const scripts = [];
    const llamadas = [];
    let emitidos = 0;
    const contexto = {
        document: {
            readyState: 'loading',
            querySelector: (sel) => (sel === 'script[data-recaptcha]' ? scripts.find((s) => !s.quitado) || null : null),
            querySelectorAll: () => [],
            addEventListener: () => {},
            head: { append(s) { scripts.push(s); } },
            createElement: () => {
                const s = { dataset: {}, quitado: false };
                s.remove = () => { s.quitado = true; };
                return s;
            }
        },
        Element: class {},
        crypto: globalThis.crypto,
        URL,
        URLSearchParams,
        Promise,
        AbortSignal,
        IntersectionObserver: class { observe() {} },
        setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms, 5)),
        clearTimeout,
        setInterval: (fn) => setInterval(fn, 5),
        clearInterval,
        addEventListener: () => {},
        removeEventListener: () => {},
        location: { assign() {} },
        console
    };
    contexto.window = contexto;
    if (grecaptcha) {
        contexto.grecaptcha = {
            ready: (fn) => fn(),
            execute: async (_clave, { action }) => { emitidos += 1; return `token-${action}-${emitidos}-${'x'.repeat(30)}`; }
        };
    }
    let n = 0;
    contexto.fetch = async (url, opciones) => {
        llamadas.push({ url, opciones });
        const paso = respuestas[Math.min(n, respuestas.length - 1)];
        n += 1;
        if (paso === 'red') {
            throw new TypeError('NetworkError when attempting to fetch resource.');
        }
        return { status: paso.status, json: async () => paso.json || {} };
    };
    vm.createContext(contexto);
    vm.runInContext(codigo, contexto);
    return { ctx: contexto, llamadas, scripts };
}

test('red caída en el primer intento: reintenta solo, con tokens NUEVOS y la misma Idempotency-Key', async () => {
    const { ctx, llamadas } = cargar({ respuestas: ['red', { status: 201, json: { referencia: 'r' } }] });
    const r = await ctx.enviarConsulta('/api', CUERPO);
    assert.equal(r.tipo, 'respuesta');
    assert.equal(r.estado, 201);
    assert.equal(llamadas.length, 2);
    const [a, b] = llamadas.map((l) => l.opciones.headers);
    assert.equal(a['Idempotency-Key'], b['Idempotency-Key']);
    assert.equal(a['X-Request-Id'], `${r.codigo}-1`);
    assert.equal(b['X-Request-Id'], `${r.codigo}-2`);
    const tokens = [a['X-Recaptcha-Token'], a['X-Recaptcha-Token-Servicio'], b['X-Recaptcha-Token'], b['X-Recaptcha-Token-Servicio']];
    assert.equal(new Set(tokens).size, 4, 'ningún token se reutiliza');
    assert.ok(tokens.every((t) => t.startsWith('token-consulta-')), 'acción consulta');
});

test('502, 503 y 504 se reintentan una vez; 403/422/429 no', async () => {
    for (const estado of [502, 503, 504]) {
        const { ctx, llamadas } = cargar({ respuestas: [{ status: estado }, { status: 200, json: { referencia: 'r', reintento: true } }] });
        const r = await ctx.enviarConsulta('/api', CUERPO);
        assert.equal(r.estado, 200);
        assert.equal(llamadas.length, 2);
    }
    for (const estado of [403, 422, 429]) {
        const { ctx, llamadas } = cargar({ respuestas: [{ status: estado }, { status: 201 }] });
        const r = await ctx.enviarConsulta('/api', CUERPO);
        assert.equal(r.estado, estado);
        assert.equal(llamadas.length, 1);
    }
});

test('cada mensaje de error al huésped es específico e incluye el código del envío', async () => {
    const casos = [
        [['red', 'red'], /No pudimos conectar con el servidor.*VPN.*WhatsApp/],
        [[{ status: 502 }, { status: 502 }], /problema de nuestro lado.*WhatsApp/],
        [[{ status: 504 }, { status: 504 }], /problema de nuestro lado/],
        [[{ status: 500 }], /problema de nuestro lado/],
        [[{ status: 403 }], /No pudimos verificar el envío/],
        [[{ status: 429 }], /demasiados intentos/],
        [[{ status: 422 }], /Revisa los datos/],
        [[{ status: 503 }, { status: 503 }], /No pudimos recibir tu consulta en este momento/]
    ];
    for (const [respuestas, patron] of casos) {
        const { ctx } = cargar({ respuestas });
        const r = await ctx.enviarConsulta('/api', CUERPO);
        const mensaje = ctx.mensajeResultadoEnvio(r);
        assert.match(mensaje, patron);
        assert.match(mensaje, new RegExp(`\\(código ${r.codigo}\\)$`));
        assert.match(r.codigo, /^[A-Z2-9]{8}$/);
    }
});

test('reCAPTCHA bloqueado (bloqueador, Firefox estricto): mensaje claro sin esperar ni llamar al servidor', async () => {
    const { ctx, llamadas, scripts } = cargar({ grecaptcha: false, respuestas: [{ status: 201 }] });
    const promesa = ctx.enviarConsulta('/api', CUERPO);
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(scripts.length, 1);
    scripts[0].onerror();
    const r = await promesa;
    assert.equal(r.tipo, 'captcha_bloqueado');
    assert.equal(llamadas.length, 0);
    const mensaje = ctx.mensajeResultadoEnvio(r);
    assert.match(mensaje, /bloqueador/);
    assert.match(mensaje, /Firefox/);
    assert.match(mensaje, /WhatsApp/);
    assert.match(mensaje, /\(código [A-Z2-9]{8}\)$/);
    assert.equal(scripts[0].quitado, true, 'el script fallido se quita para poder reintentar la carga');
});

test('grecaptcha que carga pero falla al dar token: mensaje de verificación, no el genérico', async () => {
    const { ctx, llamadas } = cargar({ respuestas: [{ status: 201 }] });
    ctx.grecaptcha.execute = async () => { throw new Error('x'); };
    const r = await ctx.enviarConsulta('/api', CUERPO);
    assert.equal(r.tipo, 'captcha');
    assert.equal(llamadas.length, 0);
    assert.match(ctx.mensajeResultadoEnvio(r), /No pudimos verificar el envío/);
});

test('ya no queda el mensaje genérico «No se pudo enviar. Inténtalo por teléfono o WhatsApp.»', () => {
    assert.doesNotMatch(codigo, /No se pudo enviar\. Inténtalo por teléfono o WhatsApp\./);
});
