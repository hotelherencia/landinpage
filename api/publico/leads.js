const DESTINO = 'https://servicio-production-a2d7.up.railway.app/publico/leads';
const TOPE_CUERPO = 8192;
const TOPE_RESPUESTA = 65536;

function cabeceraUnica(valor) {
    return typeof valor === 'string' ? valor.trim() : '';
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

    const cabeceras = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Idempotency-Key': clave
    };

    if (token) {
        cabeceras['X-Recaptcha-Token'] = token;
    }

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
