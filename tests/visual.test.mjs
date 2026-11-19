// Regresión visual de la landing (2026-11-19, segunda pasada): el par de botones del hero es
// parejo, los atributos no dejan huérfanos, el sello no se sale de la foto, la foto no se
// estira por sobre su resolución, el logo es vectorial y el sello de reCAPTCHA no tapa nada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = new URL('../', import.meta.url);
const leer = (ruta) => readFileSync(new URL(ruta, raiz), 'utf8');
const css = leer('assets/css/styles.css');
const html = leer('index.html');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

test('marca: la cabecera y el pie usan la hoja vectorial (la misma del favicon)', () => {
    const cabecera = html.match(/<a class="site-header__brand"[\s\S]*?<\/a>/)[0];
    assert.match(cabecera, /src="assets\/img\/logo-herencia-hoja\.svg"/);
    const svg = leer('assets/img/logo-herencia-hoja.svg');
    assert.match(svg, /viewBox="0 0 \d+ \d+"/);
    assert.doesNotMatch(svg, /<script|<image|href="http/i, 'el SVG del logo es solo trazos');
    assert.match(html.match(/<footer[\s\S]*?<\/footer>/)[0], /logo-herencia-hoja\.svg/);
});

test('hero: WhatsApp con su ícono y atributos con íconos con sentido', () => {
    const acciones = html.match(/<div class="hero__actions">[\s\S]*?<\/div>/)[0];
    assert.equal((acciones.match(/class="button /g) || []).length, 2, 'el hero tiene un par de acciones');
    assert.match(acciones, /wa\.me[\s\S]*?#i-whatsapp/);
    assert.match(html, /<symbol id="i-whatsapp"/);
    const chips = html.match(/<ul class="hero__chips"[\s\S]*?<\/ul>/)[0];
    assert.match(chips, /#i-parking"\/><\/svg>Estacionamiento/);
    // El símbolo de estacionamiento dibuja un auto (dos ruedas), no un documento.
    const parking = html.match(/<symbol id="i-parking"[\s\S]*?<\/symbol>/)[0];
    assert.equal((parking.match(/<circle/g) || []).length, 2);
});

test('reCAPTCHA: el sello flotante se oculta solo junto al aviso con los enlaces de Google', () => {
    assert.match(css, /\.grecaptcha-badge\s*{\s*visibility:\s*hidden/);
    const aviso = html.match(/<p class="recaptcha-aviso">[\s\S]*?<\/p>/);
    assert.ok(aviso, 'falta el aviso de reCAPTCHA junto al formulario');
    assert.match(aviso[0], /protegido por reCAPTCHA/);
    assert.match(aviso[0], /https:\/\/policies\.google\.com\/privacy/);
    assert.match(aviso[0], /https:\/\/policies\.google\.com\/terms/);
    assert.ok(html.indexOf('class="recaptcha-aviso"') < html.indexOf('</form>'), 'el aviso va dentro del formulario');
});

test('detalle visual a 320–1440 px (si hay Playwright)', async (t) => {
    let chromium;
    try {
        ({ chromium } = await import('playwright'));
    } catch {
        t.skip('playwright no instalado en este entorno');
        return;
    }
    const base = fileURLToPath(raiz);
    const servidor = createServer((req, res) => {
        const ruta = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^\/+/, '') || 'index.html';
        const archivo = join(base, ruta);
        if (!archivo.startsWith(base) || !existsSync(archivo)) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': MIME[extname(archivo)] || 'application/octet-stream' });
        res.end(readFileSync(archivo));
    });
    await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
    const navegador = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
    try {
        for (const ancho of [320, 375, 768, 1024, 1280, 1440]) {
            const pagina = await navegador.newPage({ viewport: { width: ancho, height: 900 } });
            // Sin red externa: reCAPTCHA no carga y no estorba la medición.
            await pagina.route(/^https?:\/\/(?!127\.0\.0\.1)/, (ruta) => ruta.abort());
            await pagina.goto(`http://127.0.0.1:${servidor.address().port}/`, { waitUntil: 'load' });
            await pagina.evaluate(() => document.querySelectorAll('[data-reveal]').forEach((e) => e.classList.add('is-visible')));
            const m = await pagina.evaluate(() => {
                const caja = (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, b: r.bottom, d: r.right }; };
                const desborda = (e) => e.scrollWidth > e.clientWidth + 1;
                const filas = (sel) => {
                    const ys = [...document.querySelectorAll(sel)].map((e) => Math.round(e.getBoundingClientRect().top));
                    const cuenta = {}; ys.forEach((y) => { cuenta[y] = (cuenta[y] || 0) + 1; });
                    return Object.values(cuenta);
                };
                const foto = document.querySelector('.hero__photo');
                return {
                    cta: [...document.querySelectorAll('.hero__actions .button')].map(caja),
                    ctaDesborda: [...document.querySelectorAll('.hero__actions .button, .hero__chips li, .contact-form__footer .button')].filter(desborda).map((e) => e.textContent.trim()),
                    chips: filas('.hero__chips li'),
                    servicios: filas('.amenities li'),
                    serviciosX: [...document.querySelectorAll('.amenities li')].map(caja),
                    foto: caja(foto), fotoNatural: foto.naturalWidth / (foto.currentSrc.includes('-950') ? 2 : 1),
                    sello: caja(document.querySelector('.hero__badge')),
                    logo: caja(document.querySelector('.site-header__logo')),
                    nombre: caja(document.querySelector('.site-header__name')),
                    form: [...document.querySelectorAll('.contact-form__footer .button')].map(caja),
                };
            });
            const [a, b] = m.cta;
            assert.equal(Math.round(a.h), Math.round(b.h), `${ancho}px: botones del hero de distinta altura`);
            assert.ok(Math.abs(a.w - b.w) <= 1, `${ancho}px: botones del hero de distinto ancho (${a.w} vs ${b.w})`);
            if (ancho > 600) assert.ok(Math.abs(a.y - b.y) <= 1, `${ancho}px: los botones deben ir lado a lado`);
            else assert.ok(b.y >= a.b && Math.abs(a.x - b.x) <= 1, `${ancho}px: en el teléfono van apilados`);
            assert.deepEqual(m.ctaDesborda, [], `${ancho}px: texto cortado en ${m.ctaDesborda}`);
            assert.ok(new Set(m.chips).size === 1, `${ancho}px: atributos con fila huérfana ${m.chips}`);
            // Servicios: la última fila, si es más corta, queda centrada.
            const ultima = m.serviciosX.filter((c) => Math.round(c.y) === Math.round(m.serviciosX.at(-1).y));
            const izq = ultima[0].x - m.serviciosX[0].x;
            const der = m.serviciosX.reduce((mx, c) => Math.max(mx, c.d), 0) - ultima.at(-1).d;
            assert.ok(Math.abs(izq - der) <= 2, `${ancho}px: la última fila de servicios no está centrada`);
            assert.ok(m.sello.x >= m.foto.x && m.sello.d <= m.foto.d && m.sello.b <= m.foto.b && m.sello.y >= m.foto.y,
                `${ancho}px: el sello de valoraciones se sale de la foto`);
            assert.ok(m.foto.w <= m.fotoNatural + 1, `${ancho}px: la foto se muestra a ${m.foto.w}px, más que su resolución`);
            const centroLogo = m.logo.y + m.logo.h / 2; const centroNombre = m.nombre.y + m.nombre.h / 2;
            assert.ok(Math.abs(centroLogo - centroNombre) <= 3, `${ancho}px: logo y nombre desalineados`);
            assert.ok(m.logo.h >= 32, `${ancho}px: logo de ${m.logo.h}px, muy chico`);
            assert.equal(Math.round(m.form[0].h), Math.round(m.form[1].h), `${ancho}px: botones del formulario disparejos`);
            await pagina.close();
        }
    } finally {
        await navegador.close();
        servidor.close();
    }
});
