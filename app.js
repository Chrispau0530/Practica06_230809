import express from 'express';
import session from 'express-session';
import bodyParser from 'body-parser';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment-timezone';
import os from 'os';
import mongoose from 'mongoose';
import { storeLoginData, deleteUserBySessionId, updateSessionTimestamps } from './models.js';

mongoose.connect('mongodb+srv://rodriguezperezchristianpaul:Mapachito070323@cluster0chris.v5bqv.mongodb.net/practica06_db?retryWrites=true&w=majority&appName=Cluster0Chris')
    .then(() => console.log("Mongodb atlas connected"))
    .catch((error) => console.error(error));

const app = express();
const PORT = 3000;

app.listen(PORT, () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Almacenamiento en memoria para sesiones
const sessions = {};

// Configuración de sesión
app.use(
    session({
        secret: "CPRP-SesionesHTTP-VariablesDeSesion",
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 5 * 60 * 1000 }, // 5 minutos
    })
);

app.get('/', (req, res) => {
    return res.status(200).json({
        message: "Bienvenid@ al API de Control de Sesiones",
        author: "Christian Paul Rodriguez Perez",
    });
});

// Obtener la IP local del servidor
const getLocalIp = () => {
    const networkInterfaces = os.networkInterfaces();
    for (const interfaceName in networkInterfaces) {
        const interfaces = networkInterfaces[interfaceName];
        for (const iface of interfaces) {
            if (iface.family === "IPv4" && !iface.internal) {
                return iface.address;
            }
        }
    }
    return null;
};

// Ruta de inicio de sesión
app.post('/login', async (req, res) => {
    const { email, nickname, macAddress } = req.body;

    if (!email || !nickname || !macAddress) {
        return res.status(400).json({ message: "Se esperan campos requeridos" });
    }

    const sessionId = uuidv4();
    const now = new Date();

    if (!req.session.createdAt) {
        req.session.createdAt = now;
    }
    req.session.lastAccess = now;

    // Obtener fechas en formato CDMX
    const createAD_CDMX = moment(req.session.createdAt).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss');
    const lastAccess = moment(req.session.lastAccess).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss');

    sessions[sessionId] = {
        sessionId,
        email,
        nickname,
        macAddress,
        ip: getLocalIp(),
        createAD_CDMX: now,
        lastAccess: now,
    };

    try {
        await storeLoginData(sessionId, email, nickname, macAddress, getLocalIp(), now, now);
        console.log('Datos almacenados en MongoDB.');
    } catch (error) {
        console.error('Error al guardar en MongoDB:', error);
    }

    res.status(200).json({
        message: "Se ha logeado de manera exitosa y se ha almacenado correctamente",
        sessionId,
        email,
        nickname,
        macAddress,
        createAD_CDMX,
        lastAccess,
    });
});

// Ruta de cierre de sesión
app.post("/logout", async (req, res) => {
    const { sessionId } = req.body;

    if (!sessionId) {
        return res.status(400).json({ message: "Session ID es requerido" });
    }

    try {
        const deletedUser = await deleteUserBySessionId(sessionId);

        if (!deletedUser) {
            return res.status(404).json({ message: "No se encontró la sesión" });
        }

        res.status(200).json({ message: "Logout exitoso, usuario eliminado" });
    } catch (error) {
        res.status(500).json({ message: "Error al eliminar sesión", error });
    }
});

// Estado de la sesión
app.get('/status', (req, res) => {
    const { sessionID } = req.query;

    if (!sessionID || !sessions[sessionID]) {
        return res.status(404).json({ message: "No hay una sesión activa" });
    }

    const session = sessions[sessionID];
    const now = new Date();

    const started = new Date(session.createAD_CDMX);
    const lastUpdate = new Date(session.lastAccess);

    const createAD_CDMX = moment(started).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss');
    const lastAccess = moment(lastUpdate).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss');

    const sessionAgeMS = now - started;
    const hours = Math.floor(sessionAgeMS / (1000 * 60 * 60));
    const minutes = Math.floor((sessionAgeMS % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((sessionAgeMS % (1000 * 60)) / 1000);

    res.status(200).json({
        message: 'Estado de la sesión',
        nickname: session.nickname,
        sessionID,
        email: session.email,
        ip_cliente: req.ip,
        mac_cliente: session.macAddress,
        inicio: createAD_CDMX,
        ultimoAcceso: lastAccess,
        antigüedad: `${hours} horas, ${minutes} minutos y ${seconds} segundos`
    });
});

// Listar sesiones activas
app.get('/listCurrentSession', (req, res) => {
    const activeSessions = Object.values(sessions).map(session => ({
        sessionId: session.sessionId,
        email: session.email,
        nickname: session.nickname,
        macAddress: session.macAddress,
        ip: session.ip,
        createAD_CDMX: moment(session.createAD_CDMX).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss'),
        lastAccess: moment(session.lastAccess).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss')
    }));

    res.status(200).json({
        message: "Sesiones activas",
        activeSessions
    });
});

// Actualizar timestamps de una sesión
app.post("/update", async (req, res) => {
    const { sessionId, createAD_CDMX, lastAccess } = req.body;

    if (!sessionId || !createAD_CDMX || !lastAccess) {
        return res.status(400).json({ message: "Se requieren sessionId, createAD_CDMX y lastAccess" });
    }

    try {
        const updatedSession = await updateSessionTimestamps(
            sessionId,
            new Date(createAD_CDMX),
            new Date(lastAccess)
        );

        if (!updatedSession) {
            return res.status(404).json({ message: "Sesión no encontrada" });
        }

        res.status(200).json({
            message: "Timestamps actualizados correctamente",
            updatedSession: {
                ...updatedSession,
                createAD_CDMX: moment(updatedSession.createAD_CDMX).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss'),
                lastAccess: moment(updatedSession.lastAccess).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss'),
            },
        });
    } catch (error) {
        res.status(500).json({ message: "Error al actualizar los timestamps", error });
    }
});
