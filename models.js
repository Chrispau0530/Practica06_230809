import mongoose from 'mongoose';
import crypto from 'crypto';

// Clave y vector de inicialización para AES
const ENCRYPTION_KEY = crypto.scryptSync('super-secret-key', 'salt', 32); // Clave secreta de 32 bytes
const IV = Buffer.alloc(16, 0); // Vector de inicialización (IV)

function encrypt(text) {
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, IV);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

function decrypt(encryptedText) {
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, IV);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

const loginSchema = new mongoose.Schema({
    sessionId: String,
    email: String, // Almacenará el email encriptado
    nickname: String,
    macAddress: String,
    ip: String,
    status: String,
    createAD_CDMX: Date,
    lastAccess: Date
});

// Middleware para cifrar el email antes de guardar
loginSchema.pre('save', function (next) {
    if (this.email) {
        this.email = encrypt(this.email);
    }
    next();
});

// Método para descifrar el email
loginSchema.methods.getDecryptedEmail = function () {
    return this.email ? decrypt(this.email) : null;
};

const LoginModel = mongoose.model('Login', loginSchema);

async function storeLoginData(sessionId, email, nickname, macAddress, ip, createAD_CDMX, lastAccess, status = "Activa") {
    const loginData = new LoginModel({
        sessionId,
        email: encrypt(email), // Se almacena encriptado
        nickname,   
        macAddress,
        ip,
        createAD_CDMX,
        lastAccess,
        status
    });

    await loginData.save();
}

async function deleteUserBySessionId(sessionId) {
    return await LoginModel.findOneAndDelete({ sessionId });
}

async function updateSessionTimestamps(sessionId, createAD_CDMX, lastAccess) {
    try {
        const updatedSession = await LoginModel.findOneAndUpdate(
            { sessionId }, 
            { createAD_CDMX, lastAccess }, 
            { new: true }
        );
        return updatedSession;
    } catch (error) {
        console.error("Error al actualizar timestamps:", error);
        throw error;
    }
}

export { LoginModel, storeLoginData, deleteUserBySessionId, updateSessionTimestamps };
