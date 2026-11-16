// Validaciones estáticas del sitio: metadatos, JSON-LD, CSP, enlaces, imágenes, sitemap, robots y despliegue.
// Sin dependencias: solo Node (node --test tests/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const raiz = new URL('../', import.meta.url);
const leer = (ruta) => readFileSync(new URL(ruta, raiz), 'utf8');
const BASE = 'https://www.hotelherencia.cl/';
const paginas = ['index.html', 'privacidad.html', '404.html'];
const html = Object.fromEntries(paginas.map((p) => [p, leer(p)]));
const vercel = JSON.parse(leer('vercel.json'));

const normalizar = (t) => t.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const meta = (doc, atributo, nombre) => {
    const m = doc.match(new RegExp(`<meta[^>]*${atributo}="${nombre}"[^>]*content="([^"]*)"`, 's'));
    return m ? m[1].replace(/\s+/g, ' ').trim() : null;
};
const jsonLd = (doc) => [...doc.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const grafo = () => jsonLd(html['index.html'])[0]['@graph'];
const nodo = (tipo) => grafo().find((n) => n['@type'] === tipo);

test('cada página indexable tiene title, description, canonical absoluto y lang es-CL', () => {
    const titulos = new Set();
    for (const p of ['index.html', 'privacidad.html']) {
        const doc = html[p];
        assert.match(doc, /<html lang="es-CL">/, p);
        assert.match(doc, /<meta name="viewport"/, p);
        const titulo = doc.match(/<title>([^<]+)<\/title>/)[1];
        assert.ok(titulo.length >= 20 && titulo.length <= 65, `${p}: title de ${titulo.length} caracteres`);
        assert.ok(!titulos.has(titulo), `${p}: title duplicado`);
        titulos.add(titulo);
        const descripcion = meta(doc, 'name', 'description');
        assert.ok(descripcion && descripcion.length >= 50 && descripcion.length <= 170, `${p}: description`);
        const canonical = doc.match(/<link rel="canonical" href="([^"]+)"/)[1];
        assert.ok(canonical.startsWith(BASE), `${p}: canonical ${canonical}`);
        assert.equal(meta(doc, 'property', 'og:url'), canonical, `${p}: og:url = canonical`);
        assert.doesNotMatch(doc, /<meta name="robots" content="[^"]*noindex/, `${p} no debe tener noindex`);
    }
});

test('la página 404 no es indexable', () => {
    assert.match(html['404.html'], /<meta name="robots" content="noindex/);
});

test('todo el JSON-LD es JSON válido y las referencias @id del grafo existen', () => {
    for (const p of paginas) {
        jsonLd(html[p]);
    }
    const ids = new Set(grafo().map((n) => n['@id']));
    const refs = JSON.stringify(jsonLd(html['index.html'])).match(/\{"@id":"[^"]+"\}/g) || [];
    for (const ref of refs) {
        const id = JSON.parse(ref)['@id'];
        assert.ok(ids.has(id), `referencia sin nodo: ${id}`);
    }
    assert.equal(grafo().filter((n) => n['@type'] === 'Hotel').length, 1, 'un solo nodo Hotel');
});

test('Hotel: NAP coherente con el texto visible, geo numérico y sin datos inventados', () => {
    const hotel = nodo('Hotel');
    const visible = normalizar(html['index.html'].split('<body>')[1]);
    assert.ok(visible.includes(hotel.address.streetAddress), 'dirección del schema visible en la página');
    assert.ok(visible.includes('+56 9 5649 1501'));
    assert.equal(hotel.telephone, '+56956491501');
    assert.equal(typeof hotel.geo.latitude, 'number');
    assert.equal(typeof hotel.geo.longitude, 'number');
    assert.ok(hotel.geo.latitude < -36.5 && hotel.geo.latitude > -36.7, 'latitud en Chillán');
    assert.ok(hotel.geo.longitude < -72.0 && hotel.geo.longitude > -72.2, 'longitud en Chillán');
    for (const prohibido of ['aggregateRating', 'review', 'starRating', 'priceRange', 'makesOffer']) {
        assert.ok(!(prohibido in hotel), `${prohibido} requiere dato confirmado por el negocio`);
    }
    for (const archivo of ['llms.txt', '404.html']) {
        assert.ok(leer(archivo).includes('Diego de Almagro 751'), `${archivo} usa la misma dirección`);
    }
});

test('el FAQ en JSON-LD coincide palabra por palabra con el FAQ visible', () => {
    const faq = jsonLd(html['index.html']).find((b) => b['@type'] === 'FAQPage');
    const seccion = html['index.html'].split('id="preguntas-frecuentes"')[1].split('</section>')[0];
    const visibles = [...seccion.matchAll(/<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g)].map((m) => [normalizar(m[1]), normalizar(m[2])]);
    assert.equal(faq.mainEntity.length, visibles.length);
    faq.mainEntity.forEach((q, i) => {
        assert.equal(q.name, visibles[i][0]);
        assert.equal(q.acceptedAnswer.text, visibles[i][1]);
    });
});

test('CSP: el hash autoriza el script inline y la meta coincide con la cabecera de vercel.json', () => {
    const doc = html['index.html'];
    const inline = [...doc.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    const cspMeta = doc.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/)[1];
    const cspCabecera = vercel.headers.find((h) => h.source === '/(.*)').headers.find((h) => h.key === 'Content-Security-Policy').value;
    for (const s of inline) {
        const hash = `sha256-${createHash('sha256').update(s).digest('base64')}`;
        assert.ok(cspMeta.includes(hash), `meta CSP sin ${hash}`);
        assert.ok(cspCabecera.includes(hash), `cabecera CSP sin ${hash}`);
    }
    assert.equal(cspCabecera.replace(" frame-ancestors 'none';", ''), cspMeta, 'meta = cabecera (sin frame-ancestors, que no aplica en meta)');
});

test('todos los recursos y enlaces locales existen, y los anclajes internos apuntan a ids reales', () => {
    for (const p of paginas) {
        const doc = html[p];
        const ids = new Set([...doc.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
        const indexIds = new Set([...html['index.html'].matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
        for (const [, valor] of doc.matchAll(/\s(?:src|href|srcset)="([^"]+)"/g)) {
            if (/^(https?:|tel:|mailto:)/.test(valor)) { continue; }
            if (valor.startsWith('#')) {
                assert.ok(ids.has(valor.slice(1)), `${p}: ancla rota ${valor}`);
                continue;
            }
            const [ruta, ancla] = valor.replace(/^\//, '').split('#');
            if (ruta === '' || ruta === 'index.html') {
                if (ancla) { assert.ok(indexIds.has(ancla), `${p}: ancla rota ${valor}`); }
                continue;
            }
            if (ruta === 'privacidad') { continue; } // redirección 308 declarada en vercel.json
            assert.ok(existsSync(new URL(ruta, raiz)), `${p}: no existe ${ruta}`);
        }
    }
});

test('imágenes: alt, dimensiones, y lazy solo fuera del hero', () => {
    const doc = html['index.html'];
    const imgs = [...doc.matchAll(/<img\s[\s\S]*?>/g)].map((m) => m[0]);
    assert.ok(imgs.length > 5);
    imgs.forEach((img, i) => {
        assert.match(img, /\salt="[^"]{10,}"/, `img ${i} sin alt descriptivo`);
        assert.match(img, /\swidth="\d+"/, `img ${i} sin width`);
        assert.match(img, /\sheight="\d+"/, `img ${i} sin height`);
    });
    assert.match(imgs[0], /fetchpriority="high"/);
    assert.doesNotMatch(imgs[0], /loading="lazy"/, 'la imagen del hero no debe ser lazy');
    imgs.slice(1).forEach((img) => assert.match(img, /loading="lazy"/));
});

test('sitemap: solo URLs canónicas de páginas existentes, y robots.txt lo declara sin bloquear buscadores', () => {
    const sitemap = leer('sitemap.xml');
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const paginasSitemap = locs.filter((l) => !/\.(jpg|png|webp)$/.test(l));
    assert.deepEqual(paginasSitemap, [BASE, `${BASE}privacidad.html`]);
    for (const l of locs.filter((x) => /\.(jpg|png|webp)$/.test(x))) {
        assert.ok(existsSync(new URL(l.replace(BASE, ''), raiz)), `imagen del sitemap no existe: ${l}`);
    }
    const robots = leer('robots.txt');
    assert.match(robots, new RegExp(`^Sitemap: ${BASE}sitemap.xml$`, 'm'));
    const grupos = robots.split(/\n(?=User-agent:)/);
    for (const bot of ['Googlebot', 'Bingbot', '*']) {
        const grupo = grupos.find((g) => g.split('\n').some((l) => l.trim() === `User-agent: ${bot}`));
        if (grupo) {
            assert.doesNotMatch(grupo, /^Disallow: \/$/m, `${bot} no debe bloquearse por completo`);
        }
    }
});

test('despliegue: docs y tests no se publican; /reservar redirige temporalmente a la plataforma', () => {
    const ignorados = leer('.vercelignore').split('\n').map((l) => l.trim());
    assert.ok(ignorados.includes('docs'));
    assert.ok(ignorados.includes('tests'));
    const reservar = vercel.redirects.find((r) => r.source === '/reservar');
    assert.equal(reservar.destination, 'https://plataforma-salman-herencia-oficial.vercel.app/reservar');
    assert.equal(reservar.permanent, false);
});

test('el contenido no presenta la consulta como reserva confirmada', () => {
    const visible = normalizar(html['index.html'].split('<body>')[1]);
    assert.ok(visible.includes('enviar el formulario no confirma la estadía') || visible.includes('enviar no confirma la estadía'));
    assert.doesNotMatch(visible, /reserva (confirmada|garantizada)/i);
});

test('el mapa (renderizado de OpenStreetMap) muestra la atribución que exige la ODbL', () => {
    const tarjeta = html['index.html'].split('class="map-card"')[1].split('</figure>')[0];
    assert.match(tarjeta, /openstreetmap\.org\/copyright/);
    assert.doesNotMatch(html['index.html'], /class="map-card"[^>]*aria-hidden/);
});
