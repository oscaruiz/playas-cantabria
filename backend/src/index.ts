import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { listarPlayas, prediccionPlaya } from './controllers/playasController';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middlewares
app.use(cors());
app.use(express.json());

// Rutas
app.get('/', (_req, res) => {
  res.send('🌊 API de playas de Cantabria. Visita /api/playas');
});

app.get('/api/playas', listarPlayas);
app.get('/api/playas/:codigo', prediccionPlaya);

// Error 404 por defecto
app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Inicio de servidor
app.listen(PORT, () => {
  const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
  console.log(`🚀 Servidor activo en ${BASE_URL}`);
});
