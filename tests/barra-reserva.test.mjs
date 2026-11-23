// #414 Flujo único de solicitud de reserva: barra rápida de 3 campos en la landing
// que navega directo a plataforma.hotelherencia.cl/reservar sin pedir datos personales.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const codigo = readFileSync(new URL('../assets/js/main.js', import.meta.url), 'utf8');

function fecha(dias) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + dias);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function cargarBarra({ llegada = '', salida = '', personas = '2' } = {}) {
    const navegaciones = [];
    const fetchCalls = [];
    const listeners = {};
    const status = { textContent: '', hidden: true, classList: { toggle() {} } };
    const campos = {
        '#rapido-llegada': { value: llegada, min: '', addEventListener() {} },
        '#rapido-salida': { value: salida, min: '', addEventListener() {} },
        '#rapido-personas': { value: personas, addEventListener() {} }
    };
    const barra = {
        querySelector: (sel) => (sel === '[data-barra-estado]' ? status : null),
        addEventListener: (tipo, fn) => { listeners[tipo] = fn; }
    };

    const contexto = {
        document: {
            readyState: 'complete',
            querySelector: (sel) => (sel === '[data-barra-reserva]' ? barra : campos[sel] || null),
            querySelectorAll: () => [],
            addEventListener: () => {},
            head: { append() {} },
            createElement: () => ({ dataset: {} })
        },
        Element: class {},
        crypto: globalThis.crypto,
        URL,
        URLSearchParams,
        fetch: async (...args) => { fetchCalls.push(args); return { status: 201, json: async () => ({}) }; },
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
    return { ctx: contexto, listeners, navegaciones, fetchCalls, status, campos };
}

test('#414 HTML: la barra rápida tiene exactamente 3 campos (Llegada, Salida, Huéspedes) y sin datos personales', () => {
    const match = html.match(/<form class="booking-bar"[\s\S]*?<\/form>/);
    assert.ok(match, 'falta el formulario .booking-bar');
    const barra = match[0];
    const inputs = [...barra.matchAll(/<input[^>]*name="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(inputs, ['llegada', 'salida', 'personas']);
    assert.match(barra, /<span>Llegada<\/span>/);
    assert.match(barra, /<span>Salida<\/span>/);
    assert.match(barra, /<span>Huéspedes<\/span>/);
    assert.doesNotMatch(barra, /check-?in|check-?out/i);
    assert.doesNotMatch(barra, /name="(name|email|phone|rut|documento)"/i);
    assert.match(barra, /action="\/reservar"/);
});

test('#414 HTML: #contacto queda exclusivamente para consultas generales y grupos', () => {
    const seccion = html.split('id="contacto"')[1].split('</section>')[0];
    assert.match(seccion, /Consultas generales/i);
    assert.match(seccion, /grupos/i);
    assert.doesNotMatch(seccion, /data-ver-disponibilidad/);
});

test('#414 barra rápida: navega directo a plataforma.hotelherencia.cl/reservar sin llamar a /publico/leads', () => {
    const llegada = fecha(4);
    const salida = fecha(6);
    const { listeners, navegaciones, fetchCalls, status } = cargarBarra({ llegada, salida, personas: '3' });
    let prevented = false;
    listeners.submit({ preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(fetchCalls.length, 0, 'no debe enviar lead ni pedir datos personales antes de /reservar');
    assert.equal(status.hidden, true);
    assert.equal(navegaciones.length, 1);
    assert.equal(
        navegaciones[0],
        `https://plataforma.hotelherencia.cl/reservar?llegada=${llegada}&salida=${salida}&personas=3`
    );
});

test('#414 barra rápida: rechaza rangos inválidos sin navegar y sin reflejar entrada cruda', () => {
    const { listeners, navegaciones, status } = cargarBarra({
        llegada: '<script>alert(1)</script>',
        salida: fecha(2),
        personas: '2'
    });
    listeners.submit({ preventDefault: () => {} });
    assert.equal(navegaciones.length, 0);
    assert.equal(status.hidden, false);
    assert.equal(status.textContent, 'Indica fechas válidas.');
    assert.doesNotMatch(status.textContent, /script/i);
});

test('#414 enlaceBarraReserva: valida salida posterior, fecha no pasada y personas 1..30', () => {
    const { ctx } = cargarBarra();
    const ok = ctx.enlaceBarraReserva({ llegada: fecha(2), salida: fecha(5), personas: '2' });
    assert.equal(ok.error, '');
    assert.equal(ok.url, `https://plataforma.hotelherencia.cl/reservar?llegada=${fecha(2)}&salida=${fecha(5)}&personas=2`);

    const invertido = ctx.enlaceBarraReserva({ llegada: fecha(5), salida: fecha(2), personas: '2' });
    assert.equal(invertido.url, '');
    assert.match(invertido.error, /posterior/);

    const exceso = ctx.enlaceBarraReserva({ llegada: fecha(2), salida: fecha(5), personas: '31' });
    assert.equal(exceso.url, '');
    assert.match(exceso.error, /1 y 30/);
});
