# Despliegue y reversión — landing Hotel Herencia

Hosting: Vercel, que despliega automáticamente con cada push a `main` de `github.com/hotelherencia/landinpage`. No hay staging: **cada push publica en producción.**

## 1. Antes de publicar

- [ ] Autorización explícita del dueño para desplegar.
- [ ] La carpeta de trabajo y el clon `~/herencia-git/landinpage` están sincronizados, y el clon no tiene cambios ajenos (`git status`).
- [ ] `node --test tests/*.test.mjs` da 0 fallos.
- [ ] Si cambió algún `<script>` inline: recalcular su hash `sha256` y actualizarlo **en dos lugares**, la meta CSP de `index.html` y la cabecera CSP de `vercel.json`. El test de CSP falla si no coinciden.
- [ ] Si cambió el contenido visible: actualizar `lastmod` en `sitemap.xml`, `dateModified` en el JSON-LD y la fecha de "Información revisada".
- [ ] Si cambió el FAQ visible: actualizar el bloque JSON-LD `FAQPage`. El test compara ambos.
- [ ] `docs/` y `tests/` siguen en `.vercelignore`.

## 2. Publicar

```bash
# 1) Copiar los cambios al clon (sin tocar .git)
rsync -a --delete --exclude .git \
  "/mnt/c/Users/herre/OneDrive/Documentos/Cert/Auditar/landinpage-main/landinpage-main/" \
  ~/herencia-git/landinpage/
cd ~/herencia-git/landinpage
git status            # revisar que solo aparezcan los archivos esperados
node --test tests/*.test.mjs
```

`push_landing.sh` lleva escrito a mano el mensaje del commit de la ronda anterior ("SEO, datos estructurados y control de bots de IA"). **Hay que editar el mensaje** antes de usarlo, o hacer el commit y el push a mano con un mensaje que describa esta ronda.

## 3. Verificar en producción (después de que Vercel informe "success")

```bash
B=https://www.hotelherencia.cl
gh api repos/hotelherencia/landinpage/commits/main/status --jq '.state'      # success
curl -s $B/ | cmp - index.html && echo "index igual"
curl -s $B/assets/js/main.js | cmp - assets/js/main.js && echo "main.js igual"
curl -s -o /dev/null -w '%{http_code}\n' $B/assets/img/hotel-herencia.webp   # 200
curl -s -o /dev/null -w '%{http_code}\n' $B/assets/img/maps.webp             # 200
curl -sI $B/reservar | grep -iE '^HTTP|^location'                             # 307 → plataforma
curl -s -o /dev/null -w '%{http_code}\n' $B/docs/audits/BASELINE.md          # 404 (no publicado)
curl -s -o /dev/null -w '%{http_code}\n' $B/tests/site.test.mjs              # 404
curl -sI $B/ | grep -i content-security-policy                                # mismo hash que la meta
```

- [ ] Abrir el sitio en un móvil real: hero, carruseles, mapa con atribución y los botones WhatsApp y Llamar.
- [ ] Cada tarjeta de habitación tiene «Reservar este tipo» y abre la plataforma con el tipo preseleccionado (`/reservar?tipo=doble` o `?tipo=matrimonial`, desde el 2026-11-18).
- [ ] Hacer una consulta de prueba **solo si recepción está avisada**, y descartarla después en el backend.
- [ ] En la consola del navegador, `window.dataLayer` muestra `contact_whatsapp` al tocar WhatsApp.
- [ ] Search Console: inspeccionar la URL `/` y pedir indexación si cambió el contenido.

## 4. Reversión

Opción A, la más rápida y sin tocar git: en el panel de Vercel, ir a Deployments, elegir el deployment anterior y usar "Instant Rollback" o "Promote to Production". Sirve mientras se investiga.

Opción B, con historial limpio:

```bash
cd ~/herencia-git/landinpage
git revert --no-edit HEAD        # crea un commit que deshace el último
# revisar, y hacer push a main (Vercel despliega la versión revertida)
```

El último commit conocido en producción antes de esta ronda es `73a7639`.

Después de revertir, repetir la sección 3 para confirmar que producción volvió al estado anterior.
