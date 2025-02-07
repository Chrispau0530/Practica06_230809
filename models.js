
import mongoose from 'mongoose';

const loginSchema = new mongoose.Schema({
    sessionId: String,
    email: String,
    nickname: String,
    macAddress: String,
    ip: String,
    status:String,
    createAD_CDMX: Date,
    lastAccess: Date
});

const LoginModel = mongoose.model('Login', loginSchema);

async function storeLoginData(sessionId, email, nickname, macAddress, ip, createAD_CDMX, lastAccess, status = "Activa") {
    const loginData = new LoginModel({
        sessionId,
        email,
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
    
export  { LoginModel,storeLoginData,deleteUserBySessionId,updateSessionTimestamps }
