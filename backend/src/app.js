import express from 'express';
import { errorHandler } from './middlewares/errorHandler.js';
import { AppError } from './utils/AppError.js';

export const app = express();

app.use(express.json());

// Health check: fuera de /api a propósito, así la regla "todo /api pide token
// salvo el login" se mantiene sin excepciones. Sirve para verificar a mano que
// el contenedor del backend está vivo.
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// 404 para cualquier ruta que no exista. No arma el JSON acá: delega en
// errorHandler, que es el único traductor error → JSON de todo el backend.
app.use((req, res, next) => {
  next(new AppError(404, 'RUTA_NO_ENCONTRADA', `No existe ${req.method} ${req.originalUrl}`));
});

app.use(errorHandler);

export default app;
