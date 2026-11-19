const DESTINO = process.env.SERVICIO_LEADS_URL || 'https://servicio-production-a2d7.up.railway.app/publico/leads';
const TOPE_CUERPO = 8192;
const TOPE_RESPUESTA = 65536;
const SITEVERIFY = 'https://www.google.com/recaptcha/api/siteverify';
// Host del <link rel="canonical"> de index.html. RECAPTCHA_HOSTNAMES solo amplía.
const HOST_CANONICO = 'hotelherencia.cl';
// Producción responde en www (el dominio raíz redirige 308 a www), así que el token llega con hostname www.
const HOST_WWW = 'www.hotelherencia.cl';
const ANTIGUEDAD_MAXIMA_MS = 120000;
const { randomUUID } = require('node:crypto');

// Lista blanca del cuerpo: cualquier otra clave se rechaza (422), nada se reenvía tal cual.
const CAMPOS = new Set(['nombre', 'correo', 'telefono', 'huespedes', 'check_in', 'check_out', 'mensaje']);
const TOPES = { nombre: 200, correo: 320, telefono: 40, mensaje: 2000 };
const MAX_PERSONAS = 30;
const MAX_NOCHES = 30;
const PATRON_REQUEST_ID = /^[A-Za-z0-9._-]{1,64}$/;
const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const PATRON_CORREO = /^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$/;
// Controles C0/C1, DEL y marcas bidi invisibles (spoofing de texto); \n y \t solo en el mensaje.
const CONTROLES = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

class EntradaInvalida extends Error {}

function textoLimpio(valor, campo, { multilinea = false } = {}) {
    if (valor == null) {
        return '';
    }
    if (typeof valor !== 'string') {
        throw new EntradaInvalida(campo);
    }
    let texto = valor.normalize('NFC').replace(CONTROLES, '');
    texto = multilinea ? texto.replace(/\r\n?/g, '\n') : texto.replace(/[\r\n\t]+/g, ' ');
    texto = texto.replace(/[ \u00A0]{2,}/g, ' ').trim();
    if (texto.length > TOPES[campo]) {
        throw new EntradaInvalida(campo);
    }
    return texto;
}

function fechaReal(valor) {
    if (typeof valor !== 'string' || !PATRON_FECHA.test(valor)) {
        return false;
    }
    const d = new Date(`${valor}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}

/**
 * Normaliza y valida el cuerpo de la consulta (NFC, sin caracteres de control, topes de largo,
 * formato de correo y teléfono, fechas ISO reales con rango sano). Devuelve el objeto limpio que
 * se reenvía a la plataforma; ante cualquier desvío lanza EntradaInvalida con el nombre del campo.
 */
function limpiarConsulta(crudo) {
    if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) {
        throw new EntradaInvalida('cuerpo');
    }
    for (const clave of Object.keys(crudo)) {
        if (!CAMPOS.has(clave)) {
            throw new EntradaInvalida('cuerpo');
        }
    }
    const nombre = textoLimpio(crudo.nombre, 'nombre');
    const correo = textoLimpio(crudo.correo, 'correo').toLowerCase();
    const telefono = textoLimpio(crudo.telefono, 'telefono');
    const mensaje = textoLimpio(crudo.mensaje, 'mensaje', { multilinea: true });
    if (!nombre) {
        throw new EntradaInvalida('nombre');
    }
    if (!PATRON_CORREO.test(correo)) {
        throw new EntradaInvalida('correo');
    }
    const digitos = telefono.replace(/\D/g, '');
    if (!/^[+\d\s().-]+$/.test(telefono) || digitos.length < 8 || digitos.length > 15) {
        throw new EntradaInvalida('telefono');
    }
    let huespedes = null;
    if (crudo.huespedes != null) {
        if (!Number.isInteger(crudo.huespedes) || crudo.huespedes < 1 || crudo.huespedes > MAX_PERSONAS) {
            throw new EntradaInvalida('huespedes');
        }
        huespedes = crudo.huespedes;
    }
    const checkIn = crudo.check_in == null ? null : crudo.check_in;
    const checkOut = crudo.check_out == null ? null : crudo.check_out;
    if ((checkIn == null) !== (checkOut == null)) {
        throw new EntradaInvalida('fechas');
    }
    if (checkIn != null) {
        if (!fechaReal(checkIn) || !fechaReal(checkOut) || checkOut <= checkIn) {
            throw new EntradaInvalida('fechas');
        }
        const noches = (Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86400000;
        // Margen de un día para husos horarios: la plataforma valida otra vez contra su fecha.
        const ayer = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
        if (noches > MAX_NOCHES || checkIn < ayer) {
            throw new EntradaInvalida('fechas');
        }
    }
    return {
        nombre,
        correo,
        telefono,
        huespedes,
        check_in: checkIn,
        check_out: checkOut,
        mensaje: mensaje || null
    };
}

/** Una línea JSON por petición: sin cuerpo, sin token, sin datos personales. */
function registrar(datos) {
    try {
        console.log(JSON.stringify({ ts: new Date().toISOString(), servicio: 'landing-leads', ...datos }));
    } catch {
        // El log nunca interrumpe la respuesta.
    }
}

function cabeceraUnica(valor) {
    return typeof valor === 'string' ? valor.trim() : '';
}

function hostsPermitidos() {
    const extra = String(process.env.RECAPTCHA_HOSTNAMES || '')
        .split(',')
        .map((host) => host.trim().toLowerCase())
        .filter(Boolean);
    return [HOST_CANONICO, HOST_WWW, ...extra];
}

const PUNTAJE_POR_DEFECTO = 0.5;

/** Umbral efectivo. Acepta coma decimal ("0,5"); un valor ilegible ya no
 * rechaza todo en silencio: se usa 0.5 (igual que la plataforma) y se avisa. */
function puntajeMinimo() {
    const crudo = process.env.RECAPTCHA_MIN_SCORE;
    if (crudo === undefined || String(crudo).trim() === '') {
        return { minimo: null, invalido: false };
    }
    const valor = Number(String(crudo).trim().replace(',', '.'));
    if (!Number.isFinite(valor) || valor < 0 || valor > 1) {
        return { minimo: PUNTAJE_POR_DEFECTO, invalido: true };
    }
    return { minimo: valor, invalido: false };
}

// Último punto de decisión de este repo: sin verificación exitosa no se llama a DESTINO.
// No registra token, secreto ni cuerpo; no devuelve error-codes al cliente.
/** Devuelve { ok, motivo, diagnostico }. El diagnóstico es solo para el log:
 * códigos de error de Google, acción, host, puntaje y antigüedad; nunca el
 * token ni el secreto, y no se devuelve al cliente. */
async function verificarRecaptcha(token, secreto) {
    const { minimo, invalido } = puntajeMinimo();
    const diagnostico = {};
    if (invalido) {
        diagnostico.min_score_invalido = true;
    }
    let datos;
    try {
        const respuesta = await fetch(SITEVERIFY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ secret: secreto, response: token }).toString(),
            redirect: 'error',
            signal: AbortSignal.timeout(5000)
        });
        if (!respuesta.ok) {
            return { ok: false, motivo: `siteverify_http_${respuesta.status}`, diagnostico };
        }
        datos = await respuesta.json();
    } catch {
        return { ok: false, motivo: 'siteverify_no_responde', diagnostico };
    }
    if (!datos || typeof datos !== 'object') {
        return { ok: false, motivo: 'siteverify_ilegible', diagnostico };
    }
    const marca = typeof datos.challenge_ts === 'string' ? Date.parse(datos.challenge_ts) : NaN;
    diagnostico.codigos = Array.isArray(datos['error-codes']) ? datos['error-codes'].slice(0, 5).map((c) => String(c).slice(0, 40)) : [];
    diagnostico.accion = typeof datos.action === 'string' ? datos.action.slice(0, 40) : null;
    diagnostico.hostname = typeof datos.hostname === 'string' ? datos.hostname.slice(0, 80) : null;
    diagnostico.puntaje = typeof datos.score === 'number' ? datos.score : null;
    diagnostico.edad_s = Number.isFinite(marca) ? Math.round((Date.now() - marca) / 1000) : null;
    let motivo = null;
    if (datos.success !== true) {
        motivo = 'success_false';
    } else if (datos.action !== 'consulta') {
        motivo = 'accion_distinta';
    } else if (typeof datos.hostname !== 'string' || !hostsPermitidos().includes(datos.hostname.toLowerCase())) {
        motivo = 'host_no_permitido';
    } else if (!Number.isFinite(marca) || Date.now() - marca > ANTIGUEDAD_MAXIMA_MS) {
        motivo = 'token_vencido';
    } else if (minimo !== null && !(typeof datos.score === 'number' && datos.score >= minimo)) {
        motivo = 'puntaje_bajo';
    }
    return { ok: motivo === null, motivo, diagnostico };
}

function leerCuerpo(req) {
    return new Promise((resolve, reject) => {
        const partes = [];
        let total = 0;

        req.on('data', (parte) => {
            total += parte.length;

            if (total > TOPE_CUERPO) {
                reject(Object.assign(new Error('cuerpo'), { status: 413 }));
                req.destroy();
                return;
            }

            partes.push(parte);
        });
        req.on('end', () => resolve(Buffer.concat(partes)));
        req.on('error', reject);
    });
}

module.exports = async function handler(req, res) {
    const inicio = Date.now();
    const entrante = cabeceraUnica(req.headers && req.headers['x-request-id']);
    const requestId = PATRON_REQUEST_ID.test(entrante) ? entrante : randomUUID().replace(/-/g, '').slice(0, 16);
    res.setHeader('X-Request-Id', requestId);
    const statusOriginal = res.status.bind(res);
    let resultado = 'ok';
    let extraLog = {};
    res.status = (codigo) => {
        registrar({ request_id: requestId, metodo: req.method, estado: codigo, resultado, ms: Date.now() - inicio, ...extraLog });
        return statusOriginal(codigo);
    };

    if (req.method !== 'POST') {
        resultado = 'metodo_no_permitido';
        res.setHeader('Allow', 'POST');
        res.status(405).json({ detail: 'método no permitido' });
        return;
    }

    let cuerpo;

    try {
        if (req.readableEnded && req.body != null && req.body !== '') {
            const texto = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            cuerpo = Buffer.from(texto);
            if (cuerpo.length > TOPE_CUERPO) {
                throw Object.assign(new Error('cuerpo'), { status: 413 });
            }
        } else {
            cuerpo = await leerCuerpo(req);
        }
    } catch (error) {
        const codigo = error && error.status === 413 ? 413 : 400;
        resultado = codigo === 413 ? 'cuerpo_grande' : 'cuerpo_ilegible';
        res.status(codigo).json({ detail: codigo === 413 ? 'cuerpo demasiado grande' : 'no se pudo leer el envío' });
        return;
    }

    const clave = cabeceraUnica(req.headers['idempotency-key']);
    const token = cabeceraUnica(req.headers['x-recaptcha-token']);
    const tokenServicio = cabeceraUnica(req.headers['x-recaptcha-token-servicio']);

    if (!clave || clave.length > 128 || /[^\x21-\x7e]/.test(clave)) {
        resultado = 'entrada_rechazada';
        res.status(422).json({ detail: 'falta la cabecera Idempotency-Key' });
        return;
    }

    if (token.length > 4096 || /[\r\n]/.test(token) || tokenServicio.length > 4096 || /[\r\n]/.test(tokenServicio)) {
        resultado = 'entrada_rechazada';
        res.status(422).json({ detail: 'no se pudo verificar el envío' });
        return;
    }

    let limpio;

    try {
        limpio = limpiarConsulta(JSON.parse(cuerpo.toString('utf8')));
    } catch (error) {
        resultado = 'entrada_rechazada';
        const campo = error instanceof EntradaInvalida ? error.message : 'cuerpo';
        res.status(422).json({ detail: 'revisa los datos del formulario', campo });
        return;
    }

    const secreto = process.env.RECAPTCHA_SECRET_KEY;

    if (!secreto) {
        resultado = 'sin_secreto';
        res.status(503).json({ detail: 'no se pudo enviar' });
        return;
    }

    if (!token) {
        resultado = 'recaptcha_rechazado';
        extraLog = { motivo: 'sin_token' };
        res.status(403).json({ detail: 'no se pudo verificar el envío' });
        return;
    }

    const veredicto = await verificarRecaptcha(token, secreto);
    if (veredicto.diagnostico.min_score_invalido) {
        extraLog = { min_score_invalido: true };
    }
    if (!veredicto.ok) {
        resultado = 'recaptcha_rechazado';
        extraLog = { motivo: veredicto.motivo, recaptcha: veredicto.diagnostico };
        res.status(403).json({ detail: 'no se pudo verificar el envío' });
        return;
    }

    const cabeceras = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Idempotency-Key': clave,
        // Google acepta cada token una sola vez: la plataforma necesita uno propio sin usar.
        'X-Recaptcha-Token': tokenServicio || token,
        'X-Request-Id': requestId
    };

    let respuesta;

    try {
        respuesta = await fetch(DESTINO, {
            method: 'POST',
            headers: cabeceras,
            body: JSON.stringify(limpio),
            redirect: 'error',
            signal: AbortSignal.timeout(12000)
        });
    } catch {
        resultado = 'destino_caido';
        res.status(502).json({ detail: 'no se pudo enviar' });
        return;
    }

    // SA-LND-01 (auditoría 2026-11-17): la respuesta se sirve en el origen de la
    // landing. Solo se reenvía JSON y siempre con tipo JSON fijo: una página de
    // error HTML del destino (o un tipo distinto) no se refleja tal cual.
    const tipo = String(respuesta.headers.get('content-type') || '').toLowerCase();
    const texto = Buffer.from(await respuesta.arrayBuffer()).subarray(0, TOPE_RESPUESTA).toString('utf8');
    let esJson = tipo.split(';')[0].trim() === 'application/json';
    if (esJson) {
        try {
            JSON.parse(texto);
        } catch {
            esJson = false;
        }
    }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!esJson) {
        resultado = `destino_no_json_${respuesta.status}`;
        res.status(502).json({ detail: 'no se pudo enviar' });
        return;
    }

    resultado = respuesta.status < 300 ? 'ok' : `destino_${respuesta.status}`;
    res.status(respuesta.status);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(texto);
};

module.exports.limpiarConsulta = limpiarConsulta;

module.exports.config = {
    api: {
        bodyParser: false
    }
};
