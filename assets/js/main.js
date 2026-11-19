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

/** Solo entra a la URL lo que pasa la lista blanca: fechas reales, rango sano, personas 1..30, ref opaca. */
function enlaceContinuarReserva(cuerpo, referencia) {
    const params = new URLSearchParams();
    const inicio = cuerpo?.check_in;
    const fin = cuerpo?.check_out;

    if (fechaIsoValida(inicio) && fechaIsoValida(fin) && !mensajeRango(inicio, fin, 1)) {
        // Parámetros canónicos compartidos con la plataforma: llegada / salida / personas.
        params.set('llegada', inicio);
        params.set('salida', fin);
        params.set('personas', String(personasValidas(cuerpo.huespedes) ? Number(cuerpo.huespedes) : 1));
    }

    const ref = referenciaValida(referencia) ? referencia : referenciaGuardada();

    if (ref) {
        params.set('ref', ref);
    }

    if (!params.has('llegada') && !params.has('ref')) {
        return '';
    }

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

function prepararRecaptcha() {
    if (!RECAPTCHA_SITE_KEY || document.querySelector('script[data-recaptcha]')) {
        return;
    }

    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(RECAPTCHA_SITE_KEY)}`;
    script.async = true;
    script.dataset.recaptcha = 'v3';
    document.head.append(script);
}

function tokenRecaptcha(accion) {
    if (!RECAPTCHA_SITE_KEY) {
        return Promise.resolve('');
    }

    prepararRecaptcha();

    const pedir = () => new Promise((resolve, reject) => {
        const inicio = Date.now();

        const ejecutar = () => {
            window.grecaptcha.ready(() => {
                window.grecaptcha
                    .execute(RECAPTCHA_SITE_KEY, { action: accion })
                    .then((token) => {
                        if (typeof token === 'string' && token.length > 20) {
                            resolve(token);
                            return;
                        }

                        reject(new Error('recaptcha'));
                    })
                    .catch(reject);
            });
        };

        if (window.grecaptcha) {
            ejecutar();
            return;
        }

        const reloj = window.setInterval(() => {
            if (window.grecaptcha) {
                window.clearInterval(reloj);
                ejecutar();
            } else if (Date.now() - inicio > 8000) {
                window.clearInterval(reloj);
                reject(new Error('recaptcha'));
            }
        }, 50);
    });

    return pedir().catch(() => pedir());
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

function mensajeFalloCaptcha() {
    return 'No se pudo verificar el envío. Actualiza la página o escríbenos por teléfono o WhatsApp.';
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
    const decorado = conReferencia(href);

    if (decorado !== href && typeof enlace.setAttribute === 'function') {
        enlace.setAttribute('href', decorado);
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
function mostrarDisponibilidadConEnlace(mensaje, enlace, textoEnlace, accion) {
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
    // Incluye la referencia guardada si el visitante ya envió una consulta en este navegador.
    const enlaceSoloFechas = enlaceContinuarReserva(cuerpo, '');
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
            enlaceSoloFechas,
            'Seguir sin mis datos'
        );
        return;
    }

    if (!confirmado) {
        // UX-06: nunca se envía una consulta sin que el visitante lo pida. Se le ofrece explícitamente.
        mostrarDisponibilidadConEnlace(
            'Para llevar tu nombre y contacto a la reserva, primero enviamos tu consulta a recepción (no confirma la estadía).',
            enlaceSoloFechas,
            'Seguir sin enviar mis datos',
            {
                texto: 'Enviar consulta y continuar',
                alPulsar: () => irAReservarConFechas({ conLead: true, confirmado: true })
            }
        );
        return;
    }

    const api = urlApi();

    if (!api || !disponibilidadBoton) {
        mostrarDisponibilidad('Vas a la reserva solo con las fechas; el contacto se pide allá.');
        irAReserva(enlaceSoloFechas);
        return;
    }

    mostrarDisponibilidad('Enviando consulta…');
    disponibilidadBoton.disabled = true;

    try {
        const cabeceras = {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'Idempotency-Key': crypto.randomUUID()
        };
        let token = '';
        let tokenServicio = '';

        try {
            [token, tokenServicio] = await tokensRecaptchaConsulta();
        } catch {
            mostrarDisponibilidadConEnlace(
                'No se pudo verificar el envío. Inténtalo de nuevo en unos segundos.',
                enlaceSoloFechas,
                'Seguir sin mis datos'
            );
            return;
        }

        if (RECAPTCHA_SITE_KEY && !token) {
            mostrarDisponibilidadConEnlace(
                'No se pudo verificar el envío. Inténtalo de nuevo en unos segundos.',
                enlaceSoloFechas,
                'Seguir sin mis datos'
            );
            return;
        }

        if (token) {
            cabeceras['X-Recaptcha-Token'] = token;
        }

        if (tokenServicio) {
            cabeceras['X-Recaptcha-Token-Servicio'] = tokenServicio;
        }

        const respuesta = await fetch(`${api}/publico/leads`, {
            method: 'POST',
            headers: cabeceras,
            body: JSON.stringify(cuerpo)
        });

        if (respuesta.status === 403) {
            mostrarDisponibilidadConEnlace(
                'No se pudo verificar el envío. Inténtalo de nuevo en unos segundos.',
                enlaceSoloFechas,
                'Seguir sin mis datos'
            );
            return;
        }

        if (respuesta.status !== 201 && respuesta.status !== 200) {
            mostrarDisponibilidadConEnlace(
                mensajeEnvio(respuesta.status),
                enlaceSoloFechas,
                'Seguir sin mis datos'
            );
            return;
        }

        let referencia = '';

        try {
            const json = await respuesta.json();
            referencia = typeof json.referencia === 'string' ? json.referencia : '';
        } catch {
            referencia = '';
        }

        guardarReferencia(referencia);
        registrarEvento('generate_lead', { event_id: cabeceras['Idempotency-Key'], origen: 'ver_disponibilidad' });
        irAReserva(enlaceContinuarReserva(cuerpo, referencia));
    } catch (error) {
        mostrarDisponibilidadConEnlace(
            'No se pudo guardar la consulta. Inténtalo de nuevo o escríbenos por WhatsApp.',
            enlaceSoloFechas,
            'Seguir sin mis datos'
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

    if (cuerpo.correo.length > 320 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cuerpo.correo)) {
        return 'Indica un correo válido.';
    }

    const digitos = cuerpo.telefono.replace(/\D/g, '');

    if (cuerpo.telefono.length > 40 || digitos.length < 8 || digitos.length > 15) {
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

function mensajeEnvio(estadoHttp) {
    if (estadoHttp === 201 || estadoHttp === 200) {
        return 'Consulta enviada. Responderemos a la brevedad.';
    }

    if (estadoHttp === 429) {
        return 'Recibimos demasiados intentos; espera un minuto e inténtalo de nuevo.';
    }

    if (estadoHttp === 422) {
        return 'Revisa los datos del formulario e inténtalo de nuevo.';
    }

    if (estadoHttp === 503) {
        return 'No pudimos recibir tu consulta en este momento. Escríbenos por WhatsApp al +56 9 5649 1501 o inténtalo de nuevo más tarde.';
    }

    return 'No se pudo enviar. Inténtalo por teléfono o WhatsApp.';
}

form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus('');

    const api = urlApi();

    if (!api) {
        setStatus('No se pudo enviar. Inténtalo por teléfono o WhatsApp.', 'error');
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

        const cabeceras = {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'Idempotency-Key': crypto.randomUUID()
        };
        let token = '';
        let tokenServicio = '';

        try {
            [token, tokenServicio] = await tokensRecaptchaConsulta();
        } catch {
            setStatus(mensajeFalloCaptcha(), 'error');
            return;
        }

        if (RECAPTCHA_SITE_KEY && !token) {
            setStatus(mensajeFalloCaptcha(), 'error');
            return;
        }

        if (token) {
            cabeceras['X-Recaptcha-Token'] = token;
        }

        if (tokenServicio) {
            cabeceras['X-Recaptcha-Token-Servicio'] = tokenServicio;
        }

        const respuesta = await fetch(`${api}/publico/leads`, {
            method: 'POST',
            headers: cabeceras,
            body: JSON.stringify(cuerpo)
        });

        if (respuesta.status === 201 || respuesta.status === 200) {
            let referencia = '';

            try {
                const json = await respuesta.json();
                referencia = typeof json.referencia === 'string' ? json.referencia : '';
            } catch {
                referencia = '';
            }

            guardarReferencia(referencia);
            const continuar = enlaceContinuarReserva(cuerpo, referencia);
            registrarEvento('generate_lead', { event_id: cabeceras['Idempotency-Key'], origen: 'formulario' });
            limpiarDatosPersonales();
            setStatusConContinuar(mensajeEnvio(respuesta.status), continuar);
            return;
        }

        if (respuesta.status === 403) {
            setStatus(mensajeFalloCaptcha(), 'error');
            return;
        }

        setStatus(mensajeEnvio(respuesta.status), 'error');
    } catch (error) {
        setStatus('No se pudo enviar. Inténtalo por teléfono o WhatsApp.', 'error');
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

/* UX: botón fijo «Consultar reserva» oculto mientras el hero o el formulario están a la vista. */
(function ocultarBotonFijoSobreCtas() {
    const fijo = document.querySelector('.sticky-cta');
    const vigilados = [document.querySelector('.hero__actions'), document.querySelector('#contacto')].filter(Boolean);

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
