// Pruebas de la lógica del formulario y de la capa de eventos de assets/js/main.js.
// main.js es un script de navegador sin módulos: se ejecuta en un contexto vm con un DOM mínimo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const codigo = readFileSync(new URL('../assets/js/main.js', import.meta.url), 'utf8');

function cargar() {
    const oyentes = {};
    const navegaciones = [];

    class Element {
        constructor(href, seccion) { this.href = href; this.seccion = seccion; }
        getAttribute(nombre) { return nombre === 'href' ? this.href : null; }
        closest(selector) {
            if (selector === 'a[href]') { return this; }
            if (selector.startsWith('section')) { return this.seccion; }
            return null;
        }
    }

    const documento = {
        readyState: 'complete',
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener: (tipo, fn) => { oyentes[tipo] = fn; },
        head: { append() {} },
        createElement: () => ({ dataset: {} })
    };

    const contexto = {
        document: documento,
        Element,
        crypto: globalThis.crypto,
        URLSearchParams,
        IntersectionObserver: class { observe() {} },
        setTimeout: () => 0,
        clearTimeout: () => {},
        setInterval: () => 0,
        clearInterval: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        location: { assign: (url) => navegaciones.push(url) },
        console
    };
    contexto.window = contexto;
    vm.createContext(contexto);
    vm.runInContext(codigo, contexto);
    return { ctx: contexto, oyentes, navegaciones, Element };
}

function fecha(dias) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + dias);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const valido = () => ({
    nombre: 'Ana Pérez',
    correo: 'ana@example.com',
    telefono: '+56 9 1234 5678',
    huespedes: 2,
    check_in: fecha(5),
    check_out: fecha(7),
    mensaje: null
});

test('problemaConsulta acepta una consulta completa y válida', () => {
    const { ctx } = cargar();
    assert.equal(ctx.problemaConsulta(valido()), '');
});

for (const [caso, cambio, esperado] of [
    ['sin nombre', { nombre: '' }, 'Indica tu nombre.'],
    ['correo inválido', { correo: 'ana@' }, 'Indica un correo válido.'],
    ['teléfono corto', { telefono: '123' }, 'Indica un teléfono válido.'],
    ['solo una fecha', { check_out: null }, 'Indica las fechas de tu estadía.'],
    ['salida antes de llegada', { check_in: fecha(7), check_out: fecha(5) }, 'La salida debe ser posterior a la llegada.'],
    ['llegada pasada', { check_in: fecha(-2), check_out: fecha(1) }, 'La llegada no puede ser una fecha pasada.'],
    ['más de 30 noches', { check_in: fecha(1), check_out: fecha(40) }, 'El rango supera las 30 noches.'],
    ['mensaje demasiado largo', { mensaje: 'x'.repeat(2001) }, 'El mensaje es demasiado largo.']
]) {
    test(`problemaConsulta rechaza: ${caso}`, () => {
        const { ctx } = cargar();
        assert.equal(ctx.problemaConsulta({ ...valido(), ...cambio }), esperado);
    });
}

test('cuerpoConsulta recorta espacios y convierte vacíos en null', () => {
    const { ctx } = cargar();
    const cuerpo = ctx.cuerpoConsulta({ name: '  Ana ', email: 'a@b.cl', phone: '912345678', guests: '3', checkin: '', checkout: '', message: '  ' });
    assert.equal(cuerpo.nombre, 'Ana');
    assert.equal(cuerpo.huespedes, 3);
    assert.equal(cuerpo.check_in, null);
    assert.equal(cuerpo.mensaje, null);
});

test('el enlace a /reservar no lleva datos personales y solo acepta referencias opacas', () => {
    const { ctx } = cargar();
    const cuerpo = valido();
    const conRef = new URL(ctx.enlaceContinuarReserva(cuerpo, 'A'.repeat(24)));
    assert.equal(conRef.origin + conRef.pathname, 'https://plataforma.hotelherencia.cl/reservar');
    assert.deepEqual([...conRef.searchParams.keys()].sort(), ['llegada', 'personas', 'ref', 'salida']);
    const texto = conRef.toString();
    for (const dato of ['Ana', 'ana@example.com', '1234']) {
        assert.ok(!texto.includes(encodeURIComponent(dato)) && !texto.includes(dato), `no debe incluir ${dato}`);
    }
    const sinRef = new URL(ctx.enlaceContinuarReserva(cuerpo, 'corta<script>'));
    assert.equal(sinRef.searchParams.has('ref'), false);
});

test('registrarEvento agrega al dataLayer con event_id y conserva el id dado', () => {
    const { ctx } = cargar();
    ctx.registrarEvento('generate_lead', { event_id: 'clave-idem', origen: 'formulario' });
    ctx.registrarEvento('contact_phone');
    assert.equal(ctx.dataLayer.length, 2);
    assert.equal(ctx.dataLayer[0].event, 'generate_lead');
    assert.equal(ctx.dataLayer[0].event_id, 'clave-idem');
    assert.match(ctx.dataLayer[1].event_id, /\S{8,}/);
});

test('irAReserva registra check_availability y navega', () => {
    const { ctx, navegaciones } = cargar();
    ctx.irAReserva('https://plataforma.hotelherencia.cl/reservar?inicio=a');
    assert.equal(ctx.dataLayer.at(-1).event, 'check_availability');
    assert.equal(navegaciones.length, 1);
});

test('clic en WhatsApp y en teléfono generan eventos sin datos personales', () => {
    const { ctx, oyentes, Element } = cargar();
    oyentes.click({ target: new Element('https://wa.me/56956491501', { id: 'contacto' }) });
    oyentes.click({ target: new Element('tel:+56956491501', null) });
    oyentes.click({ target: new Element('#habitaciones', { id: 'inicio' }) });
    assert.deepEqual([...ctx.dataLayer].map((e) => e.event), ['contact_whatsapp', 'contact_phone']);
    assert.equal(ctx.dataLayer[0].ubicacion, 'contacto');
    for (const evento of ctx.dataLayer) {
        assert.deepEqual(Object.keys(evento).sort(), ['event', 'event_id', 'ubicacion']);
    }
});

test('main.js no carga proveedores de analítica ni envía eventos por red', () => {
    for (const patron of [/googletagmanager\.com/, /google-analytics\.com/, /connect\.facebook\.net/, /gtag\(/, /fbq\(/]) {
        assert.doesNotMatch(codigo, patron);
    }
});
