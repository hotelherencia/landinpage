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

function enlaceContinuarReserva(cuerpo, referencia) {
    if (!cuerpo.check_in || !cuerpo.check_out) {
        return '';
    }

    const params = new URLSearchParams({
        inicio: cuerpo.check_in,
        fin: cuerpo.check_out,
        personas: String(cuerpo.huespedes || 1)
    });

    if (/^[A-Za-z0-9_-]{20,128}$/.test(referencia || '')) {
        params.set('ref', referencia);
    }

    return `${urlPlataforma()}/reservar?${params.toString()}`;
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
        checkoutInput.setCustomValidity('La fecha de salida debe ser posterior al check-in.');
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

function mensajeFalloCaptcha() {
    return 'No se pudo verificar el envío. Actualiza la página o escríbenos por teléfono o WhatsApp.';
}

prepararRecaptcha();

function urlPlataforma() {
    return String(window.LANDING_PLATAFORMA_URL || 'https://plataforma-salman-herencia-oficial.vercel.app').replace(/\/+$/, '');
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

    if (fin <= inicio) {
        return 'La salida debe ser posterior a la llegada.';
    }

    if (inicio < hoyLocal()) {
        return 'La llegada no puede ser una fecha pasada.';
    }

    const noches = (new Date(`${fin}T00:00:00`) - new Date(`${inicio}T00:00:00`)) / 86400000;

    if (noches > 30) {
        return 'El rango supera las 30 noches.';
    }

    const n = Number(personas);

    if (!Number.isInteger(n) || n < 1 || n > 30) {
        return 'Personas debe estar entre 1 y 30.';
    }

    return '';
}

function mostrarDisponibilidad(mensaje) {
    if (!disponibilidadEstado) {
        return;
    }

    disponibilidadEstado.textContent = mensaje;
    disponibilidadEstado.hidden = !mensaje;
}

async function irAReservarConFechas({ conLead }) {
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
    const enlaceSoloFechas = enlaceContinuarReserva(cuerpo, '');

    if (problemaContacto || !conLead) {
        mostrarDisponibilidad(
            problemaContacto
                ? 'Vas a la reserva sin consulta previa: allí escribirás nombre y contacto. Para llevarlos, completa el formulario y pulsa Enviar consulta, o rellena nombre, correo y teléfono antes de Ver disponibilidad.'
                : 'Vas a la reserva solo con las fechas; el contacto se pide allá.'
        );
        window.location.assign(enlaceSoloFechas);
        return;
    }

    const api = urlApi();

    if (!api || !disponibilidadBoton) {
        mostrarDisponibilidad('Vas a la reserva solo con las fechas; el contacto se pide allá.');
        window.location.assign(enlaceSoloFechas);
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

        try {
            token = await tokenRecaptcha('consulta');
        } catch {
            mostrarDisponibilidad(
                'No se pudo verificar el envío. Abriremos la reserva; completa nombre y contacto allí.'
            );
            window.location.assign(enlaceSoloFechas);
            return;
        }

        if (RECAPTCHA_SITE_KEY && !token) {
            mostrarDisponibilidad(
                'No se pudo verificar el envío. Abriremos la reserva; completa nombre y contacto allí.'
            );
            window.location.assign(enlaceSoloFechas);
            return;
        }

        if (token) {
            cabeceras['X-Recaptcha-Token'] = token;
        }

        const respuesta = await fetch(`${api}/publico/leads`, {
            method: 'POST',
            headers: cabeceras,
            body: JSON.stringify(cuerpo)
        });

        if (respuesta.status === 403) {
            mostrarDisponibilidad(
                'No se pudo verificar el envío. Abriremos la reserva; completa nombre y contacto allí.'
            );
            window.location.assign(enlaceSoloFechas);
            return;
        }

        if (respuesta.status !== 201 && respuesta.status !== 200) {
            mostrarDisponibilidad(
                'No se pudo guardar la consulta. Abriremos la reserva; completa nombre y contacto allí.'
            );
            window.location.assign(enlaceSoloFechas);
            return;
        }

        let referencia = '';

        try {
            const json = await respuesta.json();
            referencia = typeof json.referencia === 'string' ? json.referencia : '';
        } catch {
            referencia = '';
        }

        window.location.assign(enlaceContinuarReserva(cuerpo, referencia));
    } catch (error) {
        mostrarDisponibilidad(
            'No se pudo guardar la consulta. Abriremos la reserva; completa nombre y contacto allí.'
        );
        window.location.assign(enlaceSoloFechas);
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
            return;
        }

        evento.preventDefault();
        irAReservarConFechas({ conLead: true });
    });
});

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

    try {
        const datos = Object.fromEntries(new FormData(form).entries());
        const cuerpo = cuerpoConsulta(datos);
        const problema = problemaConsulta(cuerpo);

        if (problema) {
            setStatus(problema, 'error');
            return;
        }

        const cabeceras = {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'Idempotency-Key': crypto.randomUUID()
        };
        let token = '';

        try {
            token = await tokenRecaptcha('consulta');
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

            const continuar = enlaceContinuarReserva(cuerpo, referencia);
            form.reset();
            syncDateConstraints();
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
    }
});
