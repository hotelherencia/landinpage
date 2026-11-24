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
    assert.deepEqual(hotel.telephone, ['+56956491501', '+56223138311']);
    assert.equal(typeof hotel.geo.latitude, 'number');
    assert.equal(typeof hotel.geo.longitude, 'number');
    assert.ok(hotel.geo.latitude < -36.5 && hotel.geo.latitude > -36.7, 'latitud en Chillán');
    assert.ok(hotel.geo.longitude < -72.0 && hotel.geo.longitude > -72.2, 'longitud en Chillán');
    for (const prohibido of ['aggregateRating', 'review', 'starRating', 'makesOffer']) {
        assert.ok(!(prohibido in hotel), `${prohibido} no debe publicarse en el schema (dato no confirmado o reseña autoservida)`);
    }
    for (const archivo of ['llms.txt', 'llms-full.txt', '404.html']) {
        assert.ok(leer(archivo).includes('Diego de Almagro 751'), `${archivo} usa la misma dirección`);
    }
});

test('el FAQ en JSON-LD coincide palabra por palabra con el FAQ visible', () => {
    const faq = jsonLd(html['index.html']).find((b) => b['@type'] === 'FAQPage');
    const seccion = html['index.html'].split('id="preguntas-frecuentes"')[1].split('</section>')[0];
    const visibles = [...seccion.matchAll(/<h3>([\s\S]*?)<\/h3>\s*(?:<\/summary>\s*)?<p>([\s\S]*?)<\/p>/g)].map((m) => [normalizar(m[1]), normalizar(m[2])]);
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
        for (const [, attr, valor] of doc.matchAll(/\s(src|href|srcset)="([^"]+)"/g)) {
            const valores = attr === 'srcset'
                ? valor.split(',').map((s) => s.trim().split(/\s+/)[0]).filter(Boolean)
                : [valor];
            for (const item of valores) {
                if (/^(https?:|tel:|mailto:)/.test(item)) { continue; }
                if (item.startsWith('#')) {
                    assert.ok(ids.has(item.slice(1)), `${p}: ancla rota ${item}`);
                    continue;
                }
                const [ruta, ancla] = item.replace(/^\//, '').split('#');
                if (ruta === '' || ruta === 'index.html') {
                    if (ancla) { assert.ok(indexIds.has(ancla), `${p}: ancla rota ${item}`); }
                    continue;
                }
                if (ruta === 'privacidad') { continue; } // redirección 308 declarada en vercel.json
                assert.ok(existsSync(new URL(ruta, raiz)), `${p}: no existe ${ruta}`);
            }
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
    const logo = imgs.find((img) => /logo-herencia/.test(img));
    const fotoHero = imgs.find((img) => /hero__photo|hotel-herencia\.(jpg|webp)/.test(img));
    assert.ok(logo, 'el hero debe mostrar el logo en PNG');
    assert.ok(fotoHero, 'el hero debe conservar la foto del hotel');
    assert.doesNotMatch(logo, /loading="lazy"/, 'el logo del hero no debe ser lazy');
    assert.match(fotoHero, /fetchpriority="high"/);
    assert.doesNotMatch(fotoHero, /loading="lazy"/, 'la imagen del hero no debe ser lazy');
    imgs.filter((img) => img !== logo && img !== fotoHero).forEach((img) => assert.match(img, /loading="lazy"/));
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
    const seccionIA = robots.split('# Buscadores con IA')[1] || '';
    assert.ok(seccionIA, 'robots.txt debe declarar el grupo de buscadores con IA');
    assert.match(seccionIA, /^Allow: \/$/m, 'los buscadores con IA deben poder rastrear el sitio');
    assert.doesNotMatch(seccionIA, /^Disallow: \/$/m, 'los buscadores con IA no deben bloquearse por completo');
    for (const bot of ['OAI-SearchBot', 'PerplexityBot', 'Claude-SearchBot', 'ChatGPT-User']) {
        assert.match(seccionIA, new RegExp(`^User-agent: ${bot}$`, 'm'), `${bot} debe estar permitido`);
    }
    // Google-Extended permanece en el grupo de entrenamiento (política actual: no alimenta Gemini/Vertex).
    const seccionEntrenamiento = robots.split('# Rastreadores de entrenamiento')[1]?.split('# Buscadores con IA')[0] || '';
    assert.match(seccionEntrenamiento, /^User-agent: Google-Extended$/m);
    assert.match(seccionEntrenamiento, /^Disallow: \/$/m);
});

test('despliegue: docs y tests no se publican; /reservar redirige temporalmente a la plataforma', () => {
    const ignorados = leer('.vercelignore').split('\n').map((l) => l.trim());
    assert.ok(ignorados.includes('docs'));
    assert.ok(ignorados.includes('tests'));
    const reservar = vercel.redirects.find((r) => r.source === '/reservar');
    assert.equal(reservar.destination, 'https://plataforma.hotelherencia.cl/reservar');
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

test('seguridad: /reservar apunta a un host fijo (sin redirección abierta), HSTS y Referrer-Policy estricta', () => {
    const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
    for (const r of vercel.redirects) {
        // Ningún destino se arma con parámetros del visitante (:path, $1, query).
        assert.doesNotMatch(r.destination, /[:$]\w|\?/, `destino dinámico en ${r.source}`);
        assert.ok(r.destination.startsWith('/') || r.destination.startsWith('https://plataforma.hotelherencia.cl/'), r.destination);
    }
    const cabeceras = Object.fromEntries(vercel.headers[0].headers.map((h) => [h.key, h.value]));
    assert.equal(cabeceras['Referrer-Policy'], 'strict-origin-when-cross-origin');
    assert.match(cabeceras['Strict-Transport-Security'], /max-age=\d{7,}/);
});

test('Hotel JSON-LD tiene los campos confirmados, tipos de schema.org y ninguna reseña autoservida', () => {
    const tiposConocidos = new Set([
        'Organization', 'ImageObject', 'WebSite', 'WebPage', 'Hotel', 'PostalAddress',
        'GeoCoordinates', 'LocationFeatureSpecification', 'HotelRoom', 'BedDetails',
        'City', 'AdministrativeArea', 'Country', 'ContactPoint', 'OpeningHoursSpecification',
        'ReserveAction', 'EntryPoint', 'FAQPage', 'Question', 'Answer', 'BreadcrumbList', 'ListItem',
    ]);
    const recogerTipos = (nodo, acc = []) => {
        if (Array.isArray(nodo)) {
            nodo.forEach((x) => recogerTipos(x, acc));
        } else if (nodo && typeof nodo === 'object') {
            if (typeof nodo['@type'] === 'string') acc.push(nodo['@type']);
            if (Array.isArray(nodo['@type'])) acc.push(...nodo['@type']);
            Object.values(nodo).forEach((v) => recogerTipos(v, acc));
        }
        return acc;
    };
    for (const p of paginas) {
        for (const bloque of jsonLd(html[p])) {
            for (const tipo of recogerTipos(bloque)) {
                assert.ok(tiposConocidos.has(tipo), `${p}: tipo schema.org no contemplado: ${tipo}`);
            }
        }
    }

    const hotel = nodo('Hotel');
    assert.equal(hotel.name, 'Hotel Herencia');
    assert.ok(!('alternateName' in hotel), 'el nombre comercial es Hotel Herencia; no se declara alternateName');
    const sitio = nodo('WebSite');
    assert.equal(sitio.name, 'Hotel Herencia');
    assert.ok(!('alternateName' in sitio), 'WebSite no debe declarar alternateName');
    const organizacion = nodo('Organization');
    assert.equal(organizacion.name, 'Herencia SpA');
    assert.equal(organizacion.legalName, 'Herencia SpA');
    assert.ok(organizacion.logo && organizacion.logo['@id']);
    assert.equal(organizacion.image, 'https://www.hotelherencia.cl/assets/img/logo-herencia-512.png');
    const logo = nodo('ImageObject');
    assert.equal(logo.caption, 'Logo de Hotel Herencia');
    const serialGrafo = JSON.stringify(grafo());
    assert.doesNotMatch(serialGrafo, /Herencia Hotel Boutique/);
    assert.equal(hotel.url, BASE);
    assert.ok(hotel.logo && hotel.logo['@id']);
    assert.ok(Array.isArray(hotel.image) && hotel.image.length >= 1);
    hotel.image.forEach((url) => {
        assert.match(url, /^https:\/\/www\.hotelherencia\.cl\/assets\/img\//);
        assert.ok(existsSync(new URL(url.replace(BASE, ''), raiz)), `imagen del schema no existe: ${url}`);
    });
    assert.deepEqual(hotel.telephone, ['+56956491501', '+56223138311']);
    assert.equal(hotel.address['@type'], 'PostalAddress');
    assert.equal(hotel.address.streetAddress, 'Calle Diego de Almagro 751');
    assert.equal(hotel.address.addressLocality, 'Chillán');
    assert.equal(hotel.address.addressRegion, 'Ñuble');
    assert.equal(hotel.address.addressCountry, 'CL');
    assert.equal(hotel.address.postalCode, '3780000');
    assert.equal(hotel.geo.latitude, -36.5983065);
    assert.equal(hotel.geo.longitude, -72.09031);
    assert.equal(hotel.checkinTime, '14:00');
    assert.equal(hotel.checkoutTime, '12:00');
    assert.equal(hotel.numberOfRooms, 17);
    assert.equal(hotel.priceRange, 'CLP 47.000 – 65.000');
    assert.equal(hotel.currenciesAccepted, 'CLP');
    assert.equal(hotel.paymentAccepted, 'Efectivo, Tarjeta, Transferencia');
    const amenidades = hotel.amenityFeature.map((a) => a.name);
    assert.deepEqual(amenidades, [
        'WiFi', 'Estacionamiento', 'Desayuno buffet', 'Aire acondicionado',
        'TV cable', 'Baño privado', 'Recepción 24 horas',
        'Habitaciones en primer piso', 'Baño adaptado',
    ]);
    const textoAmenidades = amenidades.join(' ').toLowerCase();
    for (const prohibido of ['terraza', 'servicio de habitaciones', 'servicio a la habitación', 'cocina', 'familiares']) {
        assert.ok(!textoAmenidades.includes(prohibido), `amenityFeature no debe incluir «${prohibido}»`);
    }
    assert.equal(hotel.email, 'Hotelherencia01@gmail.com');
    assert.equal(hotel.petsAllowed, true);
    const sameAs = hotel.sameAs;
    assert.ok(sameAs.includes('https://www.instagram.com/hotelherencia/'));
    assert.ok(sameAs.includes('https://maps.app.goo.gl/XYgS4ZHtKSHauBpj8'));
    const reserva = hotel.potentialAction;
    assert.equal(reserva['@type'], 'ReserveAction');
    assert.equal(reserva.target.urlTemplate, 'https://plataforma.hotelherencia.cl/reservar');
    const serializado = JSON.stringify(hotel);
    assert.doesNotMatch(serializado, /aggregateRating/);
    assert.doesNotMatch(serializado, /8,3/);
});

test('el texto público no afirma servicios contradichos ni pone valoraciones en el schema', () => {
    const cuerpo = html['index.html'].split('<body>')[1];
    const visible = normalizar(cuerpo);
    for (const prohibido of [
        'terraza en habitaciones',
        'servicio de habitaciones',
        'servicio a la habitación',
        'cocina equipada',
        'habitaciones familiares',
    ]) {
        assert.ok(!visible.toLowerCase().includes(prohibido), `el texto visible no debe afirmar «${prohibido}»`);
        for (const archivo of ['llms.txt', 'llms-full.txt']) {
            const txt = leer(archivo).toLowerCase();
            // llms-full menciona las expresiones para decir que no se afirman; solo prohibir afirmaciones positivas.
            if (archivo === 'llms-full.txt' && /no se (afirma|publican)/i.test(leer(archivo))) {
                continue;
            }
            assert.ok(!txt.includes(prohibido) || txt.includes(`no se afirma`) || txt.includes('no se publican'), `${archivo} no debe afirmar «${prohibido}»`);
        }
    }
    // Texto al huésped: Llegada/Salida, nunca «check-in»/«check-out» (los horarios del schema siguen en checkinTime/checkoutTime).
    assert.match(visible, /Llegada es a partir de las 14:00/);
    assert.match(visible, /Salida hasta las 12:00/);
    assert.doesNotMatch(visible, /check-?in|check-?out/i);
    assert.match(leer('llms.txt'), /plataforma\.hotelherencia\.cl\/reservar/);
    assert.match(leer('llms.txt'), /Nombre: Hotel Herencia$/m);
    assert.doesNotMatch(leer('llms.txt'), /Herencia Hotel Boutique/);
    assert.doesNotMatch(leer('llms-full.txt'), /Herencia Hotel Boutique/);
    assert.match(leer('robots.txt'), /Google-Extended/);
});


test('landinpage#1: cada tarjeta de habitación reserva por tipo y ningún texto promete un número de habitación', () => {
    const portada = html['index.html'];
    const enlaces = [...portada.matchAll(/<a[^>]*data-reservar-tipo="([^"]+)"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g)];
    assert.deepEqual(enlaces.map((m) => m[1]).sort(), ['doble', 'matrimonial']);
    for (const [, tipo, href, texto] of enlaces) {
        const url = new URL(href);
        assert.equal(url.origin + url.pathname, 'https://plataforma.hotelherencia.cl/reservar');
        assert.deepEqual([...url.searchParams.entries()], [['tipo', tipo]]);
        assert.equal(texto.trim(), 'Reservar este tipo');
    }
    for (const archivo of ['index.html', 'llms.txt', 'llms-full.txt']) {
        const texto = leer(archivo);
        assert.doesNotMatch(texto, /HAB-\d/, archivo);
        assert.doesNotMatch(texto, /habitaci[oó]n\s+(n[°º.]?\s*)?\d{1,3}\b/i, archivo);
    }
});
