import mongoose from "mongoose";
import express from 'express'
mongoose.connect('mongodb+srv://rodriguezperezchristianpaul:Mapachito070323@cluster0chris.v5bqv.mongodb.net/practica06_db?retryWrites=true&w=majority&appName=Cluster0Chris')
.then((db)=> console.log ("Mongodb atlas connected"))
.catch((error)=>console.error(error))

const app = express();
const PORT = 3000;

app.listen(PORT, () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
});