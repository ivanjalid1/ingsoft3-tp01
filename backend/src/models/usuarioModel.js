import { pool } from '../config/db.js';

// ÚNICO método de todo el backend que trae el password_hash.
// Lo usa el login y nadie más. Nunca hay un SELECT * sobre usuarios.
export async function buscarPorEmailConHash(email) {
  const [filas] = await pool.execute(
    'SELECT id, email, password_hash FROM usuarios WHERE email = ? LIMIT 1',
    [email]
  );
  return filas[0] ?? null;
}
