import express from 'express';
import * as Sentry from '@sentry/node';
import routes from './routes/index.js';
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

// TP9 · TEMPORAL: endpoint que falla a propósito, para ver un error llegar a
// Sentry. Va antes de /api (que pide token) para poder llamarlo desde el
// navegador. Se saca al cerrar el práctico.
app.get('/api/falla', () => {
  throw new Error('Falla de prueba del TP9');
});

app.use('/api', routes);

// 404 para cualquier ruta que no exista. No arma el JSON acá: delega en
// errorHandler, que es el único traductor error → JSON de todo el backend.
app.use((req, res, next) => {
  next(new AppError(404, 'RUTA_NO_ENCONTRADA', `No existe ${req.method} ${req.originalUrl}`));
});

// Sentry antes del errorHandler: ve el error y lo deja seguir. Por defecto
// sólo reporta los que terminan en 5xx; los AppError (400, 404, 409…) son
// respuestas previstas, no fallas.
Sentry.setupExpressErrorHandler(app);

app.use(errorHandler);

export default app;
