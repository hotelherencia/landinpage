# Auditoría SEO, GEO y AEO — 2026-11-16

Alcance: `index.html`, `privacidad.html`, `404.html`, `robots.txt`, `sitemap.xml`, `llms.txt`, `vercel.json` y las respuestas de producción en `https://www.hotelherencia.cl`.

Estados posibles: **confirmado** (defecto real y abierto), **corregido**, **pendiente** (depende del negocio) y **no verificable**.

## Resumen

El sitio ya estaba en buen estado técnico tras las rondas SEO, IA y bots anteriores:
- La URL canónica es la versión con `www`, con redirecciones 308 coherentes.
- Hay sitemap con imágenes, 404 real, títulos y descripciones únicos, Open Graph, `lang="es-CL"` y JSON-LD válido, con un FAQ que coincide palabra por palabra con el texto visible.
- El contenido responde las preguntas típicas: dónde está, servicios, estacionamiento, desayuno, habitaciones, cómo reservar y que enviar el formulario no confirma la estadía.

Los hallazgos de esta ronda son menores.

## Hallazgos

### SEO-01 · Dominio canónico: `www` frente al apex
- **Severidad:** informativa. **Estado:** confirmado como decisión, sin cambios.
- **Evidencia:** `https://hotelherencia.cl/` responde 308 hacia `https://www.hotelherencia.cl/`. El canonical, el sitemap, `og:url` y los `@id` del JSON-LD usan `www`.
- **Causa:** Vercel tiene `www` como dominio principal.
- **Decisión:** el pedido proponía `https://hotelherencia.cl/#hotel` como `@id`. **No se cambió.** Un `@id` no es una URL que se visite, pero cambiarlo fragmenta la entidad que Google ya leyó, y debe ser coherente con el canonical. Se mantiene `https://www.hotelherencia.cl/#hotel`.
- **Riesgo residual:** ninguno, siempre que el apex siga redirigiendo con 308.

### SEO-02 · Indexación y rastreo
- **Severidad:** informativa. **Estado:** verificado sin defectos.
- **Evidencia:**
  - http→https y apex→www con 308.
  - Ruta inexistente: 404 con `noindex`.
  - Sin `noindex` en páginas indexables.
  - `/api/` lleva `X-Robots-Tag: noindex, nofollow` y está bloqueada en robots.
  - El sitemap solo contiene las 2 URLs canónicas y 10 imágenes que existen.
  - No hay páginas huérfanas: `privacidad.html` se enlaza desde el pie y desde el aviso del formulario.
  - Todo el contenido está en el HTML servido: el JS solo agrega interacción.
- **Prueba:** `tests/site.test.mjs` revisa enlaces, anclas, sitemap, robots y `noindex`.

### SEO-03 · `/reservar` daba 404 en el dominio principal
- **Severidad:** media. **Estado:** corregido.
- **Evidencia:** `curl https://www.hotelherencia.cl/reservar` devolvía 404. La reserva vive en la plataforma (`…vercel.app/reservar`, que responde 200). Quien escribe o comparte `hotelherencia.cl/reservar` llegaba a un error.
- **Corrección:** redirección **temporal** (307) en `vercel.json` hacia la plataforma. Vercel conserva el query string, así que `?inicio=&fin=&personas=` pasa intacto. Es temporal para no traspasar señales de ranking a un dominio `vercel.app` que podría cambiar.
- **Prueba:** `site.test.mjs`, test "despliegue…". **Riesgo residual:** si cambia la URL de la plataforma, hay que actualizar `vercel.json` y `main.js`.

### SEO-04 · Arquitectura de URLs: páginas separadas por habitación o sección
- **Severidad:** informativa. **Estado:** evaluado; **no se crearon páginas**.
- **Evidencia:**
  - Hay 2 tipos de habitación y cada uno tiene solo nombre, tipo de cama y 2 fotos.
  - No hay superficie, capacidad, tarifas, equipamiento detallado, políticas ni horarios.
- **Causa:** `/habitaciones/[slug]/`, `/servicios/`, `/ubicacion/` o `/alojamiento-empresas-chillan/` repetirían el mismo texto de la home. Eso es contenido escaso o duplicado, el tipo de página puerta (*doorway*) que el propio pedido prohíbe.
- **Condición para crearlas:** que el negocio entregue, para cada habitación, capacidad máxima, metros cuadrados, equipamiento, fotos propias (≥4), política de cancelación y condiciones. Con eso, `/habitaciones/<slug>/` sí tendría contenido único. Ver el backlog en `REMEDIATION_REPORT.md`.

### SEO-05 · Datos estructurados
- **Severidad:** baja. **Estado:** corregido (geo) y pendiente (resto).
- **Evidencia:** el grafo `@graph` ya incluía Organization, ImageObject, WebSite, WebPage y Hotel, con `containsPlace` (HotelRoom ×2). FAQPage va en un bloque aparte. Las referencias `@id` se resuelven y hay un solo nodo Hotel. Faltaba `geo`.
- **Corrección:** `geo` = `-36.5983065, -72.09031`, tomado del pin de la ficha de Google Maps "Hotel Herencia" a la que el sitio ya enlaza (`hasMap`), en los parámetros `!3d` y `!4d` de la URL resuelta. Como contraste independiente, la geocodificación inversa en OpenStreetMap ubica ese punto **en calle Diego de Almagro**, junto al n.º 739 (Escuela Quilamapu). Eso es coherente con el n.º 751 publicado.
- **Pendiente (requiere dato del negocio):** `checkinTime` y `checkoutTime`, `priceRange`, `petsAllowed`, `paymentAccepted`, `numberOfRooms`, `occupancy` por HotelRoom, `postalCode` y `email`. **No se agregan** `Offer`, `aggregateRating`, `starRating` ni reseñas: no hay tarifas publicadas, y la nota de Booking es de un tercero.
- **Prueba:** `site.test.mjs` revisa la validez del JSON-LD, que las referencias existan, la coherencia NAP entre texto visible, schema, `llms.txt` y `404.html`, que geo esté en Chillán y que no haya propiedades inventadas.

### SEO-06 · Discrepancia en la numeración de la dirección
- **Severidad:** media. **Estado:** no verificable.
- **Evidencia:**
  - Todo el sitio usa "Calle Diego de Almagro 751": texto visible, JSON-LD, pie, `llms.txt`, 404 y política.
  - El pin de la ficha de Maps cae en esa calle, cerca del 739, lo que es coherente.
  - La dirección textual de la ficha de Google Business Profile no se pudo leer sin sesión, porque Maps la arma con JS.
  - El domicilio legal de Herencia SpA (5 de Abril 441, of. 3) es **otra entidad** (Organization) y está bien separado.
- **Acción humana:** comparar la dirección del GBP, Booking, Instagram y otros directorios con la escritura o patente municipal, y unificarla en todos. Si la correcta no es 751, basta con cambiarla en: `index.html` (4 lugares visibles + JSON-LD + FAQ), `404.html`, `llms.txt` y `privacidad.html`. El test de NAP falla si quedan inconsistentes.

### SEO-07 · `robots.txt`: Lighthouse marca "Unknown directive" en `Content-Signal`
- **Severidad:** baja. **Estado:** confirmado y aceptado.
- **Evidencia:** Lighthouse da SEO 92, y la única auditoría fallida es `robots-txt` en la línea 10.
- **Causa:** `Content-Signal` es una propuesta (contentsignals.org) que el dueño aprobó en la ronda anterior para declarar `ai-train=no`. El parser de Google ignora las líneas que no reconoce y aplica el resto del grupo, así que **no afecta el rastreo**.
- **Opción:** si se prefiere el 100 en Lighthouse, quitar esa línea. La política de entrenamiento sigue aplicándose por los bloqueos por user-agent y por `TDM-Reservation`.

### SEO-08 · Metadatos sociales e íconos
- **Severidad:** baja. **Estado:** pendiente; requiere material del dueño.
- **Evidencia:**
  - `og:image` mide 475×476. Para `summary_large_image` conviene una imagen de 1200×630 o más.
  - El favicon solo existe como `.ico` y no hay `apple-touch-icon`. Google pide un favicon cuadrado de al menos 48 px, en múltiplos de 48.
- **Acción:** que el dueño entregue una foto horizontal de alta resolución y un logo en PNG o SVG. No se escalaron imágenes pequeñas, porque perderían calidad.

### SEO-09 · GEO y AEO (buscadores con IA)
- **Severidad:** informativa. **Estado:** verificado.
- **Evidencia:**
  - Las respuestas están en el HTML indexable: sección "Datos clave", encabezados en forma de pregunta y un FAQ de 11 preguntas.
  - Hay fecha de revisión visible.
  - `robots.txt` permite Googlebot y los buscadores con IA que citan fuentes (OAI-SearchBot, PerplexityBot, Claude-SearchBot…) y bloquea los rastreadores de entrenamiento.
  - `llms.txt` se mantiene con `noindex` y la nota explícita de que no es una señal de Google. No se agregaron más archivos "para IA", porque no tienen un beneficio demostrable.
- **Brecha de contenido:** faltan respuestas a "¿a qué hora es el check-in?", "¿aceptan mascotas?", "¿medios de pago?", "¿el estacionamiento tiene costo?" y "¿política de cancelación?". Hacen falta los datos del negocio.

### SEO-10 · Afirmación "8,3 puntos en Booking" en el hero
- **Severidad:** media. **Estado:** no verificable.
- **Evidencia:** `index.html`, tarjeta `hero__media-stat--bottom`. Es un dato de terceros que cambia con el tiempo, y desde aquí no se pudo confirmar.
- **Acción:** confirmar la nota vigente en el extranet de Booking, actualizarla y fecharla ("8,3 en Booking, nov. 2026"), o quitarla. No va al schema, a propósito.

## Actualización (misma fecha, datos del paquete 11-11 / Anexo A)

Con los datos confirmados del hotel se completó lo que estaba pendiente en SEO-05 y parte de SEO-09, y se corrigieron afirmaciones que contradecían el inventario (POL-001):

- El JSON-LD de `Hotel` ahora incluye `checkinTime` 14:00, `checkoutTime` 12:00, `numberOfRooms` 17, `priceRange` referencial `CLP 47.000 – 65.000`, `paymentAccepted`, `ReserveAction` hacia `https://plataforma.hotelherencia.cl/reservar` y amenidades solo confirmadas (WiFi, estacionamiento, desayuno buffet, aire acondicionado, TV cable, baño privado, recepción 24 horas). Siguen fuera `Offer`, `aggregateRating`, `starRating`, `petsAllowed`, `email` y `postalCode`.
- El FAQ visible (y su JSON-LD, que debe coincidir palabra por palabra) incorpora horarios, medios de pago y la regla de abono. Se dejó de afirmar terraza en habitaciones, servicio a la habitación, cocina equipada y habitaciones familiares.
- Sigue pendiente: mascotas, costo del estacionamiento, política de cancelación (fuentes en contradicción), autorización para publicar tarifas exactas por tipo, correo, código postal y la nota «8,3 en Booking» (SEO-10).
- El detalle operativo y el checklist de GBP / Hotel Center están en `docs/integrations/GOOGLE_HOTELS.md`.
