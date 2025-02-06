import mongoose from 'mongoose';

const loginSchema = new mongoose.Schema({
    sessionId: String,
    email: String,
    nickname: String,
    macAddress: String,
    ip: String,
    createAD_CDMX: Date,
    lastAccess: Date
});

const LoginModel = mongoose.model('Login', loginSchema);


async function storeLoginData(sessionId, email, nickname, macAddress, ip, createAD_CDMX, lastAccess) {
    

        const loginEntry = new LoginModel({
            sessionId,
            email,
            nickname,
            macAddress,
            ip,
            createAD_CDMX,
            lastAccess
        });

        await loginEntry.save();
    }

    async function deleteUserBySessionId(sessionId) {
        return await LoginModel.findOneAndDelete({ sessionId });
    }

export  { LoginModel,storeLoginData, deleteUserBySessionId }
