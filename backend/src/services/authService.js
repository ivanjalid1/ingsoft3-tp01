import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import * as usuarioModel from '../models/usuarioModel.js';

const EXPIRACION = '8h';

export async function login(email, password) {
  if (!email || !password) {
    throw new AppError(400, 'DATOS_INVALIDOS', 'Faltan email o password');
  }

  const usuario = await usuarioModel.buscarPorEmailConHash(email);

  // Mismo code y mismo mensaje para "email inexistente" y "password mal":
  // si fueran distintos, cualquiera podría enumerar qué emails existen.
  if (!usuario) {
    throw new AppError(401, 'CREDENCIALES_INVALIDAS', 'Email o contraseña incorrectos');
  }

  const coincide = await bcrypt.compare(password, usuario.password_hash);
  if (!coincide) {
    throw new AppError(401, 'CREDENCIALES_INVALIDAS', 'Email o contraseña incorrectos');
  }

  const token = jwt.sign(
    { sub: usuario.id, email: usuario.email },
    env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: EXPIRACION }
  );

  // El hash se descarta acá: se arma un objeto nuevo con dos campos.
  return { token, usuario: { id: usuario.id, email: usuario.email } };
}
