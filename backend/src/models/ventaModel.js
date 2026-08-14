import { pool } from '../config/db.js';

// mysql2 devuelve DECIMAL como STRING para no perder precisión.
// La conversión a número se hace acá, en un solo lugar.
function aCabecera(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    cliente_id: fila.cliente_id,
    cliente_nombre: fila.cliente_nombre,
    fecha: fila.fecha,
    total: Number(fila.total),
    estado: fila.estado
  };
}

function aItem(fila) {
  return {
    id: fila.id,
    producto_id: fila.producto_id,
    producto_nombre: fila.producto_nombre,
    cantidad: fila.cantidad,
    precio_unitario: Number(fila.precio_unitario),
    subtotal: Number(fila.subtotal)
  };
}

// ÚNICA puerta al pool para transacciones. Está acá y no en el service
// porque el service no puede conocer config/db.js: si lo conociera, no se
// podría mockear la capa de datos y los tests necesitarían MySQL.
export async function obtenerConexion() {
  return pool.getConnection();
}

export async function listar() {
  const [filas] = await pool.query(
    `SELECT v.id, v.cliente_id, c.nombre AS cliente_nombre, v.fecha, v.total, v.estado
       FROM ventas v
       JOIN clientes c ON c.id = v.cliente_id
      ORDER BY v.fecha DESC, v.id DESC`
  );
  return filas.map(aCabecera);
}

// Las funciones que pueden participar de una transacción reciben `conn` como
// PRIMER argumento. Si se les pasa null/undefined caen al pool: sirve para las
// lecturas sueltas (GET /api/ventas/:id), nunca para escribir adentro de una
// transacción — ahí la conexión es obligatoria.
export async function buscarCabecera(conn, id) {
  const c = conn ?? pool;
  const [filas] = await c.execute(
    `SELECT v.id, v.cliente_id, c.nombre AS cliente_nombre, v.fecha, v.total, v.estado
       FROM ventas v
       JOIN clientes c ON c.id = v.cliente_id
      WHERE v.id = ?`,
    [id]
  );
  return aCabecera(filas[0]);
}

// Lectura DENTRO de una transacción, igual que productoModel.buscarPorIdParaActualizar.
// FOR UPDATE bloquea la fila de la venta hasta el commit o el rollback: mientras
// tanto ninguna otra transacción puede leerla con lock ni cambiarle el estado.
// No hace JOIN con clientes a propósito: solo hay que bloquear la venta.
export async function buscarCabeceraParaActualizar(conn, id) {
  const c = conn ?? pool;
  const [filas] = await c.execute(
    'SELECT id, cliente_id, fecha, total, estado FROM ventas WHERE id = ? FOR UPDATE',
    [id]
  );
  const fila = filas[0];
  if (!fila) return null;
  return {
    id: fila.id,
    cliente_id: fila.cliente_id,
    fecha: fila.fecha,
    total: Number(fila.total),
    estado: fila.estado
  };
}

export async function listarItems(conn, ventaId) {
  const c = conn ?? pool;
  const [filas] = await c.execute(
    `SELECT i.id, i.producto_id, p.nombre AS producto_nombre,
            i.cantidad, i.precio_unitario, i.subtotal
       FROM venta_items i
       JOIN productos p ON p.id = i.producto_id
      WHERE i.venta_id = ?
      ORDER BY i.id`,
    [ventaId]
  );
  return filas.map(aItem);
}

export async function crearCabecera(conn, clienteId, total) {
  const c = conn ?? pool;
  const [resultado] = await c.execute(
    "INSERT INTO ventas (cliente_id, total, estado) VALUES (?, ?, 'pendiente')",
    [clienteId, total]
  );
  return resultado.insertId;
}

export async function crearItem(conn, ventaId, item) {
  const c = conn ?? pool;
  const [resultado] = await c.execute(
    `INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unitario, subtotal)
     VALUES (?, ?, ?, ?, ?)`,
    [ventaId, item.producto_id, item.cantidad, item.precio_unitario, item.subtotal]
  );
  return resultado.insertId;
}

// El WHERE incluye el estado: aunque el service ya lo validó, la base
// tampoco deja anular dos veces. Devuelve 0 filas si ya estaba anulada.
export async function marcarAnulada(conn, ventaId) {
  const c = conn ?? pool;
  const [resultado] = await c.execute(
    "UPDATE ventas SET estado = 'anulada' WHERE id = ? AND estado = 'pendiente'",
    [ventaId]
  );
  return resultado.affectedRows;
}
