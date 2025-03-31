import express from 'express';
import session from 'express-session';
import bodyParser from 'body-parser';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment-timezone';
import os from 'os';
import mongoose from 'mongoose';
import cors from 'cors'; // Import cors
import { LoginModel, storeLoginData, deleteUserBySessionId, updateSessionTimestamps } from './models.js';

mongoose.connect('mongodb+srv://rodriguezperezchristianpaul:Mapachito070323@cluster0chris.v5bqv.mongodb.net/practica06_db?retryWrites=true&w=majority&appName=Cluster0Chris')
    .then(() => console.log("Mongodb atlas connected"))
    .catch((error) => console.error(error));

const app = express();
const PORT = 3000;

app.listen(PORT, () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
});
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessions = {};


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
        status: "Activa", 
    };

    try {
        await storeLoginData(sessionId, email, nickname, macAddress, getLocalIp(), now, now, "Activa");
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

app.post("/logout", async (req, res) => {
    const { sessionId } = req.body; 

    if (!sessionId) {
        return res.status(400).json({ message: "Session ID es requerido" });
    }

    try {
        console.log(`Intentando cerrar sesión con ID: ${sessionId}`);

        // Verificar si la sesión existe antes de actualizar
        const sessionExists = await LoginModel.findOne({ sessionId });
        if (!sessionExists) {
            return res.status(404).json({ message: "No se encontró la sesión en la base de datos" });
        }

        // Actualizar el estado de la sesión en MongoDB
        const updatedSession = await LoginModel.findOneAndUpdate(
            { sessionId },
            { status: "Finalizada por el Usuario" },
            { new: true }
        );

        if (!updatedSession) {
            return res.status(500).json({ message: "Error al actualizar la sesión" });
        }

        // Eliminar de la memoria local (si estás manejando sesiones en memoria)
        delete sessions[sessionId];

        return res.status(200).json({ 
            message: "Logout exitoso, sesión finalizada", 
            session: updatedSession 
        });

    } catch (error) {
        console.error("Error en /logout:", error);
        return res.status(500).json({ message: "Error al finalizar la sesión", error });
    }
});

app.get('/status', async (req, res) => {
    const { sessionID } = req.query;

    if (!sessionID || !sessions[sessionID]) {
        return res.status(404).json({ message: "No hay una sesión activa" });
    }

    const session = sessions[sessionID];

    res.status(200).json({
        message: 'Estado de la sesión',
        nickname: session.nickname,
        sessionID,
        email: session.email,
        ip_cliente: req.ip,
        mac_cliente: session.macAddress,
        inicio: moment(session.createAD_CDMX).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss'),
        ultimoAcceso: moment(session.lastAccess).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss'),
        status: session.status // Se agrega el estado de la sesión
    });
});

// Obtener sesiones activas desde MongoDB
app.get('/activeSessions', async (req, res) => {
    try {
        const activeSessions = await LoginModel.find({ status: "Activa" });
        res.status(200).json({ message: "Sesiones activas", activeSessions });
    } catch (error) {
        res.status(500).json({ message: "Error al obtener sesiones activas", error });
    }
});

// Obtener todas las sesiones (activas y cerradas)
app.get('/allSessions', async (req, res) => {
    try {
        const allSessions = await LoginModel.find();
        res.status(200).json({ message: "Todas las sesiones", allSessions });
    } catch (error) {
        res.status(500).json({ message: "Error al obtener todas las sesiones", error });
    }
});
app.delete('/clearSessions', async (req, res) => {
    try {
        // 🔹 1. Eliminar todas las sesiones de la memoria local
        const sessionCount = Object.keys(sessions).length;
        Object.keys(sessions).forEach(sessionId => delete sessions[sessionId]);

        // 🔹 2. Eliminar todas las sesiones de la base de datos MongoDB
        const result = await LoginModel.deleteMany({});

        // 🔹 3. Responder con el número de sesiones eliminadas
        return res.status(200).json({
            message: "Todas las sesiones han sido eliminadas",
            deletedFromMemory: sessionCount,
            deletedFromDB: result.deletedCount
        });
    } catch (error) {
        console.error("❌ Error al eliminar las sesiones:", error);
        return res.status(500).json({ message: "Error interno al eliminar sesiones", error });
    }
});

// Actualizar timestamps solo con sessionId
app.post("/update", async (req, res) => {
    const { sessionId } = req.body;

    if (!sessionId) {
        return res.status(400).json({ message: "sessionId es requerido" });
    }

    try {
        const now = new Date();
        const updatedSession = await LoginModel.findOneAndUpdate(
            { sessionId },
            { lastAccess: now },
            { new: true }
        );

        if (!updatedSession) {
            return res.status(404).json({ message: "Sesión no encontrada" });
        }

        res.status(200).json({
            message: "Timestamps actualizados correctamente",
            updatedSession: {
                sessionId: updatedSession.sessionId,
                lastAccess: moment(updatedSession.lastAccess).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss')
            }
        });
    } catch (error) {
        res.status(500).json({ message: "Error al actualizar el timestamp", error });
    }
});


async function checkAndDestroySessions() {
    const now = new Date();

    for (const sessionID in sessions) {
        const sessionData = sessions[sessionID];
        const createdAt = new Date(sessionData.createAD_CDMX);
        const sessionAgeMS = now - createdAt;
        const minutes = Math.floor(sessionAgeMS / (1000 * 20));

        if (minutes > 2) {
            console.log(`Marcando sesión como finalizada por falla del sistema: ${sessionID}`);

            // Actualizar en MongoDB
            await LoginModel.findOneAndUpdate(
                { sessionId: sessionID },
                { status: "Finalizada por Falla de Sistema" }
            );

            // Eliminar de la memoria local
            delete sessions[sessionID];
        }
    }
}



setInterval(checkAndDestroySessions, 60000);
