# Google Business Profile y Google Hotels — preparación técnica

Estado al 2026-11-16: **no hay ninguna integración activa con Google Hotels.** El sitio ya publica los datos estructurales que Google Hotels y el perfil de empresa pueden reutilizar (horarios, rango referencial, habitaciones, servicios confirmados y enlace de reserva). Falta lo que solo se configura fuera del código: ficha de Google Business Profile (GBP), Hotel Center y un feed de precios. No se usaron APIs privadas ni credenciales, y no se inventaron endpoints.

> Los requisitos de Google cambian. Antes de activar cualquier cosa, revisar la documentación oficial vigente: Ayuda de Google Hotel Center, *Free booking links*, y Ayuda de Google Ads, *Hotel campaigns*. Lo que sigue es la arquitectura general y debe confirmarse con esas fuentes y con el proveedor elegido.

## 1. Lo que existe hoy (verificado)

| Elemento | Estado | Evidencia |
|---|---|---|
| Ficha de Google Maps "Hotel Herencia" | Existe; pin en Diego de Almagro, Chillán | `https://maps.app.goo.gl/XYgS4ZHtKSHauBpj8` resuelve al place id `0x9668d62dba7c71c5:0x6caffe1ed4a91abf` |
| Sitio oficial | `https://www.hotelherencia.cl/` | Canonical y JSON-LD `Hotel` con `@id` `https://www.hotelherencia.cl/#hotel` |
| NAP en el sitio | Hotel Herencia · Calle Diego de Almagro 751, Chillán · +56 9 5649 1501 | Coherente en todo el sitio (test automático) |
| Datos estructurados | `Hotel` con dirección, geo, teléfono, logo, `image[]`, `checkinTime` 14:00, `checkoutTime` 12:00, `numberOfRooms` 17, `priceRange` referencial `CLP 47.000 – 65.000`, servicios confirmados, `ReserveAction` a la plataforma, 2 `HotelRoom` (sin `Offer`) y FAQ idéntico al texto visible | `index.html` |
| Motor de reservas | Plataforma propia `https://plataforma.hotelherencia.cl/reservar`, que recibe fechas (`llegada` / `salida`), personas y una referencia opaca | `main.js` y redirección `/reservar`. Su lógica de inventario, tarifas y confirmación **no está en este repo** |
| Tarifas y disponibilidad públicas (ARI) | **No existen** en un feed. El schema solo declara un rango referencial, no una oferta reservable | — |
| Política de cancelación publicada | **No se publica**: las fuentes internas se contradicen (24 h / estadía completa frente a 48 h / primera noche) | Documento de dudas, contradicción 1 |
| IDs estables de habitaciones y tarifas | **No existen** en el sitio | — |

## 2. Free Booking Links y Hotel Ads

| | **Free Booking Links** (enlaces de reserva gratuitos) | **Hotel Ads** (anuncios de hotel) |
|---|---|---|
| Qué es | Listados orgánicos, sin costo por clic, en el módulo de precios de Google (Search y Maps) | Anuncios pagados en el mismo módulo, gestionados con campañas de hotel en Google Ads |
| Costo | Sin costo por clic. El proveedor de conectividad puede cobrar | Pago por clic, comisión o conversión, según la campaña |
| Requisitos | Ficha GBP verificada y vinculada en Hotel Center, más precios y disponibilidad enviados por un **socio de integración** (motor de reservas o channel manager) o un feed propio aprobado | Lo mismo, más una cuenta de Google Ads vinculada a Hotel Center, presupuesto y precisión de precios sostenida |
| Prerrequisito clave | Precios **exactos** que coincidan con la página de reserva (Google audita la precisión) | Igual, y además seguimiento de conversiones |
| Para Hotel Herencia | **Primer paso recomendado** | Solo después de que FBL funcione y haya medición |

Sin un feed de precios, igual se puede mostrar el **enlace al sitio oficial** y un enlace de reserva en la ficha (campos del GBP). Eso no es Google Hotels ni habilita Free Booking Links.

**Eligibilidad de Free Booking Links:** hace falta una cuenta de Hotel Center vinculada al GBP, más un feed de precios (ARI) o un socio de conectividad certificado. El JSON-LD y el enlace `ReserveAction` no sustituyen ese feed.

## 3. Arquitectura propuesta

```
Google Business Profile (ficha verificada)
          │ vinculada
Google Hotel Center ◄── feed ARI (precios, disponibilidad, restricciones)
          │                       ▲
          │                       │ API del socio de integración
          ▼                       │
Módulo de precios ──clic──► Página de reserva con precio idéntico
(Search/Maps)               (https://plataforma.hotelherencia.cl/reservar
                             o el motor del socio)
```

Dos caminos:

1. **Recomendado: un socio de integración certificado por Google** (motor de reservas o channel manager con conexión a Google Hotels). Él publica el ARI y hospeda o enlaza la página de reserva. Requiere que la plataforma actual sea ese motor o se conecte con él.
2. **Integración propia:** la plataforma de reservas genera el feed ARI y la *Hotel List* y se certifica directamente. Supone control de inventario transaccional, reglas de tarifa y alta precisión de precios. **No es viable** mientras no exista inventario centralizado verificado.

En este repo **no se implementó ningún conector**. La landing no tiene inventario transaccional. La pieza útil desde aquí es la redirección `/reservar`, que sirve como *landing page* de reserva en el dominio oficial y conserva los parámetros (`llegada`, `salida`, `personas`; los enlaces antiguos con `inicio`/`fin` siguen funcionando).

### Contrato mínimo que la plataforma debe aceptar para ser destino de Google Hotels

- `GET /reservar?llegada=YYYY-MM-DD&salida=YYYY-MM-DD&personas=N[&habitacion=<id>&tarifa=<id>]`: hoy acepta `llegada`, `salida`, `personas`, `ref` y los alias `inicio`/`fin`. Faltan los IDs de habitación y tarifa.
- Debe mostrar el **mismo precio total**, con impuestos, que el enviado a Google.
- IDs estables por tipo de habitación y por plan tarifario.
- Política de cancelación visible antes de pagar (hoy no se puede publicar: las fuentes se contradicen).

## 4. Checklist de Google Business Profile y Hotel Center

Responsable: dueño o administración. Nada de esto se puede completar solo con un cambio en el repo.

### Ficha de Google Business Profile

- [ ] Verificar la ficha (si aún no lo está) y que el dueño o la administradora tengan acceso de titular.
- [ ] Nombre idéntico al del sitio: **Hotel Herencia**. El logo histórico incluye la leyenda «Hotel Boutique»; el nombre comercial es Hotel Herencia, no un segundo negocio.
- [ ] Dirección idéntica: **Calle Diego de Almagro 751, Chillán**. Comparar con la escritura o patente municipal (el pin de Maps cae cerca del n.º 739).
- [ ] Teléfono idéntico: **+56 9 5649 1501**.
- [ ] Sitio web: `https://www.hotelherencia.cl/`.
- [ ] Enlace de reserva / cita: `https://plataforma.hotelherencia.cl/reservar`.
- [ ] Categoría principal: **Hotel**. No usar solo «Alojamiento» o «Bed and breakfast» como categoría principal.
- [ ] Atributos del hotel alineados con lo confirmado: WiFi, estacionamiento, desayuno, aire acondicionado, recepción 24 horas, TV. **No marcar** terraza en habitaciones, servicio a la habitación ni cocina para huéspedes hasta que la administración lo confirme.
- [ ] Horario de check-in **14:00** y check-out **12:00**.
- [ ] Fotos: fachada, habitaciones, desayuno, estacionamiento y espacios comunes (calidad alta, sin marcas de agua). El `og:image` actual mide 475×476; conviene una foto horizontal de 1200×630 o más para el sitio y para la ficha.
- [ ] Horario de atención de la recepción: 24 horas.
- [ ] No pegar en la ficha la nota «8,3 en Booking» como si fuera una calificación de Google.

### Search Console y datos estructurados

- [ ] Propiedad de dominio verificada (ya existe el archivo `google582f5ba41531a901.html`).
- [ ] Enviar `https://www.hotelherencia.cl/sitemap.xml` y pedir la indexación de la home tras el despliegue.
- [ ] Configuración › Search generative AI = Incluir (AI Overviews / AI Mode usan Googlebot; no hace falta desbloquear `Google-Extended`).
- [ ] Probar la home en la [Prueba de resultados enriquecidos](https://search.google.com/test/rich-results) y en el [validador de schema.org](https://validator.schema.org/).
- [ ] Revisar el informe de rendimiento y el de Generative AI performance cuando esté disponible.

### Hotel Center (Free Booking Links)

- [ ] Crear o reclamar la cuenta de Hotel Center.
- [ ] Vincular el GBP verificado.
- [ ] Elegir un socio de conectividad certificado **o** un feed propio de lista de hotel + ARI (precios, disponibilidad, restricciones).
- [ ] La página de destino debe mostrar el **mismo precio** que el feed.
- [ ] Recién entonces activar Free Booking Links.
- [ ] Hotel Ads (Google Ads) solo después, con medición y precisión de precios sostenida. Ver `docs/marketing/ACQUISITION_PLAN.md`. No crear campañas ni gastar presupuesto sin autorización explícita.

## 5. Qué no se hizo y por qué

- No se administró GBP, Hotel Center, Booking ni Ads desde este cambio: hace falta que el dueño o la administradora lo hagan en esas consolas.
- No se agregó `Offer` ni `makesOffer` al schema: el rango de precios es referencial y la pregunta de qué tarifas publicar en la web sigue pendiente de autorización (pregunta 20).
- No se publicó una política de cancelación: las fuentes se contradicen.
- No se crearon páginas de habitación: el contenido por tipo sigue siendo insuficiente (SEO-04).
- Se dejó `Google-Extended` bloqueado (política vigente): afecta el entrenamiento de Gemini/Vertex, no a Google Search, AI Overviews ni AI Mode.
