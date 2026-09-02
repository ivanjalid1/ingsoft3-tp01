import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export function verificarToken(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError(
      401, 'TOKEN_FALTANTE', 'Falta el header Authorization: Bearer <token>'
    ));
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.usuario = { id: payload.sub, email: payload.email };
    return next();
  } catch {
    // jwt.verify lanza tanto si la firma no valida como si el token venció.
    return next(new AppError(401, 'TOKEN_INVALIDO', 'Token inválido o vencido'));
  }
}
