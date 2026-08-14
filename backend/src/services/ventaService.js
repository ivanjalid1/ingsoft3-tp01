import { AppError } from '../utils/AppError.js';
import * as ventaModel from '../models/ventaModel.js';
import * as clienteModel from '../models/clienteModel.js';
import * as productoModel from '../models/productoModel.js';
import { validarId } from './validaciones.js';

// Los montos vienen de DECIMAL(10,2). Redondear a dos decimales después
// de cada operación evita que un 0.1 + 0.2 binario se cuele en el total.
function redondear(monto) {
  return Math.round(monto * 100) / 100;
}

function validarForma(clienteId, items) {
  if (!Number.isInteger(clienteId) || clienteId <= 0) {
    throw new AppError(400, 'DATOS_INVALIDOS', 'cliente_id debe ser un número entero positivo');
  }
  if (!Array.isArray(items)) {
    throw new AppError(400, 'DATOS_INVALIDOS', 'items debe ser un array');
  }
  if (items.length === 0) {
    throw new AppError(400, 'VENTA_SIN_ITEMS', 'La venta no tiene ítems');
  }
  for (const item of items) {
    if (!Number.isInteger(item.cantidad) || item.cantidad <= 0) {
      throw new AppError(
        400, 'CANTIDAD_INVALIDA',
        `Cantidad inválida para el producto ${item.producto_id}`
      );
    }
  }
}

export async function listar() {
  return ventaModel.listar();
}

export async function obtener(ventaId) {
  validarId(ventaId);
  const cabecera = await ventaModel.buscarCabecera(null, ventaId);
  if (!cabecera) {
    throw new AppError(404, 'VENTA_NO_ENCONTRADA', `No existe la venta ${ventaId}`);
  }
  const items = await ventaModel.listarItems(null, ventaId);
  return { ...cabecera, items };
}

export async function crear(clienteId, items) {
  // 1) Validaciones de forma: baratas y sin tocar la base.
  validarForma(clienteId, items);

  // 2) El cliente tiene que existir y estar activo.
  const cliente = await clienteModel.buscarPorId(clienteId);
  if (!cliente || !cliente.activo) {
    throw new AppError(404, 'CLIENTE_NO_ENCONTRADO', `No existe el cliente ${clienteId}`);
  }

  // 3) Todo lo que toca stock va adentro de UNA transacción.
  const conn = await ventaModel.obtenerConexion();
  let ventaId;

  try {
    await conn.beginTransaction();

    // 3.a) Primero se leen y bloquean todos los productos y se valida el
    // stock de todos. Recién después se escribe algo. Así, si el ítem 3
    // no tiene stock, los ítems 1 y 2 nunca llegaron a descontarse.
    let total = 0;
    const detalle = [];

    for (const item of items) {
      const producto = await productoModel.buscarPorIdParaActualizar(conn, item.producto_id);

      if (!producto) {
        throw new AppError(404, 'PRODUCTO_NO_ENCONTRADO', `No existe el producto ${item.producto_id}`);
      }
      if (item.cantidad > producto.stock) {
        throw new AppError(409, 'STOCK_INSUFICIENTE', `Stock insuficiente para el producto ${item.producto_id}`);
      }

      const precioUnitario = producto.precio;              // se congela acá
      const subtotal = redondear(item.cantidad * precioUnitario);
      total = redondear(total + subtotal);

      detalle.push({
        producto_id: producto.id,
        cantidad: item.cantidad,
        precio_unitario: precioUnitario,
        subtotal
      });
    }

    // 3.b) Escrituras.
    ventaId = await ventaModel.crearCabecera(conn, clienteId, total);

    for (const linea of detalle) {
      await ventaModel.crearItem(conn, ventaId, linea);
      await productoModel.descontarStock(conn, linea.producto_id, linea.cantidad);
    }

    await conn.commit();
  } catch (err) {
    // Cualquier error deshace todo lo escrito en esta transacción.
    await conn.rollback();
    throw err;
  } finally {
    // Pase lo que pase, la conexión vuelve al pool. Sin esto, después de
    // diez errores el pool se queda sin conexiones y la app se cuelga.
    conn.release();
  }

  // 4) La venta ya está confirmada. Releerla para devolverla es una consulta
  // aparte, FUERA de la transacción: si acá fallara algo, no habría un
  // rollback() ejecutándose después del commit().
  return obtener(ventaId);
}

export async function anular(ventaId) {
  validarId(ventaId);

  // Se valida el estado ANTES de abrir la transacción: si la venta ya está
  // anulada (o no existe), no hace falta tomar una conexión del pool ni
  // bloquear ninguna fila.
  const cabecera = await ventaModel.buscarCabecera(null, ventaId);

  if (!cabecera) {
    throw new AppError(404, 'VENTA_NO_ENCONTRADA', `No existe la venta ${ventaId}`);
  }
  if (cabecera.estado === 'anulada') {
    throw new AppError(409, 'VENTA_YA_ANULADA', `La venta ${ventaId} ya está anulada`);
  }

  const conn = await ventaModel.obtenerConexion();

  try {
    await conn.beginTransaction();

    // Bucle de lectura: acá no se escribe nada todavía.
    const items = await ventaModel.listarItems(conn, ventaId);

    // Bucle de escritura: se repone el stock de cada ítem y se marca la venta.
    for (const item of items) {
      await productoModel.reponerStock(conn, item.producto_id, item.cantidad);
    }
    await ventaModel.marcarAnulada(conn, ventaId);

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  return { id: Number(ventaId), estado: 'anulada', stock_repuesto: true };
}
