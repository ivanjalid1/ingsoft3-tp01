import { pool } from '../config/db.js';

const COLUMNAS = 'id, nombre, email, telefono, activo';

// MySQL devuelve BOOLEAN como 0/1. La conversión a booleano se hace acá,
// en un solo lugar, para que el resto del backend vea siempre true/false.
function aCliente(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    nombre: fila.nombre,
    email: fila.email,
    telefono: fila.telefono,
    activo: Boolean(fila.activo)
  };
}

export async function listar(incluirInactivos = false) {
  const sql = incluirInactivos
    ? `SELECT ${COLUMNAS} FROM clientes ORDER BY nombre`
    : `SELECT ${COLUMNAS} FROM clientes WHERE activo = 1 ORDER BY nombre`;
  const [filas] = await pool.query(sql);
  return filas.map(aCliente);
}

export async function buscarPorId(id) {
  const [filas] = await pool.execute(
    `SELECT ${COLUMNAS} FROM clientes WHERE id = ?`,
    [id]
  );
  return aCliente(filas[0]);
}

export async function buscarPorEmail(email) {
  const [filas] = await pool.execute(
    `SELECT ${COLUMNAS} FROM clientes WHERE email = ?`,
    [email]
  );
  return aCliente(filas[0]);
}

export async function crear({ nombre, email, telefono }) {
  const [resultado] = await pool.execute(
    'INSERT INTO clientes (nombre, email, telefono) VALUES (?, ?, ?)',
    [nombre, email, telefono ?? null]
  );
  return buscarPorId(resultado.insertId);
}

export async function actualizar(id, { nombre, email, telefono }) {
  await pool.execute(
    'UPDATE clientes SET nombre = ?, email = ?, telefono = ? WHERE id = ?',
    [nombre, email, telefono ?? null, id]
  );
  return buscarPorId(id);
}

// Baja LÓGICA: no hay DELETE físico en toda la app.
export async function desactivar(id) {
  const [resultado] = await pool.execute(
    'UPDATE clientes SET activo = 0 WHERE id = ?',
    [id]
  );
  return resultado.affectedRows;
}
