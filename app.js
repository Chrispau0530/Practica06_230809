import express from 'express';
import session from 'express-session';
import bodyParser from 'body-parser';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment-timezone';
import os from 'os';
import { copyFileSync } from 'fs';
import mongoose from 'mongoose';
import {storeLoginData,deleteUserBySessionId} from './models.js';


mongoose.connect('mongodb+srv://rodriguezperezchristianpaul:Mapachito070323@cluster0chris.v5bqv.mongodb.net/practica06_db?retryWrites=true&w=majority&appName=Cluster0Chris')
.then((db)=> console.log ("Mongodb atlas connected"))
.catch((error)=>console.error(error))

const app = express();
const PORT = 3000;

app.listen(PORT, () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Almacenamiento en memoria para sesiones
const sessions = {};

app.use(
    session({
        secret: "CPRP-SesionesHTTP-VariablesDeSesion",
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 5 * 60 * 1000 },
    })
);

app.get('/', (req, res) => {
    return res.status(200).json({
        message: "Bienvenid@ al API de Control de Sesiones",
        author: "Christian Paul Rodriguez Perez",
    });
});

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
app.post('/login', async (req, res) => {
    const { email, nickname, macAddress } = req.body;

    if (!email || !nickname || !macAddress) {
        return res.status(400).json({ message: "Se esperan campos requeridos" });
    }

    const sessionId = uuidv4();
    const now = new Date();
    
    // Verificar si `req.session.createdAt` está inicializado
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

    // Guardar en MongoDB
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

    // Verificar si la sesión debe ser destruida
    const sessionAgeMS = now - req.session.createdAt;
    const minutes = Math.floor(sessionAgeMS / (1000 * 60));

    if (minutes > 2) {
        checkAndDestroySessions();
    }
});

//Funcion para cerrar la sesion 

// Ruta de logout
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


// Función para obtener la IP y MAC del servidor
function getServerNetworkInfo() {
    const interfaces = os.networkInterfaces();
    let serverIp = '127.0.0.1';
    let serverMac = '00:00:00:00:00:00';

    for (let iface of Object.values(interfaces)) {
        for (let info of iface) {
            if (info.family === 'IPv4' && !info.internal) {
                serverIp = info.address;
                serverMac = info.mac;
            }
        }
    }
    return { serverIp, serverMac };
}

// Función para obtener la MAC de un cliente dado su IP
function getClientMac(ip) {
    try {
        const output = arp(`arp -a ${ip}`).toString();
        const match = output.match(/([a-fA-F0-9-:]{17})/);
        return match ? match[0] : 'MAC no disponible';
    } catch (error) {
        return 'MAC no disponible';
    }
}

app.get('/status', (req, res) => {
    const { sessionID } = req.query;
    const now = new Date();

    if (!sessionID || !sessions[sessionID]) {
        return res.status(404).json({ message: "No hay una sesión activa" });
    }

    const session = sessions[sessionID];

    // Captura las IPs
    const ipCliente = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const { serverIp, serverMac } = getServerNetworkInfo();
    //const macCliente = getClientMac(ipCliente); // Intento de obtener la MAC del cliente

    // Datos de sesión
    const started = new Date(session.createAD_CDMX);
    const lastUpdate = new Date(session.lastAccess);
    const nickname = session.nickname;
    const email = session.email;
    const macCliente=session.macAddress

    if (isNaN(started.getTime()) || isNaN(lastUpdate.getTime())) {
        return res.status(400).json({ message: "Las fechas de la sesión no son válidas" });
    }

    const sessionAgeMS = now - started;
    const hours = Math.floor(sessionAgeMS / (1000 * 60 * 60));
    const minutes = Math.floor((sessionAgeMS % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((sessionAgeMS % (1000 * 60)) / 1000);

    const createAD_CDMX = moment(started).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss');
    const lastAccess = moment(lastUpdate).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss');

    res.status(200).json({
        message: 'Estado de la sesión',
        nickname: nickname,
        sessionID: sessionID,
        email: email,
        ip_cliente: ipCliente,
        mac_cliente: macCliente,
        ip_servidor: serverIp,
        mac_servidor: serverMac,
        inicio: createAD_CDMX,
        ultimoAcceso: lastAccess,
        antigüedad: `${hours} horas, ${minutes} minutos y ${seconds} segundos`
    });
});



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