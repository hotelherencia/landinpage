# Continuidad landing → plataforma (2026-11-16)

- Tras una consulta exitosa, la plataforma devuelve una `referencia` opaca (caduca a las 72 h).
  `assets/js/main.js` la guarda en `localStorage` (`herencia:consulta-ref`) y la agrega a todo
  enlace hacia `https://plataforma.hotelherencia.cl/reservar` (CTA del hero, botón fijo,
  «Ver disponibilidad», enlaces `/reservar`). Nunca viajan nombre, correo ni teléfono en la URL.
- Parámetros canónicos hacia la plataforma: `llegada`, `salida`, `personas` (+ `ref`).
- «Ver disponibilidad» no envía la consulta en silencio: si hay nombre, correo y teléfono,
  ofrece «Enviar consulta y continuar» o «Seguir sin enviar mis datos».
- `api/publico/leads.js`: lista blanca y normalización del cuerpo (NFC, sin controles, topes,
  correo/teléfono/fechas), verifica el token `X-Recaptcha-Token` y reenvía a la plataforma un
  token distinto (`X-Recaptcha-Token-Servicio`), porque Google acepta cada token una sola vez.
  Propaga `X-Request-Id` y escribe una línea JSON por petición (`servicio=landing-leads`,
  `request_id`, `estado`, `resultado`, `ms`), sin datos personales ni tokens.
- Ver logs: Vercel → proyecto de la landing → Logs → filtrar `landing-leads` o el `request_id`;
  el mismo `request_id` aparece en los logs del servicio en Railway.
