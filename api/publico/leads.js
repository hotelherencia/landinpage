const DESTINO = 'https://servicio-production-a2d7.up.railway.app/publico/leads';
const TOPE_CUERPO = 8192;
const TOPE_RESPUESTA = 65536;
const SITEVERIFY = 'https://www.google.com/recaptcha/api/siteverify';
// Host del <link rel="canonical"> de index.html. RECAPTCHA_HOSTNAMES solo amplía.
const HOST_CANONICO = 'hotelherencia.cl';
const ANTIGUEDAD_MAXIMA_MS = 120000;

function cabeceraUnica(valor) {
    return typeof valor === 'string' ? valor.trim() : '';
}

function hostsPermitidos() {
    const extra = String(process.env.RECAPTCHA_HOSTNAMES || '')
        .split(',')
        .map((host) => host.trim().toLowerCase())
        .filter(Boolean);
    return [HOST_CANONICO, ...extra];
}

function puntajeSuficiente(score) {
    const minimo = process.env.RECAPTCHA_MIN_SCORE;
    if (minimo === undefined || minimo === '') {
        return true;
    }
    const valor = Number(minimo);
    return Number.isFinite(valor) && typeof score === 'number' && score >= valor;
}

// Último punto de decisión de este repo: sin verificación exitosa no se llama a DESTINO.
// No registra token, secreto ni cuerpo; no devuelve error-codes al cliente.
async function recaptchaValido(token, secreto) {
    try {
        const respuesta = await fetch(SITEVERIFY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ secret: secreto, response: token }).toString(),
            redirect: 'error',
            signal: AbortSignal.timeout(5000)
        });
        if (!respuesta.ok) {
            return false;
        }
        const datos = await respuesta.json();
        const marca = datos && typeof datos.challenge_ts === 'string' ? Date.parse(datos.challenge_ts) : NaN;
        return Boolean(datos)
            && datos.success === true
            && datos.action === 'consulta'
            && typeof datos.hostname === 'string'
            && hostsPermitidos().includes(datos.hostname.toLowerCase())
            && Number.isFinite(marca)
            && Date.now() - marca <= ANTIGUEDAD_MAXIMA_MS
            && puntajeSuficiente(datos.score);
    } catch {
        return false;
    }
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
    if (req.method !== 'POST') {
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
        res.status(codigo).json({ detail: codigo === 413 ? 'cuerpo demasiado grande' : 'no se pudo leer el envío' });
        return;
    }

    const clave = cabeceraUnica(req.headers['idempotency-key']);
    const token = cabeceraUnica(req.headers['x-recaptcha-token']);

    if (!clave || clave.length > 128 || /[^\x21-\x7e]/.test(clave)) {
        res.status(422).json({ detail: 'falta la cabecera Idempotency-Key' });
        return;
    }

    if (token.length > 4096 || /[\r\n]/.test(token)) {
        res.status(422).json({ detail: 'no se pudo verificar el envío' });
        return;
    }

    const secreto = process.env.RECAPTCHA_SECRET_KEY;

    if (!secreto) {
        res.status(503).json({ detail: 'no se pudo enviar' });
        return;
    }

    if (!token || !(await recaptchaValido(token, secreto))) {
        res.status(403).json({ detail: 'no se pudo verificar el envío' });
        return;
    }

    const cabeceras = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Idempotency-Key': clave,
        'X-Recaptcha-Token': token
    };

    let respuesta;

    try {
        respuesta = await fetch(DESTINO, {
            method: 'POST',
            headers: cabeceras,
            body: cuerpo,
            redirect: 'error',
            signal: AbortSignal.timeout(12000)
        });
    } catch {
        res.status(502).json({ detail: 'no se pudo enviar' });
        return;
    }

    const texto = Buffer.from(await respuesta.arrayBuffer()).subarray(0, TOPE_RESPUESTA).toString('utf8');
    const tipo = respuesta.headers.get('content-type') || 'application/json; charset=utf-8';

    res.status(respuesta.status);
    res.setHeader('Content-Type', tipo);
    res.setHeader('Cache-Control', 'no-store');
    res.send(texto);
};

module.exports.config = {
    api: {
        bodyParser: false
    }
};
