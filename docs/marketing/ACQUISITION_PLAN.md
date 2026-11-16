# Plan de adquisición — Hotel Herencia

Estado: **propuesta. No hay campañas creadas ni presupuesto comprometido.** Cada canal se activa solo si cumple sus criterios de activación (sección 5).

## 1. Punto de partida (verificado)

- Una sola landing (`/`) con propuesta de valor verificable: ubicación a pasos de Av. Argentina, desayuno buffet, estacionamiento, WiFi, aire acondicionado, recepción 24 horas, 17 habitaciones (en la página se muestran 2 tipos) y fotos reales.
- Los CTA son "Consultar reserva" (formulario o plataforma), WhatsApp, teléfono e Instagram. Enviar el formulario **no confirma** la reserva.
- La medición está preparada (`dataLayer`: `generate_lead`, `check_availability`, `contact_whatsapp`, `contact_phone`), pero **no hay herramienta instalada**, así que hoy no se puede medir el costo por consulta.
- El schema declara un rango referencial (CLP 47.000 – 65.000, IVA incluido), pero no hay tarifas exactas por tipo en la página ni política de cancelación publicada (las fuentes se contradicen). Eso limita los anuncios: no se puede prometer un precio reservable.

## 2. Hipótesis

| # | Hipótesis | Cómo se valida |
|---|---|---|
| H1 | La demanda de marca ("hotel herencia chillán") ya llega por orgánico y Maps. Pagar por ella solo se justifica si OTAs o competidores pujan por la marca | Search Console: impresiones de marca y posición. Prueba en Ads: subasta de marca durante 2 semanas |
| H2 | Las búsquedas genéricas ("hotel en Chillán", "hotel con estacionamiento Chillán") convierten mejor hacia WhatsApp que hacia el formulario | Comparar `contact_whatsapp` y `generate_lead` por fuente |
| H3 | Viajeros de trabajo (entre semana) son un segmento real | Consultas de lunes a jueves; mensaje del formulario |
| H4 | Free Booking Links genera reservas directas con costo marginal bajo | Clics desde Google Hotels a `/reservar` (UTM del socio) |

## 3. Segmentación propuesta

| Campaña | Público e intención | Landing | Condición |
|---|---|---|---|
| Marca (Search) | "hotel herencia", "herencia hotel boutique" | `/` | Solo si H1 muestra que otros pujan por la marca |
| Intención de alojamiento (Search) | "hotel en Chillán", "+ desayuno / estacionamiento / cerca del centro", radio Ñuble y Biobío o búsquedas sobre Chillán | `/#datos-clave` o `/#contacto` | Requiere medición activa |
| Hotel Ads | Usuarios del módulo de precios de Google | Plataforma `/reservar` | Requiere Free Booking Links funcionando (ver `GOOGLE_HOTELS.md`) |
| Meta Ads (Instagram) | Remarketing a visitantes del sitio y seguidores; público local para escapadas | `/` | Requiere Meta Pixel **con consentimiento** y actualizar la política de privacidad |
| Corporativa | Empresas que envían personal a Chillán | — | **No activar:** no existe una oferta corporativa real (convenio, factura, tarifa). Si se crea, hacer una página propia con condiciones reales |

**Landings específicas:** no se crean por ahora. Repetirían el contenido de la home (ver SEO-04). Para anuncios basta usar anclas (`/#contacto`) y parámetros UTM, sin crear URLs duplicadas.

## 4. Medición

1. Instalar GTM con un banner de consentimiento. En Chile rige la Ley 21.719 desde el 1-12-2026: documentar la base legal y actualizar `privacidad.html` antes de cualquier píxel.
2. GA4: en GTM, crear eventos desde el `dataLayer`. Marcar `generate_lead` como evento clave y deduplicarlo por `event_id`.
3. Google Ads: importar `generate_lead` desde GA4. **No** enviar datos personales (Enhanced Conversions) sin base legal.
4. `purchase` solo desde la plataforma de reservas, al confirmar la reserva, con el ID de reserva como `transaction_id`.
5. UTM obligatorias en todos los anuncios. Revisar los eventos con la vista previa de GTM (Tag Assistant) y en GA4, en Administrar › DebugView.

## 5. Criterios de activación

| Canal | Se activa cuando… |
|---|---|
| Cualquier canal pagado | GTM y GA4 están activos con consentimiento, la conversión `generate_lead` se ve en DebugView, la política está actualizada y hay un presupuesto aprobado por escrito |
| Search de intención | Además, el formulario y WhatsApp tienen tiempos de respuesta definidos (por ejemplo, < 2 h en horario hábil) |
| Hotel Ads | Free Booking Links lleva 4 semanas o más con precisión de precios aprobada |
| Meta Ads | El pixel tiene consentimiento y hay creatividades con fotos reales del hotel |

## 6. Riesgos

- Pagar por consultas que no se pueden medir: hoy no hay analítica.
- Anunciar beneficios no confirmados (precio, nota de Booking, servicios). Todo anuncio debe usar solo los datos de la sección "Datos clave".
- Las OTAs pujan por la marca. Se mitiga con la campaña de marca si H1 lo confirma.
- Los píxeles publicitarios sin consentimiento tienen riesgo legal. No instalarlos antes del punto 1 de la sección 4.
