import * as authService from '../services/authService.js';

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const resultado = await authService.login(email, password);
    res.status(200).json(resultado);
  } catch (err) {
    next(err);
  }
}
