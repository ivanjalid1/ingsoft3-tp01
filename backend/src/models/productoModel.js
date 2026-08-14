import { pool } from '../config/db.js';

const COLUMNAS = 'id, nombre, precio, stock, activo';

// mysql2 devuelve DECIMAL como STRING para no perder precisión.
// La conversión a número se hace acá, en un solo lugar.
function aProducto(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    nombre: fila.nombre,
    precio: Number(fila.precio),
    stock: fila.stock,
    activo: Boolean(fila.activo)
  };
}

export async function listar(incluirInactivos = false) {
  const sql = incluirInactivos
    ? `SELECT ${COLUMNAS} FROM productos ORDER BY nombre`
    : `SELECT ${COLUMNAS} FROM productos WHERE activo = 1 ORDER BY nombre`;
  const [filas] = await pool.query(sql);
  return filas.map(aProducto);
}

export async function buscarPorId(id) {
  const [filas] = await pool.execute(
    `SELECT ${COLUMNAS} FROM productos WHERE id = ?`,
    [id]
  );
  return aProducto(filas[0]);
}

// Lectura DENTRO de una transacción. FOR UPDATE bloquea la fila hasta el
// commit o el rollback: dos ventas simultáneas no pueden leer el mismo stock
// y descontarlo las dos. Filtra por activo = 1: un producto dado de baja
// no se puede vender.
export async function buscarPorIdParaActualizar(conn, id) {
  const c = conn ?? pool;
  const [filas] = await c.execute(
    'SELECT id, nombre, precio, stock FROM productos WHERE id = ? AND activo = 1 FOR UPDATE',
    [id]
  );
  const fila = filas[0];
  if (!fila) return null;
  return {
    id: fila.id,
    nombre: fila.nombre,
    precio: Number(fila.precio),
    stock: fila.stock
  };
}

export async function crear({ nombre, precio, stock }) {
  const [resultado] = await pool.execute(
    'INSERT INTO productos (nombre, precio, stock) VALUES (?, ?, ?)',
    [nombre, precio, stock]
  );
  return buscarPorId(resultado.insertId);
}

export async function actualizar(id, { nombre, precio, stock }) {
  await pool.execute(
    'UPDATE productos SET nombre = ?, precio = ?, stock = ? WHERE id = ?',
    [nombre, precio, stock, id]
  );
  return buscarPorId(id);
}

export async function desactivar(id) {
  const [resultado] = await pool.execute(
    'UPDATE productos SET activo = 0 WHERE id = ?',
    [id]
  );
  return resultado.affectedRows;
}

// Las dos operaciones de stock reciben `conn` como PRIMER argumento para
// poder correr dentro de la transacción que abre ventaService. Sin eso,
// cada una tomaría una conexión distinta del pool y sus escrituras
// quedarían fuera de la transacción (y no las alcanzaría el rollback).
export async function descontarStock(conn, productoId, cantidad) {
  const c = conn ?? pool;
  const [resultado] = await c.execute(
    'UPDATE productos SET stock = stock - ? WHERE id = ?',
    [cantidad, productoId]
  );
  return resultado.affectedRows;
}

export async function reponerStock(conn, productoId, cantidad) {
  const c = conn ?? pool;
  const [resultado] = await c.execute(
    'UPDATE productos SET stock = stock + ? WHERE id = ?',
    [cantidad, productoId]
  );
  return resultado.affectedRows;
}
