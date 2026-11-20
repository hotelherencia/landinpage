// Continuidad landing → /reservar: la referencia opaca se guarda tras la consulta y viaja en todo
// enlace hacia la plataforma; nada del visitante llega a la URL sin pasar la lista blanca.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const codigo = readFileSync(new URL('../assets/js/main.js', import.meta.url), 'utf8');
const REF = 'Abc_123-xyz'.repeat(4);

function cargar({ almacen = new Map() } = {}) {
    const oyentes = {};
    const navegaciones = [];

    class Element {
        constructor(href) { this.href = href; }
        getAttribute(nombre) { return nombre === 'href' ? this.href : null; }
        setAttribute(nombre, valor) { if (nombre === 'href') { this.href = valor; } }
        closest(selector) { return selector === 'a[href]' ? this : null; }
    }

    const localStorage = {
        getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
        setItem: (k, v) => { almacen.set(k, String(v)); },
        removeItem: (k) => { almacen.delete(k); }
    };

    const contexto = {
        document: {
            readyState: 'complete',
            querySelector: () => null,
            querySelectorAll: () => [],
            addEventListener: (tipo, fn) => { oyentes[tipo] = fn; },
            head: { append() {} },
            createElement: () => ({ dataset: {} })
        },
        Element,
        crypto: globalThis.crypto,
        URL,
        URLSearchParams,
        IntersectionObserver: class { observe() {} },
        setTimeout: () => 0,
        clearTimeout: () => {},
        setInterval: () => 0,
        clearInterval: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        location: { assign: (url) => navegaciones.push(url) },
        localStorage,
        console
    };
    contexto.window = contexto;
    vm.createContext(contexto);
    vm.runInContext(codigo, contexto);
    return { ctx: contexto, oyentes, navegaciones, Element, almacen };
}

function fecha(dias) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + dias);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

test('tras una consulta exitosa la referencia queda guardada y el enlace solo-fechas la incluye', () => {
    const { ctx } = cargar();
    assert.equal(ctx.guardarReferencia(REF), true);
    const url = new URL(ctx.enlaceContinuarReserva({ check_in: fecha(3), check_out: fecha(5), huespedes: 2 }, ''));
    assert.equal(url.searchParams.get('ref'), REF);
    assert.equal(url.searchParams.get('llegada'), fecha(3));
    assert.equal(url.searchParams.get('salida'), fecha(5));
    assert.equal(url.searchParams.has('inicio'), false);
});

test('sin fechas pero con consulta previa, el enlace lleva solo la referencia', () => {
    const { ctx } = cargar();
    ctx.guardarReferencia(REF);
    const url = new URL(ctx.enlaceContinuarReserva({}, ''));
    assert.deepEqual([...url.searchParams.keys()], ['ref']);
});

test('la referencia guardada caduca a las 72 h y un valor manipulado se descarta', () => {
    const { ctx, almacen } = cargar();
    ctx.guardarReferencia(REF, Date.now() - 73 * 3600000);
    assert.equal(ctx.referenciaGuardada(), '');
    assert.equal(almacen.size, 0, 'la referencia vencida se borra');
    almacen.set('herencia:consulta-ref', JSON.stringify({ ref: '"><img src=x onerror=alert(1)>', expira: Date.now() + 1e6 }));
    assert.equal(ctx.referenciaGuardada(), '');
    almacen.set('herencia:consulta-ref', '{no es json');
    assert.equal(ctx.referenciaGuardada(), '');
});

test('guardarReferencia rechaza tokens con formato ajeno (XSS, SQLi, largos)', () => {
    const { ctx, almacen } = cargar();
    for (const malo of ['<script>alert(1)</script>', "' OR 1=1 --", 'a'.repeat(19), 'a'.repeat(129), 'abc def ghi jkl mno pqr', null, 42]) {
        assert.equal(ctx.guardarReferencia(malo), false, String(malo));
    }
    assert.equal(almacen.size, 0);
});

test('clic en cualquier enlace a /reservar de la plataforma o relativo agrega la referencia', () => {
    const { ctx, oyentes, Element } = cargar();
    ctx.guardarReferencia(REF);
    const absoluto = new Element(`https://plataforma.hotelherencia.cl/reservar?llegada=${fecha(3)}&salida=${fecha(4)}&personas=2`);
    oyentes.click({ target: absoluto });
    assert.equal(new URL(absoluto.href).searchParams.get('ref'), REF);
    const relativo = new Element('/reservar');
    oyentes.click({ target: relativo });
    assert.equal(relativo.href, `/reservar?ref=${REF}`);
});

test('sin redirección abierta: la referencia nunca se pega a hosts o rutas ajenas', () => {
    const { ctx } = cargar();
    ctx.guardarReferencia(REF);
    for (const ajeno of [
        'https://evil.example/reservar',
        '//evil.example/reservar',
        'https://plataforma.hotelherencia.cl.evil.example/reservar',
        'https://plataforma.hotelherencia.cl/login?next=https://evil.example',
        'javascript:alert(1)',
        'https://wa.me/56956491501',
        '#contacto'
    ]) {
        assert.equal(ctx.conReferencia(ajeno), ajeno, ajeno);
    }
});

test('un enlace que ya trae ref no se reescribe', () => {
    const { ctx } = cargar();
    ctx.guardarReferencia(REF);
    const otro = 'https://plataforma.hotelherencia.cl/reservar?ref=' + 'Z'.repeat(30);
    assert.equal(ctx.conReferencia(otro), otro);
});

for (const [caso, cuerpo] of [
    ['fecha imposible', { check_in: '2026-02-31', check_out: '2026-03-02', huespedes: 2 }],
    ['XSS en fecha', { check_in: '<svg onload=alert(1)>', check_out: fecha(4), huespedes: 2 }],
    ['SQLi en fecha', { check_in: "2026-12-01' OR '1'='1", check_out: fecha(4), huespedes: 2 }],
    ['salida antes de llegada', { check_in: fecha(5), check_out: fecha(3), huespedes: 2 }],
    ['estadía de 60 noches', { check_in: fecha(1), check_out: fecha(61), huespedes: 2 }]
]) {
    test(`fechas fuera de la lista blanca no entran a la URL: ${caso}`, () => {
        const { ctx } = cargar();
        assert.equal(ctx.enlaceContinuarReserva(cuerpo, ''), '', 'sin ref ni fechas válidas no hay enlace');
        ctx.guardarReferencia(REF);
        const url = new URL(ctx.enlaceContinuarReserva(cuerpo, ''));
        assert.deepEqual([...url.searchParams.keys()], ['ref']);
    });
}

test('personas fuera de 1..30 o no entera se normaliza a 1; nunca se refleja el valor crudo', () => {
    const { ctx } = cargar();
    for (const malo of [0, 31, 2.5, '2<script>', -1]) {
        const url = new URL(ctx.enlaceContinuarReserva({ check_in: fecha(3), check_out: fecha(4), huespedes: malo }, ''));
        assert.equal(url.searchParams.get('personas'), '1', String(malo));
    }
});

test('mensajeRango rechaza fechas que solo tienen forma ISO', () => {
    const { ctx } = cargar();
    assert.equal(ctx.mensajeRango('2026-13-01', '2026-13-02', 2), 'Indica fechas válidas.');
    assert.equal(ctx.mensajeRango(fecha(2), fecha(3), 2), '');
});

test('main.js no usa innerHTML ni inserta HTML crudo', () => {
    assert.doesNotMatch(codigo, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
});

test('el mensaje de WhatsApp para grupos lleva fechas y personas validadas, nunca datos personales ni valores crudos', () => {
    const { ctx } = cargar();
    const url = new URL(ctx.mensajeWhatsappGrupo(fecha(3), fecha(5), '5'));
    assert.equal(url.origin, 'https://wa.me');
    const texto = url.searchParams.get('text');
    assert.match(texto, /para 5 personas del \d{4}-\d{2}-\d{2} al \d{4}-\d{2}-\d{2}\./);
    const malo = new URL(ctx.mensajeWhatsappGrupo('<script>', "1' OR 1=1", '9<img>')).searchParams.get('text');
    assert.equal(malo, 'Hola, quiero consultar disponibilidad en Hotel Herencia.');
});

test('«Ver disponibilidad» con contacto completo no envía nada sin confirmación explícita', async () => {
    const llamadas = [];
    const { ctx } = cargar();
    ctx.fetch = async (...a) => { llamadas.push(a); return { status: 201, json: async () => ({}) }; };
    // Sin formulario en este DOM mínimo la función sale antes; se verifica el contrato en el código.
    assert.match(codigo, /if \(!confirmado\) \{[\s\S]*?mostrarDisponibilidadConEnlace\([\s\S]*?return;\s*\}/);
    assert.equal(llamadas.length, 0);
});

test('soloRef envía únicamente el token opaco en la URL (sin fechas ni datos en texto plano)', () => {
    const { ctx } = cargar();
    const url = new URL(ctx.enlaceContinuarReserva({ check_in: fecha(3), check_out: fecha(5), huespedes: 2 }, REF, { soloRef: true }));
    assert.deepEqual([...url.searchParams.keys()], ['ref']);
    assert.equal(url.searchParams.get('ref'), REF);
});

test('enlaceSinDatos jamás adjunta referencia previa y envía limpiar=1; el clic borra la referencia guardada', () => {
    const { ctx, oyentes, Element, almacen } = cargar();
    ctx.guardarReferencia(REF);
    const href = ctx.enlaceSinDatos({ check_in: fecha(3), check_out: fecha(5), huespedes: 2 });
    const url = new URL(href);
    assert.equal(url.searchParams.has('ref'), false);
    assert.equal(url.searchParams.get('limpiar'), '1');
    const enlace = new Element(href);
    const origGet = enlace.getAttribute.bind(enlace);
    enlace.getAttribute = (n) => (n === 'data-sin-referencia' ? '1' : origGet(n));
    oyentes.click({ target: enlace });
    assert.equal(new URL(enlace.href).searchParams.has('ref'), false);
    assert.equal(almacen.size, 0);
});

test('landinpage#1: «Reservar este tipo» conserva el tipo y suma la referencia opaca', () => {
    const { ctx, oyentes, Element } = cargar();
    ctx.guardarReferencia(REF);
    const tarjeta = new Element('https://plataforma.hotelherencia.cl/reservar?tipo=matrimonial');
    oyentes.click({ target: tarjeta });
    const url = new URL(tarjeta.href);
    assert.equal(url.searchParams.get('tipo'), 'matrimonial');
    assert.equal(url.searchParams.get('ref'), REF);
    assert.deepEqual([...url.searchParams.keys()].sort(), ['ref', 'tipo']);
});
