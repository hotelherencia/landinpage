# Línea base — Hotel Herencia (www.hotelherencia.cl)

Fecha: 2026-11-16. Medido antes de los cambios de esta ronda. La copia exacta del estado inicial quedó fuera del repo, en el respaldo local de la sesión.

## 1. Arquitectura identificada

| Elemento | Hallazgo | Evidencia |
|---|---|---|
| Tipo de sitio | Landing estática de una página: HTML, CSS y JS sin framework, sin build ni gestor de paquetes | No hay `package.json`, ni lockfile ni configuración de bundler. Archivos: `index.html`, `privacidad.html`, `404.html` |
| Lenguajes | HTML5, CSS, JavaScript de navegador (script clásico con `defer`) y una función Node (CommonJS) | `assets/js/main.js`, `api/publico/leads.js` |
| Hosting y CDN | Vercel: cabeceras, redirecciones y una Vercel Function | `vercel.json`; cabecera `server: Vercel`; GitHub informa estado "Vercel success" en el commit `73a7639` |
| Repositorio | GitHub `hotelherencia/landinpage`, rama única `main` | `git ls-remote`: solo `refs/heads/main` = `73a7639` |
| Copia de trabajo | La carpeta local no es un repositorio git. El clon con git está en `~/herencia-git/landinpage` y se publica con `push_landing.sh` | `diff -rq` entre carpeta y clon: sin diferencias al inicio |
| API | `POST /api/publico/leads`: proxy que verifica reCAPTCHA v3 y reenvía a `https://servicio-production-a2d7.up.railway.app/publico/leads` | `api/publico/leads.js` |
| Plataforma de reservas | Aplicación externa `https://plataforma-salman-herencia-oficial.vercel.app/reservar` (fuera de este repo). La landing envía ahí fechas, número de personas y una referencia opaca | `main.js: enlaceContinuarReserva()`. La página responde 200 |
| Backend de leads | Servicio en Railway (fuera de este repo) | Constante `DESTINO` |
| Antispam | Google reCAPTCHA v3: clave de sitio en `main.js` y secreto en la variable de entorno `RECAPTCHA_SECRET_KEY` de Vercel | Valor del secreto no inspeccionado |
| Variables de entorno | `RECAPTCHA_SECRET_KEY`, `RECAPTCHA_MIN_SCORE` (opcional) y `RECAPTCHA_HOSTNAMES` (opcional) | Solo se leyeron los nombres en el código. No existe `.env` local |
| DNS | El apex `hotelherencia.cl` redirige con 308 a `www`; http redirige con 308 a https | `curl -sI` |
| Analítica | No hay GA4, GTM, Google Ads ni Meta Pixel, ni banner de cookies | `grep` sin resultados en HTML y JS |
| Search Console | Archivo de verificación por HTML presente: `google582f5ba41531a901.html` (responde 200, con `noindex`) | Archivo y cabecera |
| CI/CD | No hay workflows de GitHub. Vercel despliega al hacer push a `main` | No existe `.github/` |
| Pruebas, linters | No había ninguna prueba, linter ni validador en el repo | Inventario de archivos |
| Dependencias | Ninguna, así que no aplica `npm audit` | No hay `package.json` |

## 2. Estado funcional verificado en producción (solo lectura)

| Comprobación | Resultado |
|---|---|
| `https://www.hotelherencia.cl/` | 200, Brotli (9,3 KB transferidos) y HSTS `max-age=63072000` |
| Redirecciones http→https, apex→www, `/index.html`→`/`, `/privacidad`→`/privacidad.html` | 308 en todos los casos |
| Ruta inexistente | 404 real, con `404.html` y `noindex` |
| `/reservar` en el dominio principal | **404** (ver SEO-03) |
| `/api/publico/leads` con GET u OPTIONS | 405, `Allow: POST` |
| CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy | Presentes. El hash CSP coincide con el script inline |
| Archivos locales y archivos publicados | Idénticos byte a byte (10 archivos comparados) |

No se envió ningún formulario real a producción, para no crear leads falsos.

## 3. Rendimiento (sintético, Lighthouse 12.8.2, perfil móvil, Chrome headless en WSL)

| Escenario | Perf. | A11y | Buenas prácticas | SEO | FCP | LCP | CLS | TBT | Peso |
|---|---|---|---|---|---|---|---|---|---|
| Producción (1 corrida) | 99 | 100 | 100 | 92 | 1,7 s | 1,7 s | 0 | 0 ms | 163 KiB |
| Copia local, servidor Python sin compresión (mediana de 3) | 95 | 100 | 100 | 92 | 1,73 s | 2,79 s | 0,001 | 0 ms | 236 KiB |

Son mediciones de laboratorio, no de campo. No hubo acceso a CrUX ni a datos de usuarios reales. El elemento LCP es el `<h1>` (texto), no la imagen. SEO marca 92 por una sola causa: Lighthouse no reconoce la directiva `Content-Signal` de `robots.txt` (ver SEO-07).

## 4. Hallazgos confirmados

Están en `SEO_AUDIT.md` y `REMEDIATION_REPORT.md`, con su identificador, severidad y evidencia.

## 5. Riesgos y dependencias

- **Despliegue directo a producción:** cada push a `main` publica. No hay entorno de staging ni CI que bloquee.
- **Sistemas externos fuera del repo:** la plataforma de reservas en Vercel y el backend de leads en Railway. Su inventario, disponibilidad, confirmación, correo y rate limiting **no se pueden verificar desde aquí**.
- **`push_landing.sh`** tiene escrito a mano el mensaje del commit de la ronda anterior. Si se reutiliza sin editarlo, el commit queda con una descripción falsa.

## 6. Capacidades no verificables por falta de acceso

- Google Business Profile: dirección registrada, horario, categorías, fotos y reseñas. El HTML de Maps se arma con JS y no expone la dirección.
- Search Console: indexación, cobertura, control "Search generative AI" e informes de rendimiento.
- Panel de Vercel: variables de entorno, logs, deployments anteriores y Analytics o Speed Insights.
- Backend de leads y plataforma de reservas: respuestas reales, rate limiting (el cliente maneja 429, pero no se pudo comprobar), correo y PMS o channel manager.
- La nota de Booking ("8,3 puntos") y cualquier dato comercial que no esté en el sitio: tarifas, capacidad, horarios de check-in y check-out, mascotas, medios de pago.
