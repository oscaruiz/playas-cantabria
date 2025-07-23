import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { listarPlayas, prediccionPlaya } from './controllers/playasController';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Detectar entorno producción o desarrollo
const isProduction = process.env.NODE_ENV === 'production';
const PROD_URL = process.env.PROD_URL || ''; 

const BASE_URL = isProduction && PROD_URL ? PROD_URL : `http://localhost:${PORT}`;

// Middlewares
app.use(cors());
app.use(express.json());

// Rutas
app.get('/', (_req, res) => {
  res.send(`🌊 API de playas de Cantabria. Visita ${BASE_URL}/api/playas`);
});

app.get('/api/playas', listarPlayas);
app.get('/api/playas/:codigo', prediccionPlaya);

// Error 404 por defecto
app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Inicio de servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor activo en ${BASE_URL}`);
});
