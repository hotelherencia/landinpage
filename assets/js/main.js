const siteHeader = document.querySelector('.site-header');
const navToggle = document.querySelector('[data-nav-toggle]');
const navLinks = document.querySelectorAll('.site-nav a');
const revealElements = document.querySelectorAll('[data-reveal]');
const roomCarousels = document.querySelectorAll('[data-carousel]');
const form = document.querySelector('.contact-form');
const statusElement = form?.querySelector('[role="status"]');
const disponibilidadEstado = form?.querySelector('[data-disponibilidad-estado]');
const disponibilidadBoton = form?.querySelector('[data-ver-disponibilidad]');
const submitButton = form?.querySelector('.button--submit');
const checkinInput = document.querySelector('#checkin');
const checkoutInput = document.querySelector('#checkout');
const guestsInput = document.querySelector('#guests');
const bookingBar = document.querySelector('[data-barra-reserva]');
const bookingBarStatus = bookingBar?.querySelector('[data-barra-estado]');
const bookingBarLlegada = document.querySelector('#rapido-llegada');
const bookingBarSalida = document.querySelector('#rapido-salida');
const bookingBarPersonas = document.querySelector('#rapido-personas');

function setNavOpen(isOpen) {
    if (!siteHeader || !navToggle) {
        return;
    }

    siteHeader.dataset.navOpen = String(isOpen);
    navToggle.setAttribute('aria-expanded', String(isOpen));
}

if (navToggle) {
    navToggle.addEventListener('click', () => {
        const isOpen = siteHeader?.dataset.navOpen === 'true';
        setNavOpen(!isOpen);
    });
}

navLinks.forEach((link) => {
    link.addEventListener('click', () => setNavOpen(false));
});

/* Menú del celular: Escape lo cierra y devuelve el foco al botón. */
document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && siteHeader?.dataset.navOpen === 'true') {
        setNavOpen(false);
        navToggle?.focus();
    }
});

/* Un toque fuera del menú abierto (sobre el fondo oscurecido) lo cierra. */
document.addEventListener('click', (evento) => {
    if (siteHeader?.dataset.navOpen === 'true' && evento.target && !siteHeader.contains(evento.target)) {
        setNavOpen(false);
    }
});

/* Cabecera con borde y sombra apenas se baja de la parte superior. */
if (siteHeader && typeof window.addEventListener === 'function') {
    const marcarCabecera = () => siteHeader.classList.toggle('is-scrolled', window.scrollY > 8);
    window.addEventListener('scroll', marcarCabecera, { passive: true });
    marcarCabecera();
}

if (revealElements.length > 0) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) {
                return;
            }

            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
        });
    }, {
        threshold: 0.18,
        rootMargin: '0px 0px -40px 0px'
    });

    revealElements.forEach((element) => {
        revealObserver.observe(element);
    });
}

roomCarousels.forEach((carousel) => {
    const track = carousel.querySelector('[data-room-track]');
    const slides = [...carousel.querySelectorAll('[data-room-slide]')];
    const dotsContainer = carousel.querySelector('.rooms-carousel__dots');
    const prevButton = carousel.querySelector('[data-room-prev]');
    const nextButton = carousel.querySelector('[data-room-next]');

    if (!track || slides.length === 0) {
        return;
    }

    let dots = [];

    if (dotsContainer) {
        const dotsLabel = dotsContainer.getAttribute('aria-label') ?? 'este carrusel';
        const carouselLabel = dotsLabel.replace(/^Selector de imágenes de /, '');

        dotsContainer.replaceChildren();

        slides.forEach((_, index) => {
            const dot = document.createElement('button');
            dot.type = 'button';
            dot.className = 'rooms-carousel__dot';
            dot.dataset.roomDot = String(index);
            dot.setAttribute('aria-label', `Mostrar imagen ${index + 1} de ${carouselLabel}`);
            dot.setAttribute('aria-pressed', String(index === 0));

            if (index === 0) {
                dot.classList.add('is-active');
            }

            dotsContainer.append(dot);
        });

        dots = [...dotsContainer.querySelectorAll('[data-room-dot]')];
    }

    let activeIndex = 0;
    let scrollTimer;

    function updateCarousel(index) {
        activeIndex = index;

        slides.forEach((slide, slideIndex) => {
            slide.setAttribute('aria-hidden', String(slideIndex !== activeIndex));
        });

        dots.forEach((dot, dotIndex) => {
            const isActive = dotIndex === activeIndex;
            dot.classList.toggle('is-active', isActive);
            dot.setAttribute('aria-pressed', String(isActive));
        });
    }

    function goToSlide(index) {
        const safeIndex = (index + slides.length) % slides.length;
        slides[safeIndex].scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'start'
        });
        updateCarousel(safeIndex);
    }

    prevButton?.addEventListener('click', () => {
        goToSlide(activeIndex - 1);
    });

    nextButton?.addEventListener('click', () => {
        goToSlide(activeIndex + 1);
    });

    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            goToSlide(index);
        });
    });

    track.addEventListener('scroll', () => {
        window.clearTimeout(scrollTimer);
        scrollTimer = window.setTimeout(() => {
            const nextIndex = Math.round(track.scrollLeft / track.clientWidth);
            updateCarousel(Math.max(0, Math.min(slides.length - 1, nextIndex)));
        }, 60);
    });

    updateCarousel(0);
});

function isoDateFromOffset(offsetDays = 0) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + offsetDays);
    return formatDate(date);
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function syncDateConstraints() {
    if (!checkinInput || !checkoutInput) {
        return;
    }

    const today = isoDateFromOffset(0);
    checkinInput.min = today;
    if (checkinInput.value) {
        const nextDay = new Date(`${checkinInput.value}T00:00:00`);
        nextDay.setDate(nextDay.getDate() + 1);
        checkoutInput.min = formatDate(nextDay);
    } else {
        checkoutInput.min = isoDateFromOffset(1);
    }

    if (checkinInput.value && checkoutInput.value && checkoutInput.value <= checkinInput.value) {
        checkoutInput.value = '';
    }
}

function setStatus(message, kind = '') {
    if (!statusElement) {
        return;
    }

    statusElement.replaceChildren(document.createTextNode(message));
    statusElement.classList.remove('is-success', 'is-error');

    if (kind) {
        statusElement.classList.add(kind === 'success' ? 'is-success' : 'is-error');
    }
}

/** Tras un lead exitoso: mensaje + enlace a /reservar con ref opaca (sin PII). */
function setStatusConContinuar(message, enlace) {
    if (!statusElement) {
        return;
    }

    statusElement.replaceChildren(document.createTextNode(message));

    if (enlace) {
        statusElement.append(document.createTextNode(' '));
        const continuar = document.createElement('a');
        continuar.href = enlace;
        continuar.textContent = 'Continuar con la reserva';
        statusElement.append(continuar);
    }

    statusElement.classList.remove('is-error');
    statusElement.classList.add('is-success');
}

/*
 * Continuidad landing → plataforma sin datos personales en la URL.
 * Tras una consulta exitosa la plataforma entrega una referencia opaca (SOC-016, caduca a las 72 h).
 * La guardamos en este navegador con la misma caducidad y la agregamos a TODO enlace hacia
 * /reservar (CTA del hero, botón flotante, «Ver disponibilidad», redirección /reservar), para que
 * la plataforma precargue nombre y correo en vez de volver a pedirlos.
 */
const CLAVE_REFERENCIA = 'herencia:consulta-ref';
const HORAS_REFERENCIA = 72;
const PATRON_REFERENCIA = /^[A-Za-z0-9_-]{20,128}$/;
const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PERSONAS = 30;
const MAX_NOCHES = 30;

function referenciaValida(valor) {
    return typeof valor === 'string' && PATRON_REFERENCIA.test(valor);
}

function almacen() {
    try {
        return window.localStorage || null;
    } catch {
        return null;
    }
}

function guardarReferencia(referencia, ahora = Date.now()) {
    const store = almacen();

    if (!store || !referenciaValida(referencia)) {
        return false;
    }

    try {
        store.setItem(CLAVE_REFERENCIA, JSON.stringify({ ref: referencia, expira: ahora + HORAS_REFERENCIA * 3600000 }));
        return true;
    } catch {
        return false;
    }
}

function olvidarReferencia() {
    try {
        almacen()?.removeItem(CLAVE_REFERENCIA);
    } catch {
        // Sin almacenamiento disponible: nada que borrar.
    }
}

function referenciaGuardada(ahora = Date.now()) {
    const store = almacen();

    if (!store) {
        return '';
    }

    try {
        const datos = JSON.parse(store.getItem(CLAVE_REFERENCIA) || 'null');

        if (datos && referenciaValida(datos.ref) && Number.isFinite(datos.expira) && datos.expira > ahora) {
            return datos.ref;
        }
    } catch {
        // Valor corrupto o manipulado: se descarta.
    }

    olvidarReferencia();
    return '';
}

/** Fecha ISO real (no solo con forma AAAA-MM-DD: 2026-02-31 se rechaza). */
function fechaIsoValida(valor) {
    if (typeof valor !== 'string' || !PATRON_FECHA.test(valor)) {
        return false;
    }

    const d = new Date(`${valor}T00:00:00`);
    return !Number.isNaN(d.getTime()) && formatDate(d) === valor;
}

function personasValidas(valor) {
    const n = Number(valor);
    return /^\d{1,2}$/.test(String(valor)) && Number.isInteger(n) && n >= 1 && n <= MAX_PERSONAS;
}

/** Solo entra a la URL lo que pasa la lista blanca: fechas reales, rango sano, personas 1..30, ref opaca.
 *  Con `soloRef: true` y una referencia recién emitida, viaja únicamente `?ref=<token_opaco>` para
 *  no exponer fechas ni datos en texto plano en la URL (el servidor resuelve todo desde el token). */
function enlaceContinuarReserva(cuerpo, referencia, { soloRef = false } = {}) {
    const params = new URLSearchParams();
    const ref = referenciaValida(referencia) ? referencia : referenciaGuardada();

    if (soloRef && referenciaValida(referencia)) {
        params.set('ref', referencia);
        return `${urlPlataforma()}/reservar?${params.toString()}`;
    }

    const inicio = cuerpo?.check_in;
    const fin = cuerpo?.check_out;

    if (fechaIsoValida(inicio) && fechaIsoValida(fin) && !mensajeRango(inicio, fin, 1)) {
        // Parámetros canónicos compartidos con la plataforma: llegada / salida / personas.
        params.set('llegada', inicio);
        params.set('salida', fin);
        params.set('personas', String(personasValidas(cuerpo.huespedes) ? Number(cuerpo.huespedes) : 1));
    }

    if (ref) {
        params.set('ref', ref);
    }

    if (!params.has('llegada') && !params.has('ref')) {
        return '';
    }

    return `${urlPlataforma()}/reservar?${params.toString()}`;
}

/** Enlace explícito «sin enviar mis datos»: nunca pega una referencia previa y pide a /reservar
 *  limpiar cualquier sesión anterior (`limpiar=1`) para no arrastrar datos de otra consulta. */
function enlaceSinDatos(cuerpo) {
    const params = new URLSearchParams();
    const inicio = cuerpo?.check_in;
    const fin = cuerpo?.check_out;

    if (fechaIsoValida(inicio) && fechaIsoValida(fin) && !mensajeRango(inicio, fin, 1)) {
        params.set('llegada', inicio);
        params.set('salida', fin);
        params.set('personas', String(personasValidas(cuerpo.huespedes) ? Number(cuerpo.huespedes) : 1));
    }

    params.set('limpiar', '1');
    return `${urlPlataforma()}/reservar?${params.toString()}`;
}

/**
 * Agrega la referencia guardada a un enlace hacia /reservar (absoluto de la plataforma o relativo
 * /reservar de esta landing). Cualquier otro destino se devuelve igual: no hay redirecciones abiertas.
 */
function conReferencia(href) {
    const ref = referenciaGuardada();

    if (!ref || typeof href !== 'string') {
        return href;
    }

    let url;

    try {
        url = new URL(href, `${urlPlataforma()}/`);
    } catch {
        return href;
    }

    const plataforma = new URL(urlPlataforma());
    const esReservar = url.pathname === '/reservar'
        && (url.origin === plataforma.origin || href.startsWith('/reservar'));

    if (!esReservar || url.searchParams.has('ref')) {
        return href;
    }

    url.searchParams.set('ref', ref);
    return href.startsWith('/reservar') ? `${url.pathname}?${url.searchParams.toString()}` : url.toString();
}

function validateStayDates() {
    if (!checkinInput || !checkoutInput) {
        return true;
    }

    checkoutInput.setCustomValidity('');

    if (!checkinInput.value || !checkoutInput.value) {
        return true;
    }

    if (checkoutInput.value <= checkinInput.value) {
        checkoutInput.setCustomValidity('La fecha de salida debe ser posterior a la llegada.');
        return false;
    }

    return true;
}

syncDateConstraints();

checkinInput?.addEventListener('change', () => {
    syncDateConstraints();
    validateStayDates();
});

checkoutInput?.addEventListener('change', validateStayDates);

const RECAPTCHA_SITE_KEY = '6LcKehguAAAAAG07HWp0QQOHJyMxQeWfQl3epp7n';
const WHATSAPP_TEXTO = 'WhatsApp al +56 9 5649 1501';
// Si el script de Google no carga (bloqueador, protección estricta de Firefox, red), se sabe
// al instante por su evento error y no se espera 8 s para mostrar un mensaje genérico.
let recaptchaBloqueado = false;

function prepararRecaptcha() {
    if (!RECAPTCHA_SITE_KEY || document.querySelector('script[data-recaptcha]')) {
        return;
    }

    recaptchaBloqueado = false;
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(RECAPTCHA_SITE_KEY)}`;
    script.async = true;
    script.dataset.recaptcha = 'v3';
    script.onerror = () => {
        recaptchaBloqueado = true;
        // Se quita para que un intento posterior (p. ej. tras desactivar el bloqueador) lo vuelva a pedir.
        script.remove?.();
    };
    document.head.append(script);
}

/** Error con causa legible: 'recaptcha_bloqueado' (no cargó) o 'recaptcha' (cargó pero no dio token). */
function errorRecaptcha(causa) {
    return Object.assign(new Error(causa), { causa });
}

/** Pide un token NUEVO a Google justo al enviar: cada token sirve una vez y vence a los 2 min. */
function tokenRecaptcha(accion) {
    if (!RECAPTCHA_SITE_KEY) {
        return Promise.resolve('');
    }

    prepararRecaptcha();

    const pedir = () => new Promise((resolve, reject) => {
        const inicio = Date.now();

        const ejecutar = () => {
            try {
                window.grecaptcha.ready(() => {
                    Promise.resolve(window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: accion }))
                        .then((token) => {
                            if (typeof token === 'string' && token.length > 20) {
                                resolve(token);
                                return;
                            }

                            reject(errorRecaptcha('recaptcha'));
                        })
                        .catch(() => reject(errorRecaptcha('recaptcha')));
                });
            } catch {
                reject(errorRecaptcha('recaptcha'));
            }
        };

        if (window.grecaptcha && typeof window.grecaptcha.ready === 'function') {
            ejecutar();
            return;
        }

        const reloj = window.setInterval(() => {
            if (window.grecaptcha && typeof window.grecaptcha.ready === 'function') {
                window.clearInterval(reloj);
                ejecutar();
            } else if (recaptchaBloqueado) {
                window.clearInterval(reloj);
                reject(errorRecaptcha('recaptcha_bloqueado'));
            } else if (Date.now() - inicio > 10000) {
                window.clearInterval(reloj);
                // Ni cargó ni dio error en 10 s: en la práctica, bloqueado o red muy lenta.
                reject(errorRecaptcha('recaptcha_bloqueado'));
            }
        }, 50);
    });

    return pedir().catch((error) => {
        if (error && error.causa === 'recaptcha_bloqueado') {
            throw error;
        }

        return pedir();
    });
}

/**
 * El proxy /api/publico/leads verifica un token y la plataforma verifica otro: Google acepta cada
 * token una sola vez (timeout-or-duplicate), así que reenviar el mismo hacía que la plataforma
 * rechazara con 403 toda consulta de la landing y la referencia nunca llegaba a /reservar.
 */
async function tokensRecaptchaConsulta() {
    const primero = await tokenRecaptcha('consulta');
    const segundo = primero ? await tokenRecaptcha('consulta') : '';
    return [primero, segundo];
}

/** Tras una consulta exitosa: se borran nombre, correo, teléfono y mensaje; fechas y personas quedan. */
function limpiarDatosPersonales() {
    for (const nombre of ['name', 'email', 'phone', 'message']) {
        const campo = form?.elements?.namedItem?.(nombre);

        if (campo && 'value' in campo) {
            campo.value = '';
        }
    }
}

/** Código corto que ve el huésped y que viaja como X-Request-Id: con él se ubica el envío en los logs. */
function nuevoCodigoEnvio() {
    const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let codigo = '';

    try {
        const azar = crypto.getRandomValues(new Uint8Array(8));
        azar.forEach((n) => { codigo += letras[n % letras.length]; });
    } catch {
        codigo = Date.now().toString(36).toUpperCase().slice(-8);
    }

    return codigo;
}

function conCodigo(mensaje, codigo) {
    return codigo ? `${mensaje} (código ${codigo})` : mensaje;
}

function mensajeFalloCaptcha(codigo = '') {
    return conCodigo(`No pudimos verificar el envío. Actualiza la página e inténtalo de nuevo, o escríbenos por ${WHATSAPP_TEXTO}.`, codigo);
}

function mensajeCaptchaBloqueado(codigo = '') {
    return conCodigo(
        'No pudimos cargar la verificación de seguridad de Google (reCAPTCHA). Si usas un bloqueador de anuncios, VPN o la protección '
        + `estricta de Firefox, desactívalos para este sitio y vuelve a intentarlo, o escríbenos por ${WHATSAPP_TEXTO}.`,
        codigo
    );
}

/*
 * SEO/rendimiento: reCAPTCHA (~180 KB de JS de terceros) ya no se descarga durante la carga inicial.
 * Se carga en la primera interacción del usuario (scroll, toque, tecla o foco en el formulario)
 * o, como respaldo, unos segundos después de terminar la carga. tokenRecaptcha() también lo carga
 * si aún no estaba, y ya espera hasta 8 s a que grecaptcha esté listo.
 */
function cargarRecaptchaDiferido() {
    const eventos = ['scroll', 'pointerdown', 'keydown', 'touchstart', 'focusin'];
    let cargado = false;

    const cargar = () => {
        if (cargado) {
            return;
        }

        cargado = true;
        eventos.forEach((evento) => window.removeEventListener(evento, cargar, true));
        prepararRecaptcha();
    };

    eventos.forEach((evento) => window.addEventListener(evento, cargar, { capture: true, passive: true, once: true }));

    const respaldo = () => window.setTimeout(cargar, 4000);

    if (document.readyState === 'complete') {
        respaldo();
    } else {
        window.addEventListener('load', respaldo, { once: true });
    }
}

cargarRecaptchaDiferido();

/*
 * Capa de eventos de medición, desacoplada de cualquier proveedor.
 * Solo agrega objetos a window.dataLayer: no carga GA4, GTM ni píxeles y no incluye
 * nombre, correo, teléfono, fechas ni mensaje. Sin un contenedor instalado (con
 * consentimiento y base legal), nada sale del navegador. Ver docs/audits/REMEDIATION_REPORT.md.
 */
function nuevoIdEvento() {
    try {
        return crypto.randomUUID();
    } catch {
        return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
}

function registrarEvento(nombre, datos = {}) {
    try {
        if (window.__hhRequiereConsentimiento) {
            const c = window.__hhConsentimientoCookies;
            if (!c || c.analitica !== true) return;
        }
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: nombre, ...datos, event_id: datos.event_id || nuevoIdEvento() });
    } catch {
        // La medición nunca debe interrumpir la consulta ni la navegación.
    }
}

/** Toda salida hacia /reservar de la plataforma pasa por aquí (evento check_availability). */
function irAReserva(enlace) {
    registrarEvento('check_availability', { destino: 'plataforma_reservar' });
    window.location.assign(enlace);
}

function seccionDe(elemento) {
    const seccion = elemento.closest('section[id], footer');
    return seccion ? (seccion.id || 'pie') : 'flotante';
}

document.addEventListener('click', (evento) => {
    const enlace = evento.target instanceof Element ? evento.target.closest('a[href]') : null;

    if (!enlace) {
        return;
    }

    const href = enlace.getAttribute('href') || '';
    const sinRef = enlace.getAttribute('data-sin-referencia') === '1';

    if (sinRef) {
        olvidarReferencia();
    } else {
        const decorado = conReferencia(href);

        if (decorado !== href && typeof enlace.setAttribute === 'function') {
            enlace.setAttribute('href', decorado);
        }
    }

    if (href.startsWith('https://wa.me/')) {
        registrarEvento('contact_whatsapp', { ubicacion: seccionDe(enlace) });
    } else if (href.startsWith('tel:')) {
        registrarEvento('contact_phone', { ubicacion: seccionDe(enlace) });
    } else if (href.startsWith(`${urlPlataforma()}/reservar`) || href.startsWith('/reservar')) {
        // Enlace "Continuar con la reserva" que aparece tras enviar la consulta.
        registrarEvento('check_availability', { destino: 'plataforma_reservar' });
    }
});

function urlPlataforma() {
    return String(window.LANDING_PLATAFORMA_URL || 'https://plataforma.hotelherencia.cl').replace(/\/+$/, '');
}

function urlApi() {
    if (window.LANDING_API_URL == null) {
        return '/api';
    }

    return String(window.LANDING_API_URL).replace(/\/+$/, '');
}

function hoyLocal() {
    return isoDateFromOffset(0);
}

function mensajeRango(inicio, fin, personas) {
    if (!inicio || !fin) {
        return 'Indica las fechas de tu estadía.';
    }

    if (!fechaIsoValida(inicio) || !fechaIsoValida(fin)) {
        return 'Indica fechas válidas.';
    }

    if (fin <= inicio) {
        return 'La salida debe ser posterior a la llegada.';
    }

    if (inicio < hoyLocal()) {
        return 'La llegada no puede ser una fecha pasada.';
    }

    const noches = (new Date(`${fin}T00:00:00`) - new Date(`${inicio}T00:00:00`)) / 86400000;

    if (noches > MAX_NOCHES) {
        return 'El rango supera las 30 noches.';
    }

    const n = Number(personas);

    if (!Number.isInteger(n) || n < 1 || n > MAX_PERSONAS) {
        return 'Personas debe estar entre 1 y 30.';
    }

    return '';
}

/** Mensaje de error con un enlace opcional para seguir igual (nunca se navega sin avisar). */
function mostrarDisponibilidadConEnlace(mensaje, enlace, textoEnlace, accion, { sinReferencia = false } = {}) {
    if (!disponibilidadEstado) {
        return;
    }

    disponibilidadEstado.replaceChildren(document.createTextNode(mensaje));

    if (accion) {
        disponibilidadEstado.append(document.createElement('br'));
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'button button--primary';
        boton.textContent = accion.texto;
        boton.addEventListener('click', accion.alPulsar, { once: true });
        disponibilidadEstado.append(boton);
    }

    if (enlace) {
        disponibilidadEstado.append(document.createTextNode(' '));
        const a = document.createElement('a');
        a.href = enlace;
        a.textContent = textoEnlace;
        if (sinReferencia) {
            a.setAttribute('data-sin-referencia', '1');
        }
        disponibilidadEstado.append(a);
    }

    disponibilidadEstado.hidden = false;
}

function mostrarDisponibilidad(mensaje) {
    if (!disponibilidadEstado) {
        return;
    }

    disponibilidadEstado.textContent = mensaje;
    disponibilidadEstado.hidden = !mensaje;
}

async function irAReservarConFechas({ conLead, confirmado = false }) {
    if (!form) {
        return;
    }

    // Limpia cualquier error anterior del formulario de contacto (evita avisos vencidos debajo).
    setStatus('');

    const datos = Object.fromEntries(new FormData(form).entries());
    const cuerpo = cuerpoConsulta(datos);
    const problemaFechas = mensajeRango(cuerpo.check_in, cuerpo.check_out, cuerpo.huespedes ?? 1);

    if (problemaFechas) {
        mostrarDisponibilidad(problemaFechas);
        return;
    }

    const problemaContacto = problemaConsulta({
        ...cuerpo,
        check_in: null,
        check_out: null,
        huespedes: null,
        mensaje: null
    });
    const enlaceSoloFechas = enlaceContinuarReserva(cuerpo, '');
    const enlaceLimpio = enlaceSinDatos(cuerpo);
    const contactoVacio = !cuerpo.nombre && !cuerpo.correo && !cuerpo.telefono;
    const yaConsulto = Boolean(referenciaGuardada());

    if (contactoVacio || !conLead) {
        mostrarDisponibilidad(
            yaConsulto
                ? 'Seguimos con tu consulta: en la reserva verás tus datos ya cargados.'
                : 'Vas a la reserva solo con las fechas; el contacto se pide allá.'
        );
        irAReserva(enlaceSoloFechas);
        return;
    }

    if (problemaContacto) {
        // Datos a medio llenar: avisar y dejar corregir antes de salir, para no perderlos.
        mostrarDisponibilidadConEnlace(
            `${problemaContacto} Así llevamos tus datos a la reserva y no tendrás que escribirlos otra vez.`,
            enlaceLimpio,
            'Seguir sin mis datos',
            null,
            { sinReferencia: true }
        );
        return;
    }

    if (!confirmado) {
        // UX-06: nunca se envía una consulta sin que el visitante lo pida. Se le ofrece explícitamente.
        mostrarDisponibilidadConEnlace(
            'Para llevar tu nombre y contacto de forma segura a la reserva (sin exponerlos en la URL), primero registramos tu consulta en recepción (no confirma la estadía).',
            enlaceLimpio,
            'Seguir sin enviar mis datos',
            {
                texto: 'Enviar consulta y continuar',
                alPulsar: () => irAReservarConFechas({ conLead: true, confirmado: true })
            },
            { sinReferencia: true }
        );
        return;
    }

    const api = urlApi();

    if (!api || !disponibilidadBoton) {
        mostrarDisponibilidad('Vas a la reserva solo con las fechas; el contacto se pide allá.');
        irAReserva(enlaceLimpio);
        return;
    }

    mostrarDisponibilidad('Enviando consulta…');
    disponibilidadBoton.disabled = true;

    try {
        const resultado = await enviarConsulta(api, cuerpo);

        if (resultado.tipo !== 'respuesta' || (resultado.estado !== 201 && resultado.estado !== 200)) {
            mostrarDisponibilidadConEnlace(
                mensajeResultadoEnvio(resultado),
                enlaceLimpio,
                'Seguir sin mis datos',
                null,
                { sinReferencia: true }
            );
            return;
        }

        const referencia = typeof resultado.json?.referencia === 'string' ? resultado.json.referencia : '';
        guardarReferencia(referencia);
        registrarEvento('generate_lead', { event_id: resultado.clave, origen: 'ver_disponibilidad' });
        limpiarDatosPersonales();
        irAReserva(enlaceContinuarReserva(cuerpo, referencia, { soloRef: true }));
    } catch (error) {
        mostrarDisponibilidadConEnlace(
            conCodigo(`No pudimos guardar la consulta. Inténtalo de nuevo o escríbenos por ${WHATSAPP_TEXTO}.`, 'JS'),
            enlaceLimpio,
            'Seguir sin mis datos',
            null,
            { sinReferencia: true }
        );
    } finally {
        disponibilidadBoton.disabled = false;
    }
}

disponibilidadBoton?.addEventListener('click', () => {
    irAReservarConFechas({ conLead: true });
});

document.querySelectorAll('[data-cta-reserva]').forEach((enlace) => {
    enlace.addEventListener('click', (evento) => {
        if (!form || !checkinInput || !checkoutInput) {
            return;
        }

        const inicio = checkinInput.value;
        const fin = checkoutInput.value;
        const personas = guestsInput?.value || '1';
        const problemaFechas = mensajeRango(inicio || null, fin || null, Number(personas) || 1);

        if (problemaFechas) {
            // Sin fechas, pero con una consulta ya enviada: la plataforma pide las fechas y precarga el contacto.
            const soloRef = referenciaGuardada() ? enlaceContinuarReserva({}, '') : '';

            if (soloRef) {
                evento.preventDefault();
                irAReserva(soloRef);
            }

            return;
        }

        evento.preventDefault();
        irAReservarConFechas({ conLead: true });
    });
});

/* Señala en el formulario el campo que explica el error y lleva el foco ahí (WCAG 3.3.1). */
const CAMPO_POR_ERROR = [
    [/nombre/i, '#name'],
    [/correo/i, '#email'],
    [/tel[eé]fono/i, '#phone'],
    [/mensaje/i, '#message'],
    [/personas/i, '#guests'],
    [/salida/i, '#checkout'],
    [/llegada|fechas/i, '#checkin']
];

function marcarCampoConError(mensaje) {
    if (!form || typeof form.querySelectorAll !== 'function') {
        return;
    }

    form.querySelectorAll('[aria-invalid="true"]').forEach((campo) => campo.removeAttribute('aria-invalid'));
    const par = CAMPO_POR_ERROR.find(([patron]) => patron.test(mensaje));
    const campo = par ? form.querySelector(par[1]) : null;

    if (campo) {
        campo.setAttribute('aria-invalid', 'true');
        campo.focus?.();
        campo.addEventListener('input', () => campo.removeAttribute('aria-invalid'), { once: true });
    }
}

function texto(valor) {
    return String(valor ?? '').trim();
}

function cuerpoConsulta(datos) {
    const huespedes = texto(datos.guests);
    const checkIn = texto(datos.checkin);
    const checkOut = texto(datos.checkout);
    const mensaje = texto(datos.message);

    return {
        nombre: texto(datos.name),
        correo: texto(datos.email),
        telefono: texto(datos.phone),
        huespedes: huespedes === '' ? null : Number(huespedes),
        check_in: checkIn || null,
        check_out: checkOut || null,
        mensaje: mensaje || null
    };
}

function problemaConsulta(cuerpo) {
    if (!cuerpo.nombre || cuerpo.nombre.length > 200) {
        return 'Indica tu nombre.';
    }

    if (cuerpo.correo.length > 320 || !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(cuerpo.correo)) {
        return 'Indica un correo válido.';
    }

    const digitos = cuerpo.telefono.replace(/\D/g, '');

    if (cuerpo.telefono.length > 40 || !/^[+\d\s().-]+$/.test(cuerpo.telefono) || digitos.length < 8 || digitos.length > 15) {
        return 'Indica un teléfono válido.';
    }

    if (cuerpo.mensaje && cuerpo.mensaje.length > 2000) {
        return 'El mensaje es demasiado largo.';
    }

    if ((cuerpo.check_in == null) !== (cuerpo.check_out == null)) {
        return 'Indica las fechas de tu estadía.';
    }

    if (cuerpo.check_in && cuerpo.check_out) {
        return mensajeRango(cuerpo.check_in, cuerpo.check_out, cuerpo.huespedes ?? 1);
    }

    if (cuerpo.huespedes != null && (!Number.isInteger(cuerpo.huespedes) || cuerpo.huespedes < 1 || cuerpo.huespedes > 30)) {
        return 'Personas debe estar entre 1 y 30.';
    }

    return '';
}

const ESTADOS_REINTENTABLES = new Set([502, 503, 504]);
const ESPERA_REINTENTO_MS = 1500;
const TIEMPO_MAXIMO_ENVIO_MS = 35000;

function esperar(ms) {
    return new Promise((resolve) => { window.setTimeout(resolve, ms); });
}

function senalConTope(ms) {
    try {
        return AbortSignal.timeout(ms);
    } catch {
        return undefined;
    }
}

/**
 * Envía la consulta al proxy /api/publico/leads. Los tokens de reCAPTCHA se piden en el momento
 * (nunca se reutilizan ni envejecen) y, ante un error de red o un 502/503/504 (servicio
 * despertando o en pleno despliegue), se reintenta UNA vez con tokens nuevos y la MISMA
 * Idempotency-Key: si el primer intento sí quedó guardado, la plataforma devuelve el original y no
 * se duplica. Devuelve { tipo, estado, json, codigo, clave } sin lanzar.
 *   tipo: 'respuesta' (hubo HTTP), 'red' (sin respuesta), 'captcha_bloqueado', 'captcha'.
 */
async function enviarConsulta(api, cuerpo) {
    const clave = crypto.randomUUID();
    const codigo = nuevoCodigoEnvio();

    for (let intento = 1; intento <= 2; intento += 1) {
        let token = '';
        let tokenServicio = '';

        try {
            [token, tokenServicio] = await tokensRecaptchaConsulta();
        } catch (error) {
            return { tipo: error && error.causa === 'recaptcha_bloqueado' ? 'captcha_bloqueado' : 'captcha', codigo, clave };
        }

        if (RECAPTCHA_SITE_KEY && !token) {
            return { tipo: 'captcha', codigo, clave };
        }

        const cabeceras = {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'Idempotency-Key': clave,
            'X-Request-Id': `${codigo}-${intento}`
        };

        if (token) {
            cabeceras['X-Recaptcha-Token'] = token;
        }

        if (tokenServicio) {
            cabeceras['X-Recaptcha-Token-Servicio'] = tokenServicio;
        }

        let respuesta;

        try {
            respuesta = await fetch(`${api}/publico/leads`, {
                method: 'POST',
                headers: cabeceras,
                body: JSON.stringify(cuerpo),
                signal: senalConTope(TIEMPO_MAXIMO_ENVIO_MS)
            });
        } catch {
            if (intento === 1) {
                await esperar(ESPERA_REINTENTO_MS);
                continue;
            }

            return { tipo: 'red', codigo, clave };
        }

        if (ESTADOS_REINTENTABLES.has(respuesta.status) && intento === 1) {
            await esperar(ESPERA_REINTENTO_MS);
            continue;
        }

        let json = null;

        try {
            json = await respuesta.json();
        } catch {
            json = null;
        }

        return { tipo: 'respuesta', estado: respuesta.status, json, codigo, clave };
    }

    return { tipo: 'red', codigo, clave };
}

/** Texto para el huésped según el resultado de enviarConsulta (siempre con el código de envío). */
function mensajeResultadoEnvio(resultado) {
    const { tipo, estado, codigo } = resultado;

    if (tipo === 'captcha_bloqueado') {
        return mensajeCaptchaBloqueado(codigo);
    }

    if (tipo === 'captcha' || estado === 403) {
        return mensajeFalloCaptcha(codigo);
    }

    if (tipo === 'red') {
        return conCodigo(
            `No pudimos conectar con el servidor. Revisa tu conexión (si usas VPN, prueba sin ella) e inténtalo de nuevo, o escríbenos por ${WHATSAPP_TEXTO}.`,
            codigo
        );
    }

    return mensajeEnvio(estado, codigo);
}

function mensajeEnvio(estadoHttp, codigo = '') {
    if (estadoHttp === 201 || estadoHttp === 200) {
        return 'Consulta enviada. Responderemos a la brevedad.';
    }

    if (estadoHttp === 409) {
        return conCodigo('Ya tenemos una consulta reciente registrada con tus datos. Escríbenos por WhatsApp si necesitas actualizarla.', codigo);
    }

    if (estadoHttp === 429) {
        return conCodigo('Recibimos demasiados intentos; espera un minuto e inténtalo de nuevo.', codigo);
    }

    if (estadoHttp === 422) {
        return conCodigo('Revisa los datos del formulario e inténtalo de nuevo.', codigo);
    }

    if (estadoHttp === 403) {
        return mensajeFalloCaptcha(codigo);
    }

    if (estadoHttp === 503) {
        return conCodigo(`No pudimos recibir tu consulta en este momento. Escríbenos por ${WHATSAPP_TEXTO} o inténtalo de nuevo en unos minutos.`, codigo);
    }

    return conCodigo(
        `No pudimos enviar tu consulta por un problema de nuestro lado. Inténtalo de nuevo en unos minutos o escríbenos por ${WHATSAPP_TEXTO}.`,
        codigo
    );
}

form?.addEventListener('input', () => {
    setStatus('');
});

form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus('');

    const api = urlApi();

    if (!api) {
        setStatus(`No pudimos enviar tu consulta desde aquí. Escríbenos por ${WHATSAPP_TEXTO}.`, 'error');
        return;
    }

    if (!submitButton) {
        return;
    }

    submitButton.disabled = true;
    const textoBoton = submitButton.textContent;
    submitButton.textContent = 'Enviando…';

    try {
        const datos = Object.fromEntries(new FormData(form).entries());
        const cuerpo = cuerpoConsulta(datos);
        const problema = problemaConsulta(cuerpo);

        if (problema) {
            setStatus(problema, 'error');
            marcarCampoConError(problema);
            return;
        }

        const resultado = await enviarConsulta(api, cuerpo);

        if (resultado.tipo === 'respuesta' && (resultado.estado === 201 || resultado.estado === 200)) {
            const referencia = typeof resultado.json?.referencia === 'string' ? resultado.json.referencia : '';
            guardarReferencia(referencia);
            const continuar = enlaceContinuarReserva(cuerpo, referencia, { soloRef: Boolean(referencia) });
            registrarEvento('generate_lead', { event_id: resultado.clave, origen: 'formulario' });
            limpiarDatosPersonales();
            setStatusConContinuar(mensajeEnvio(resultado.estado), continuar);
            return;
        }

        const mensajeError = mensajeResultadoEnvio(resultado);
        setStatus(mensajeError, 'error');
        if (resultado.tipo === 'respuesta' && resultado.estado === 422 && resultado.json?.campo) {
            marcarCampoConError(String(resultado.json.campo));
        }
    } catch (error) {
        setStatus(conCodigo(`No pudimos enviar tu consulta. Inténtalo de nuevo o escríbenos por ${WHATSAPP_TEXTO}.`, 'JS'), 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = textoBoton;
    }
});

/** Al volver a la landing con una consulta vigente: se ofrece seguir sin escribir los datos otra vez. */
function avisarConsultaVigente() {
    if (!statusElement || !referenciaGuardada()) {
        return;
    }

    const datos = form ? cuerpoConsulta(Object.fromEntries(new FormData(form).entries())) : {};
    const enlace = enlaceContinuarReserva(datos, '');

    if (enlace) {
        setStatusConContinuar('Ya recibimos tu consulta: puedes seguir con la reserva sin volver a escribir tus datos.', enlace);
    }
}

try {
    avisarConsultaVigente();
} catch {
    // El aviso es opcional: nunca debe impedir usar el formulario.
}

/**
 * #414 Flujo único de reserva: barra rápida de 3 campos (Llegada, Salida, Huéspedes).
 * Valida localmente sin pedir nombre/correo/teléfono y arma la URL directa a /reservar.
 */
function enlaceBarraReserva({ llegada, salida, personas } = {}) {
    const inicio = String(llegada ?? '').trim();
    const fin = String(salida ?? '').trim();
    const cantidad = String(personas ?? '').trim();
    const error = mensajeRango(inicio, fin, cantidad);

    if (error) {
        return { url: '', error };
    }

    const params = new URLSearchParams();
    params.set('llegada', inicio);
    params.set('salida', fin);
    params.set('personas', String(Number(cantidad)));
    return { url: `${urlPlataforma()}/reservar?${params.toString()}`, error: '' };
}

function mostrarEstadoBarra(mensaje) {
    if (!bookingBarStatus) {
        return;
    }

    bookingBarStatus.textContent = mensaje;
    bookingBarStatus.hidden = !mensaje;
    bookingBarStatus.classList.toggle('is-error', Boolean(mensaje));
}

function sincronizarFechasBarra() {
    if (!bookingBarLlegada || !bookingBarSalida) {
        return;
    }

    const hoy = isoDateFromOffset(0);
    bookingBarLlegada.min = hoy;

    if (fechaIsoValida(bookingBarLlegada.value)) {
        const siguiente = new Date(`${bookingBarLlegada.value}T00:00:00`);
        siguiente.setDate(siguiente.getDate() + 1);
        bookingBarSalida.min = formatDate(siguiente);
        if (fechaIsoValida(bookingBarSalida.value) && bookingBarSalida.value <= bookingBarLlegada.value) {
            bookingBarSalida.value = '';
        }
    } else {
        bookingBarSalida.min = isoDateFromOffset(1);
    }
}

sincronizarFechasBarra();
bookingBarLlegada?.addEventListener('change', () => {
    sincronizarFechasBarra();
    mostrarEstadoBarra('');
});
bookingBarSalida?.addEventListener('change', () => mostrarEstadoBarra(''));
bookingBarPersonas?.addEventListener('input', () => mostrarEstadoBarra(''));

bookingBar?.addEventListener('submit', (evento) => {
    evento.preventDefault();
    mostrarEstadoBarra('');
    const { url, error } = enlaceBarraReserva({
        llegada: bookingBarLlegada?.value,
        salida: bookingBarSalida?.value,
        personas: bookingBarPersonas?.value || '2'
    });

    if (error) {
        mostrarEstadoBarra(error);
        return;
    }

    irAReserva(url);
});

/* UX: botón fijo «Ver disponibilidad» oculto mientras la barra rápida, el hero o #contacto están a la vista. */
(function ocultarBotonFijoSobreCtas() {
    const fijo = document.querySelector('.sticky-cta');
    const vigilados = [
        document.querySelector('[data-barra-reserva]'),
        document.querySelector('.hero__actions'),
        document.querySelector('#contacto')
    ].filter(Boolean);

    if (!fijo || vigilados.length === 0 || typeof IntersectionObserver !== 'function') {
        return;
    }

    const visibles = new Set();
    const observador = new IntersectionObserver((entradas) => {
        entradas.forEach((e) => (e.isIntersecting ? visibles.add(e.target) : visibles.delete(e.target)));
        fijo.classList.toggle('is-oculto', visibles.size > 0);
    }, { threshold: 0 });
    vigilados.forEach((v) => observador.observe(v));
}());

/* 4 o más personas: se explica el tope de 3 por habitación y se ofrece WhatsApp con fechas y personas (sin datos personales). */
function mensajeWhatsappGrupo(inicio, fin, personas) {
    const partes = ['Hola, quiero consultar disponibilidad en Hotel Herencia'];
    if (personasValidas(personas)) {
        partes.push(`para ${Number(personas)} personas`);
    }
    if (fechaIsoValida(inicio) && fechaIsoValida(fin) && fin > inicio) {
        partes.push(`del ${inicio} al ${fin}`);
    }
    return `https://wa.me/56956491501?text=${encodeURIComponent(`${partes.join(' ')}.`)}`;
}

function actualizarAvisoGrupo() {
    const aviso = document.querySelector('[data-aviso-grupo]');
    if (!aviso || !guestsInput) {
        return;
    }
    const personas = Number(guestsInput.value);
    aviso.hidden = !(Number.isInteger(personas) && personas >= 4);
    const enlace = aviso.querySelector('[data-whatsapp-grupo]');
    if (enlace && typeof enlace.setAttribute === 'function') {
        enlace.setAttribute('href', mensajeWhatsappGrupo(checkinInput?.value, checkoutInput?.value, guestsInput.value));
    }
}

[guestsInput, checkinInput, checkoutInput].forEach((campo) => campo?.addEventListener('change', actualizarAvisoGrupo));
guestsInput?.addEventListener('input', actualizarAvisoGrupo);
try {
    actualizarAvisoGrupo();
} catch {
    // Aviso opcional.
}

function formatearClp(monto) {
    if (typeof monto !== 'number' || !Number.isFinite(monto) || monto <= 0) return '';
    return `$${Math.round(monto).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

function actualizarPreciosTarjetas(tipos, doc = typeof document !== 'undefined' ? document : null) {
    if (!doc || typeof doc.querySelectorAll !== 'function' || !Array.isArray(tipos)) return 0;
    const mapa = new Map();
    for (const t of tipos) {
        if (t && typeof t.tipo === 'string' && typeof t.precio_base_clp === 'number' && t.precio_base_clp > 0) {
            mapa.set(t.tipo, t.precio_base_clp);
        }
    }
    let actualizadas = 0;
    doc.querySelectorAll('[data-precio-tipo]').forEach((el) => {
        const tipo = el.getAttribute('data-precio-tipo');
        const precio = mapa.get(tipo);
        if (precio) {
            el.textContent = `Desde ${formatearClp(precio)} / noche · IVA incl.`;
            actualizadas += 1;
        }
    });
    return actualizadas;
}

async function cargarTarifasPublicas() {
    if (typeof fetch !== 'function' || typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return;
    if (!document.querySelectorAll('[data-precio-tipo]').length) return;
    try {
        const res = await fetch(`${urlPlataforma()}/api/publico/tarifas`, { method: 'GET' });
        if (!res.ok) return;
        const datos = await res.json();
        if (datos && Array.isArray(datos.tipos)) {
            actualizarPreciosTarjetas(datos.tipos, document);
        }
    } catch {
        // Silencioso: conserva el texto de respaldo si la red falla.
    }
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('DOMContentLoaded', cargarTarifasPublicas);
}

function iniciarBuscadorFaq() {
    if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;
    const input = document.getElementById('faq-buscar');
    if (!input || typeof document.querySelectorAll !== 'function') return;
    const items = Array.from(document.querySelectorAll('.faq-item'));

    function filtrar(termino) {
        const q = String(termino || '').trim().toLowerCase();
        for (const item of items) {
            const texto = (item.textContent || '').toLowerCase();
            const coincide = !q || texto.includes(q);
            item.hidden = !coincide;
            if (q && coincide) item.open = true;
        }
    }

    input.addEventListener('input', () => filtrar(input.value));

    document.querySelectorAll('[data-faq-chip]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const clave = (btn.getAttribute('data-faq-chip') || '').toLowerCase();
            input.value = '';
            filtrar('');
            const objetivo = items.find((item) => (item.textContent || '').toLowerCase().includes(clave));
            if (objetivo) {
                objetivo.open = true;
                if (typeof objetivo.scrollIntoView === 'function') {
                    objetivo.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        });
    });
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('DOMContentLoaded', iniciarBuscadorFaq);
}
