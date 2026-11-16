# Evidencia de validación — 2026-11-16

Entorno: WSL2 (Linux 6.18), Node v24.22.1, Python 3.12.3, Google Chrome (headless) y Lighthouse 12.8.2 vía `npx`.

## Matriz de validaciones

| # | Validación | Comando o método | Resultado |
|---|---|---|---|
| 1 | Instalación de dependencias | — | **No aplica:** el proyecto no tiene dependencias ni `package.json` |
| 2 | Lint | — | **No ejecutado:** no hay linter configurado. No se agregó ESLint para no sumar dependencias. Hay revisión manual de `main.js` y `leads.js` |
| 3 | Typecheck | `node --check` implícito al cargar los módulos en los tests | Sin errores de sintaxis en `main.js` (cargado en vm) ni en `leads.js` (require) |
| 4 | Pruebas unitarias | `node --test tests/*.test.mjs` | **41/41 OK** (ver salida abajo) |
| 5 | Integración | Tests del proxy con `fetch` simulado para siteverify y el backend | Incluidos en los 41. **No** se probó contra el backend real |
| 6 | Build | — | **No aplica:** es un sitio estático sin paso de build |
| 7 | Navegación | Chrome headless `--dump-dom` y capturas de 390×1600 y 1280×900 | Renderiza correctamente. Hay 2 `<picture>` en el DOM. Hero y botones sin desbordes |
| 8 | Metadatos | `site.test.mjs` | Títulos y descripciones únicos con longitud válida, canonical absoluto y `og:url` igual al canonical |
| 9 | JSON-LD | `site.test.mjs` (parseo, `@id`, FAQ igual al texto visible, NAP, geo) | OK. **No** se ejecutó Rich Results Test ni el Schema Markup Validator (requieren navegador con sesión o un servicio externo) |
| 10 | Formulario | `main.test.mjs`: validación de nombre, correo, teléfono, fechas, noches y mensaje | OK. **No** se envió un formulario real a producción |
| 11 | Responsive | Capturas de móvil y escritorio, más el audit "viewport" de Lighthouse | OK |
| 12 | Accesibilidad | Lighthouse | 100 antes y después |
| 13 | Enlaces internos | `site.test.mjs` (src, href y srcset locales, y anclas `#id`) | OK |
| 14 | Dependencias vulnerables | — | **No aplica:** no hay dependencias de npm. El único JS de terceros es reCAPTCHA, cargado de forma diferida desde google.com |
| 15 | Lighthouse | 3 corridas por versión sobre `python -m http.server`, en el mismo equipo | Ver tabla |

## Salida de las pruebas (versión corregida)

```
$ node --test tests/*.test.mjs
ℹ tests 41
ℹ pass 41
ℹ fail 0
```

## Demostración de que las pruebas detectan los defectos

El mismo suite se corrió sobre la copia base, sin los cambios:

```
✖ Hotel: NAP coherente con el texto visible, geo numérico y sin datos inventados
✖ despliegue: docs y tests no se publican; /reservar redirige temporalmente a la plataforma
✖ registrarEvento agrega al dataLayer con event_id y conserva el id dado
✖ irAReserva registra check_availability y navega
✖ clic en WhatsApp y en teléfono generan eventos sin datos personales
ℹ pass 35
ℹ fail 5
```

El test de atribución de OSM se agregó después de esa corrida. Contra la base también falla, porque el contenedor tenía `aria-hidden` y no tenía atribución.

## Lighthouse: antes y después (sintético, mismas condiciones)

Perfil móvil por defecto de Lighthouse, con red y CPU simuladas. El servidor local **no comprime** (Vercel sí usa Brotli), así que los valores absolutos son peores que en producción. Solo vale la comparación relativa.

| Versión (mediana de 3) | Perf. | A11y | BP | SEO | FCP | LCP | CLS | TBT | Peso inicial |
|---|---|---|---|---|---|---|---|---|---|
| Antes | 95 | 100 | 100 | 92 | 1729 ms | 2792 ms | 0,001 | 0 ms | 236 KB |
| Después | 96 | 100 | 100 | 92 | 1729 ms | 2650 ms | 0,001 | 0 ms | 191 KB |

Lectura honesta:
- La mejora clara es el peso, unos 45 KB menos en la carga inicial y unos 463 KB menos para quien baja hasta el mapa.
- La diferencia en LCP (≈140 ms) está dentro de la variación normal entre corridas, porque el LCP es texto. No se afirma una mejora porcentual.
- SEO 92 se debe solo a `Content-Signal` (SEO-07).

Referencia de producción, antes del cambio (1 corrida, con Brotli y CDN): Perf. 99, LCP 1,7 s, CLS 0, TBT 0 ms y 163 KiB. **No hay datos de campo** (CrUX o RUM) disponibles.

## Pruebas activas sobre producción

Solo peticiones de lectura (GET y HEAD) a páginas, recursos y redirecciones, más un OPTIONS al endpoint de leads (respondió 405). No se hizo ningún POST, carga ni fuzzing.
