// Sistema de diseño de la landing (2026-11-19): contraste AA de los tokens, fuentes propias,
// navegación accesible, iconos y, si hay navegador disponible, sin desborde horizontal a 320 px.
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
const vercel = JSON.parse(leer('vercel.json'));

const tokens = Object.fromEntries([...css.split(':root {')[1].split('}')[0].matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

function rgb(valor) {
    const hex = valor.match(/^#([0-9a-f]{6})$/i);
    if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16));
    throw new Error(`color no soportado: ${valor}`);
}
function luminancia([r, g, b]) {
    const c = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contraste(a, b) {
    const [l1, l2] = [luminancia(rgb(a)), luminancia(rgb(b))].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
}

test('tokens: texto y fondos cumplen WCAG AA (4,5:1 texto normal)', () => {
    const pares = [
        ['color-ink', 'color-bg'], ['color-ink', 'color-bg-alt'], ['color-ink', 'color-surface'],
        ['color-ink-muted', 'color-bg'], ['color-ink-muted', 'color-bg-alt'], ['color-ink-muted', 'color-surface'],
        ['color-accent', 'color-bg'], ['color-accent', 'color-surface'], ['color-brand', 'color-bg'],
        ['color-brand', 'color-bg-alt'], ['color-brand', 'color-brand-soft'], ['color-on-brand', 'color-brand'],
        ['color-error', 'color-error-bg'], ['color-success', 'color-success-bg'], ['color-ink', 'color-accent-soft'],
    ];
    for (const [texto, fondo] of pares) {
        const r = contraste(tokens[texto], tokens[fondo]);
        assert.ok(r >= 4.5, `${texto} sobre ${fondo}: ${r.toFixed(2)}:1`);
    }
    // El anillo de foco debe distinguirse del fondo (3:1, WCAG 1.4.11).
    assert.ok(contraste(tokens['color-focus'], tokens['color-bg']) >= 3);
});

test('tipografía y espacio salen de tokens (escala única)', () => {
    for (const t of ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-display',
        'space-1', 'space-4', 'space-8', 'space-16', 'radius-sm', 'radius-md', 'radius-lg', 'shadow-sm', 'shadow-md', 'shadow-lg']) {
        assert.ok(tokens[t], `falta el token --${t}`);
    }
    // Sin tamaños de letra sueltos fuera de los tokens (salvo ajustes puntuales de iconos y marca).
    const sueltos = [...css.matchAll(/font-size:\s*([^;]+);/g)].map((m) => m[1]).filter((v) => !v.startsWith('var(--text-'));
    assert.ok(sueltos.length <= 4, `font-size fuera de la escala: ${sueltos.join(', ')}`);
});

test('fuentes propias: sin Google Fonts y la CSP solo permite fuentes del mismo origen', () => {
    for (const doc of [html, css, leer('privacidad.html'), leer('404.html')]) {
        assert.doesNotMatch(doc, /fonts\.(googleapis|gstatic)\.com/);
    }
    for (const [, url] of css.matchAll(/url\("\.\.\/fonts\/([^"]+)"\)/g)) {
        assert.ok(existsSync(new URL(`assets/fonts/${url}`, raiz)), `no existe la fuente ${url}`);
    }
    const csp = vercel.headers.find((h) => h.source === '/(.*)').headers.find((h) => h.key === 'Content-Security-Policy').value;
    assert.match(csp, /font-src 'self';/);
    assert.match(csp, /style-src 'self' 'unsafe-inline';/);
});

test('cabecera: salto al contenido, menú móvil con aria-controls/aria-expanded y botón Reservar', () => {
    assert.match(html, /<a class="skip-link" href="#contenido">Saltar al contenido<\/a>/);
    assert.match(html, /<main id="contenido"/);
    const boton = html.match(/<button[^>]*data-nav-toggle[^>]*>/)[0];
    assert.match(boton, /aria-expanded="false"/);
    const controla = boton.match(/aria-controls="([^"]+)"/)[1];
    assert.match(html, new RegExp(`<nav class="site-nav" id="${controla}"`));
    const nav = html.split(`id="${controla}"`)[1].split('</nav>')[0];
    for (const ancla of ['#habitaciones', '#servicios', '#ubicacion', '#preguntas-frecuentes', '#contacto']) {
        assert.ok(nav.includes(`href="${ancla}"`), `el menú debe enlazar ${ancla}`);
    }
    assert.match(nav, /href="https:\/\/plataforma\.hotelherencia\.cl\/reservar">Reservar<\/a>/);
});

test('iconos: decorativos (aria-hidden) y cada <use> apunta a un símbolo existente', () => {
    const simbolos = new Set([...html.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]));
    const usos = [...html.matchAll(/<use href="#([^"]+)"/g)].map((m) => m[1]);
    assert.ok(usos.length > 10);
    for (const u of usos) assert.ok(simbolos.has(u), `símbolo inexistente: ${u}`);
    for (const svg of html.matchAll(/<svg class="icono[^"]*"[^>]*>/g)) {
        assert.match(svg[0], /aria-hidden="true"/);
    }
});

test('preguntas frecuentes en acordeón nativo (teclado sin JavaScript)', () => {
    const seccion = html.split('id="preguntas-frecuentes"')[1].split('</section>')[0];
    const items = seccion.match(/<details class="faq-item">/g) || [];
    assert.ok(items.length >= 10);
    assert.equal((seccion.match(/<summary>/g) || []).length, items.length);
});

test('imágenes de habitaciones y galería ofrecen WebP liviano (640 y 1024 px)', () => {
    const fuentes = [...html.matchAll(/<source type="image\/webp" srcset="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(fuentes.length >= 9);
    for (const f of fuentes) assert.match(f, /-640\.webp 640w, [^ ]+\.webp 1024w/);
});

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

test('responsivo: sin desborde horizontal a 320, 375 y 1440 px (si hay Playwright)', async (t) => {
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
        for (const ancho of [320, 375, 1440]) {
            const pagina = await navegador.newPage({ viewport: { width: ancho, height: 800 } });
            await pagina.goto(`http://127.0.0.1:${servidor.address().port}/`, { waitUntil: 'load' });
            const { sw, w } = await pagina.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: document.documentElement.clientWidth }));
            assert.ok(sw <= w, `a ${ancho}px el documento mide ${sw}px`);
            if (ancho === 375) {
                await pagina.click('[data-nav-toggle]');
                assert.equal(await pagina.getAttribute('[data-nav-toggle]', 'aria-expanded'), 'true');
                assert.ok(await pagina.isVisible('#menu-sitio a[href="#habitaciones"]'));
                await pagina.keyboard.press('Escape');
                assert.equal(await pagina.getAttribute('[data-nav-toggle]', 'aria-expanded'), 'false');
            }
            await pagina.close();
        }
    } finally {
        await navegador.close();
        servidor.close();
    }
});
