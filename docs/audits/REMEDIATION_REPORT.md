# Informe de remediación — 2026-11-16

Prioridad aplicada: integridad funcional → seguridad → indexabilidad → conversión → rendimiento → datos estructurados → analítica → publicidad.

Todos los cambios son locales: en la carpeta de trabajo y **sin commit ni despliegue**. Para publicarlos, seguir `docs/operations/DEPLOYMENT_CHECKLIST.md`.

## A. Correcciones aplicadas

### R-01 · Evitar que documentación y pruebas se publiquen en el sitio
- **Severidad:** media (preventiva). **Estado:** corregido.
- **Archivo:** `.vercelignore`.
- **Evidencia:** Vercel publica como estáticos todos los archivos del repo que no estén en `.vercelignore`. Los nuevos `docs/` (auditorías internas, backlog y riesgos) y `tests/` habrían quedado accesibles en `www.hotelherencia.cl/docs/...`.
- **Corrección:** se agregaron `docs` y `tests` a `.vercelignore`. Siguen versionados en git, pero no se despliegan.
- **Prueba:** test `despliegue…` en `tests/site.test.mjs`. **Riesgo residual:** comprobar después del deploy que `https://www.hotelherencia.cl/docs/audits/BASELINE.md` devuelve 404 (está en el checklist).

### R-02 · `/reservar` devolvía 404 en el dominio principal
- **Severidad:** media. **Estado:** corregido.
- **Archivo:** `vercel.json`.
- **Evidencia:** `curl -o /dev/null -w '%{http_code}' https://www.hotelherencia.cl/reservar` daba `404`. La plataforma (`…vercel.app/reservar`) da `200`.
- **Corrección:** redirección `permanent: false` (307) que conserva el query string.
- **Prueba:** test `despliegue…`. Después del deploy, `curl -sI https://www.hotelherencia.cl/reservar` debe dar 307 con `location` hacia la plataforma.

### R-03 · Botón "Hablar con recepcionista" llevaba al formulario
- **Severidad:** baja (conversión). **Estado:** corregido.
- **Archivo:** `index.html`, hero.
- **Evidencia:** había dos botones primarios seguidos que llevaban al mismo `#contacto` ("Consultar reserva" y "Hablar con recepcionista"). El segundo prometía hablar con una persona y abría un formulario.
- **Corrección:** el botón ahora es "Hablar con recepción por WhatsApp" y abre `https://wa.me/56956491501`, el mismo número publicado en el sitio. "Consultar reserva" sigue llevando al formulario o a la plataforma.
- **Prueba:** test de enlaces de `site.test.mjs` y eventos `contact_whatsapp` en `main.test.mjs`. Revisión visual en móvil y escritorio.

### R-04 · El mapa (renderizado de OpenStreetMap) no tenía atribución
- **Severidad:** media (licencia). **Estado:** corregido.
- **Archivos:** `index.html` y `assets/css/styles.css`.
- **Evidencia:** `assets/img/maps.png` tiene el estilo OSM Carto, con etiquetas de calles de Chillán y la tipografía y colores de openstreetmap.org. La licencia ODbL exige mostrar "© colaboradores de OpenStreetMap". Además, el contenedor tenía `aria-hidden="true"`, que ocultaba la imagen y su `alt` a los lectores de pantalla.
- **Corrección:**
  - El `div.map-card` pasa a ser un `figure`, con un `figcaption` que enlaza a `openstreetmap.org/copyright`.
  - Se quitó `aria-hidden`.
  - Se usó el color existente `--ink-muted`.
- **Prueba:** test `el mapa… ODbL` y Lighthouse accesibilidad 100. **Riesgo residual:** si la imagen no viene de OSM, la atribución sobra y no causa daño. Confirmar con quien la generó.

### R-05 · Imágenes en formato moderno
- **Severidad:** baja (rendimiento). **Estado:** corregido.
- **Archivos:** `assets/img/hotel-herencia.webp` y `assets/img/maps.webp` (nuevos), `index.html` y `styles.css` (`picture { display:block }`).
- **Evidencia:** Lighthouse "modern-image-formats" estimaba 53 KB de ahorro en el hero. El mapa pesaba 560 KB en PNG.
- **Corrección:** `<picture>` con fuente WebP y el JPEG o PNG original como respaldo. Se mantienen `width`, `height`, `fetchpriority="high"` en el hero y `loading="lazy"` en el mapa.
- **Resultado medido:** hero de 95 KB a 47 KB y mapa de 560 KB a 97 KB. En Lighthouse local (mediana de 3), el peso inicial bajó de 236 KiB a 191 KiB. LCP, CLS y TBT **sin cambio significativo**, porque el LCP es el `<h1>` de texto. Ver `VALIDATION_EVIDENCE.md`.

### R-06 · `geo` en el JSON-LD del hotel
- **Severidad:** baja. **Estado:** corregido. El detalle está en `SEO_AUDIT.md` (SEO-05).

### R-07 · Capa de eventos de medición desacoplada
- **Severidad:** media (no había medición de conversiones). **Estado:** corregido, **inactivo hasta instalar un contenedor**.
- **Archivo:** `assets/js/main.js`, con las funciones `registrarEvento`, `irAReserva` y un listener delegado de clics.
- **Diseño:**
  - Solo hace `window.dataLayer.push(...)`. No carga GA4, GTM ni píxeles, así que hoy **ningún dato sale del navegador**.
  - No incluye nombre, correo, teléfono, fechas ni mensaje. Cada evento lleva un `event_id`. En `generate_lead`, el `event_id` es la misma `Idempotency-Key` del envío, para que una plataforma pueda descartar duplicados.

| Evento | Cuándo se dispara (solo acciones reales) | Campos |
|---|---|---|
| `generate_lead` | El proxy responde 200 o 201 al guardar una consulta, ya sea desde el formulario o desde "Ver disponibilidad" | `event_id` (Idempotency-Key), `origen` |
| `check_availability` | Toda navegación a `/reservar` de la plataforma: el botón, los CTA con fechas y el enlace "Continuar con la reserva" | `event_id`, `destino` |
| `contact_whatsapp` | Clic en cualquier enlace `wa.me` | `event_id`, `ubicacion` (id de la sección) |
| `contact_phone` | Clic en cualquier enlace `tel:` | `event_id`, `ubicacion` |

- **No implementados, a propósito:**
  - `view_room` y `select_room`: no existe una página ni una selección de habitación.
  - `begin_checkout` y `purchase`: el pago y la confirmación ocurren en la plataforma externa. `purchase` solo debe enviarse desde ahí, cuando la reserva queda confirmada de forma verificable.
- **Prueba:** 4 tests en `tests/main.test.mjs`, incluido uno que verifica que `main.js` no contiene `gtag`, `fbq`, GTM ni GA.
- **Riesgo residual:** al navegar a la plataforma, un futuro GTM debe usar beacon (`transport_type: beacon`) para no perder `check_availability`. Antes de activar GTM o GA4 hay que agregar el consentimiento y actualizar `privacidad.html`. Desde el 1-12-2026 rige la Ley 21.719.

### R-08 · No había pruebas automatizadas
- **Severidad:** media. **Estado:** corregido.
- **Archivos:** `tests/leads.test.mjs` (14), `tests/main.test.mjs` (15) y `tests/site.test.mjs` (12).
- **Detalle:**
  - Usan `node:test` sin dependencias. Se ejecutan con `node --test tests/*.test.mjs`.
  - No se agregó `package.json`, porque podría alterar cómo Vercel construye un sitio estático.
- **Demostración fallo → corrección:** el mismo suite corrido sobre la copia base sin cambios da **5 fallos**: geo, despliegue y los 3 de eventos. Sobre la versión corregida da **41/41**.

## B. Hallazgos verificados sin defecto (se dejan igual)

| Área | Verificado |
|---|---|
| Proxy de leads | Sin verificación exitosa de reCAPTCHA (acción `consulta`, hostname permitido, antigüedad ≤120 s, puntaje opcional) **no se llama al backend**. El secreto solo viaja a siteverify. Límite de cuerpo de 8 KB (413), `Idempotency-Key` obligatoria, `redirect: 'error'`, timeouts y errores genéricos sin detalle interno. Hay 14 tests |
| XSS | `main.js` escribe estados con `textContent` y `createTextNode`, nunca con `innerHTML`. La referencia opaca se valida con `^[A-Za-z0-9_-]{20,128}$` antes de ponerla en la URL |
| Datos personales en URL | La URL de `/reservar` solo lleva fechas, número de personas y la referencia opaca (test). El formulario usa `method="post"` y JS con `preventDefault` |
| CORS | El proxy no emite `Access-Control-Allow-Origin`, así que solo se puede usar desde el mismo origen. Correcto |
| CSRF | No aplica en sentido clásico: no hay sesión ni cookies de autenticación. El abuso se mitiga con reCAPTCHA más la Idempotency-Key |
| Cabeceras | CSP con hash, `frame-ancestors 'none'`, XFO DENY, nosniff, Referrer-Policy, Permissions-Policy y HSTS (Vercel) |
| Mensajes | El sitio repite que enviar **no confirma** la estadía (datos clave, FAQ y aviso del formulario). Hay un test que impide textos como "reserva confirmada" |
| Accesibilidad | Lighthouse 100 antes y después. Los campos tienen `<label>`, los estados usan `role="status"`/`aria-live` y `role="alert"`, y los carruseles tienen botones con `aria-label` y `aria-pressed` |

## C. Pendientes (requieren intervención humana o acceso)

| ID | Severidad | Pendiente | Qué se necesita |
|---|---|---|---|
| P-01 | Media | La afirmación "8,3 puntos en Booking" no se puede verificar (SEO-10) | Confirmarla y fecharla, o quitarla |
| P-02 | Media | No se puede comparar la numeración de la dirección con el GBP (SEO-06) | Revisar el GBP y la documentación legal |
| P-03 | Media | Sin rate limiting propio en el proxy. Se apoya en reCAPTCHA y en un posible 429 del backend, que no se pudo verificar | Confirmar que el backend aplica límites por IP o clave. Si no, evaluar Vercel WAF (regla de rate limit sobre `/api/publico/leads`) |
| P-04 | Baja | El proxy reenvía el token de reCAPTCHA al backend. Si el backend lo vuelve a verificar, Google responde `timeout-or-duplicate`, porque el token es de un solo uso | Revisar el código del backend (no está en este repo) |
| P-05 | Baja | Capacidad: el HTML limita huéspedes a 8 (`max="8"`), pero el JS y la plataforma aceptan hasta 30 | Definir la capacidad real y alinear ambos |
| P-06 | Baja | `style-src 'unsafe-inline'` en la CSP. No hay estilos inline propios, pero reCAPTCHA los inyecta | Mantener. Si se reemplaza reCAPTCHA, retirarlo |
| P-07 | Baja | CSS y JS con `Cache-Control: max-age=0` (valor por defecto de Vercel) | Agregar huella al nombre (`styles.<hash>.css`) antes de usar caché larga. Hoy no hay build que lo haga |
| P-08 | Baja | Google Fonts bloquea el render (~0,8 s en la prueba local sin caché) | Alojar las fuentes en el propio sitio (woff2 en `/assets/fonts`) y ajustar `font-src` y `style-src` de la CSP. Va en el backlog |
| P-09 | Baja | `og:image` pequeña y favicon < 48 px (SEO-08) | Material gráfico del dueño |
| P-10 | — | Datos comerciales: check-in y check-out, tarifas, cancelación, mascotas, pagos, costo de estacionamiento | El dueño debe entregarlos. Habilitan FAQ, schema y páginas de habitación |

## D. Backlog priorizado

| # | Tarea | Impacto | Esfuerzo | Dependencia | Evidencia |
|---|---|---|---|---|---|
| 1 | Desplegar esta ronda y verificar en producción | Medio | Bajo | Autorización | Este informe |
| 2 | Resolver P-01 y P-02 (nota de Booking y dirección) | Alto (confianza y NAP local) | Bajo | Dueño | SEO-06, SEO-10 |
| 3 | Entregar los datos de P-10 y publicar FAQ y schema de políticas | Alto (AEO, Google Hotels) | Bajo | Dueño | SEO-09 |
| 4 | Revisar Search Console: cobertura, "Search generative AI" en Incluir y sitemap enviado | Medio | Bajo | Acceso GSC | — |
| 5 | Confirmar rate limiting y re-verificación del token en el backend (P-03, P-04) | Medio (seguridad) | Bajo | Acceso al repo del backend | — |
| 6 | Instalar GTM con consentimiento y GA4 que lea el `dataLayer` | Medio (medición) | Medio | Cuenta de Google, política de privacidad | R-07 |
| 7 | Google Hotels: Free Booking Links mediante un socio de integración | Alto (reserva directa) | Medio o alto | Proveedor, Hotel Center | `docs/integrations/GOOGLE_HOTELS.md` |
| 8 | Páginas `/habitaciones/<slug>/` cuando haya contenido propio | Medio | Medio | Datos y fotos | SEO-04 |
| 9 | Fuentes en el propio sitio (P-08) e imagen OG de 1200×630 (P-09) | Bajo | Bajo | — / fotos | Lighthouse |
