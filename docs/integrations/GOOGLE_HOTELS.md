# Google Business Profile y Google Hotels — preparación técnica

Estado al 2026-11-16: **no hay ninguna integración activa con Google Hotels.** Este documento describe qué existe, qué falta y cómo activarlo. No se usaron APIs privadas ni credenciales, y no se inventaron endpoints.

> Los requisitos de Google cambian. Antes de activar cualquier cosa, revisar la documentación oficial vigente: Ayuda de Google Hotel Center, *Free booking links*, y Ayuda de Google Ads, *Hotel campaigns*. Lo que sigue es la arquitectura general y debe confirmarse con esas fuentes y con el proveedor elegido.

## 1. Lo que existe hoy (verificado)

| Elemento | Estado | Evidencia |
|---|---|---|
| Ficha de Google Maps "Hotel Herencia" | Existe; pin en Diego de Almagro, Chillán | `https://maps.app.goo.gl/XYgS4ZHtKSHauBpj8` resuelve al place id `0x9668d62dba7c71c5:0x6caffe1ed4a91abf` |
| Sitio oficial | `https://www.hotelherencia.cl/` | Canonical y JSON-LD `Hotel` con `@id` `https://www.hotelherencia.cl/#hotel` |
| NAP en el sitio | Hotel Herencia · Calle Diego de Almagro 751, Chillán · +56 9 5649 1501 | Coherente en todo el sitio (test automático) |
| Datos estructurados | `Hotel` con dirección, geo, teléfono, servicios, 2 `HotelRoom` (sin ofertas) y FAQ | `index.html` |
| Motor de reservas | Plataforma propia externa `plataforma-salman-herencia-oficial.vercel.app/reservar`, que recibe fechas, personas y una referencia opaca | `main.js`. Su lógica de inventario, tarifas y confirmación **no está en este repo y no se verificó** |
| Tarifas y disponibilidad públicas (ARI) | **No existen** en el sitio ni en un feed | — |
| Política de cancelación publicada | **No existe** | — |
| IDs estables de habitaciones y tarifas | **No existen** en el sitio | — |

## 2. Free Booking Links y Hotel Ads

| | **Free Booking Links** (enlaces de reserva gratuitos) | **Hotel Ads** (anuncios de hotel) |
|---|---|---|
| Qué es | Listados orgánicos, sin costo por clic, en el módulo de precios de Google (Search y Maps) | Anuncios pagados en el mismo módulo, gestionados con campañas de hotel en Google Ads |
| Costo | Sin costo por clic. El proveedor de conectividad puede cobrar | Pago por clic, comisión o conversión, según la campaña |
| Requisitos | Ficha GBP verificada y vinculada en Hotel Center, más precios y disponibilidad enviados por un **socio de integración** (motor de reservas o channel manager) o un feed propio aprobado | Lo mismo, más una cuenta de Google Ads vinculada a Hotel Center, presupuesto y precisión de precios sostenida |
| Prerrequisito clave | Precios **exactos** que coincidan con la página de reserva (Google audita la precisión) | Igual, y además seguimiento de conversiones |
| Para Hotel Herencia | **Primer paso recomendado** | Solo después de que FBL funcione y haya medición |

Sin un feed de precios, igual se puede mostrar el **enlace al sitio oficial** en la ficha (campo "sitio web" del GBP). Eso no es Google Hotels.

## 3. Arquitectura propuesta

```
Google Business Profile (ficha verificada)
          │ vinculada
Google Hotel Center ◄── feed ARI (precios, disponibilidad, restricciones)
          │                       ▲
          │                       │ API del socio de integración
          ▼                       │
Módulo de precios ──clic──► Página de reserva con precio idéntico
(Search/Maps)               (plataforma de reservas o motor del socio)
```

Dos caminos:

1. **Recomendado: un socio de integración certificado por Google** (motor de reservas o channel manager con conexión a Google Hotels). Él publica el ARI y hospeda o enlaza la página de reserva. Requiere que la plataforma actual sea ese motor o se conecte con él.
2. **Integración propia:** la plataforma de reservas genera el feed ARI y la *Hotel List* y se certifica directamente. Supone control de inventario transaccional, reglas de tarifa y alta precisión de precios. **No es viable** mientras no exista inventario centralizado verificado.

En este repo **no se implementó ningún conector**. La landing no tiene inventario ni precios. La única pieza útil desde aquí es la redirección `/reservar`, que sirve como *landing page* de reserva en el dominio oficial y conserva los parámetros `inicio`, `fin` y `personas`.

### Contrato mínimo que la plataforma debe aceptar para ser destino de Google Hotels

- `GET /reservar?inicio=YYYY-MM-DD&fin=YYYY-MM-DD&personas=N[&habitacion=<id>&tarifa=<id>]`: hoy acepta `inicio`, `fin`, `personas` y `ref`. Faltan los IDs de habitación y tarifa.
- Debe mostrar el **mismo precio total**, con impuestos, que el enviado a Google.
- IDs estables por tipo de habitación, por ejemplo `doble-pequena` y `cama-grande`, y por plan tarifario.
- Política de cancelación visible antes de pagar.

## 4. Pasos de activación (responsable: dueño o administración)

1. **GBP:** verificar la ficha, la dirección exacta (ver SEO-06), la categoría "Hotel", el teléfono, el sitio `https://www.hotelherencia.cl/`, las fotos y los atributos (estacionamiento, desayuno, WiFi), y los horarios de check-in y check-out.
2. **Datos que faltan:** tarifas, capacidad por habitación, política de cancelación, medios de pago y mascotas.
3. **Decidir el proveedor:** ¿la plataforma actual tiene conexión con Google Hotels? Si no, evaluar un motor o channel manager certificado (también resuelve la sincronización con Booking).
4. Con el proveedor: alta en Hotel Center, vinculación con GBP, envío del ARI y activación de Free Booking Links.
5. Medición: con GTM y consentimiento, leer los eventos `check_availability` y `generate_lead`. `purchase` lo envía la plataforma al confirmar.
6. Solo después: evaluar Hotel Ads (ver `docs/marketing/ACQUISITION_PLAN.md`).

## 5. Qué no se hizo y por qué

- No se administró GBP, Hotel Center, Booking ni Ads: no hay credenciales ni permisos.
- No se agregó `Offer` ni `priceRange` al schema: no hay tarifas confirmadas.
- No se crearon páginas de habitación: el contenido es insuficiente (SEO-04).
