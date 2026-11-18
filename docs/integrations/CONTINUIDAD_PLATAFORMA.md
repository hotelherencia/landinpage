# Continuidad landing → plataforma (2026-11-16)

- Tras una consulta exitosa, la plataforma devuelve una `referencia` opaca (caduca a las 72 h).
  `assets/js/main.js` la guarda en `localStorage` (`herencia:consulta-ref`) y la agrega a todo
  enlace hacia `https://plataforma.hotelherencia.cl/reservar` (CTA del hero, botón fijo,
  «Ver disponibilidad», enlaces `/reservar`). Nunca viajan nombre, correo ni teléfono en la URL.
- Parámetros canónicos hacia la plataforma: `llegada`, `salida`, `personas`, `tipo` (+ `ref`).
- **Reservar por tipo (2026-11-18, landinpage#1 y #2; plataforma #346 y #378):** cada tarjeta de
  habitación tiene «Reservar este tipo», que enlaza a `/reservar?tipo=doble` o
  `/reservar?tipo=matrimonial`. La plataforma preselecciona ese tipo y conserva `tipo` en la URL
  canónica. El visitante reserva un **tipo**, nunca un número de habitación: la respuesta pública
  de disponibilidad ya no trae `habitacion_id` y recepción asigna la unidad al confirmar.
- Desde el 2026-11-18, la plataforma limita las solicitudes por cliente: por defecto, 3 por mismo
  correo o teléfono en 7 días; lo configura el hotel (#348). Si se supera, la plataforma responde
  409 con un mensaje para el visitante.
- «Ver disponibilidad» no envía la consulta en silencio: si hay nombre, correo y teléfono,
  ofrece «Enviar consulta y continuar» o «Seguir sin enviar mis datos».
- `api/publico/leads.js`: lista blanca y normalización del cuerpo (NFC, sin controles, topes,
  correo/teléfono/fechas), verifica el token `X-Recaptcha-Token` y reenvía a la plataforma un
  token distinto (`X-Recaptcha-Token-Servicio`), porque Google acepta cada token una sola vez.
  Propaga `X-Request-Id` y escribe una línea JSON por petición (`servicio=landing-leads`,
  `request_id`, `estado`, `resultado`, `ms`), sin datos personales ni tokens.
- Ver logs: Vercel → proyecto de la landing → Logs → filtrar `landing-leads` o el `request_id`;
  el mismo `request_id` aparece en los logs del servicio en Railway.
