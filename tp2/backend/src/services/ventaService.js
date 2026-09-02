import { AppError } from '../utils/AppError.js';
import * as ventaModel from '../models/ventaModel.js';
import * as clienteModel from '../models/clienteModel.js';
import * as productoModel from '../models/productoModel.js';
import { validarId, esEnteroPositivo } from './validaciones.js';

// Los montos vienen de DECIMAL(10,2). Redondear a dos decimales después
// de cada operación evita que un 0.1 + 0.2 binario se cuele en el total.
function redondear(monto) {
  return Math.round(monto * 100) / 100;
}

// Deshace la transacción sin dejar que un fallo del propio rollback tape el
// error que la originó: si `rollback()` rechazara, esa rejection reemplazaría
// al AppError y el cliente vería un 500 genérico en vez de su 409.
async function revertir(conn) {
  try {
    await conn.rollback();
  } catch (errorDeRollback) {
    console.error('[error] falló el rollback', errorDeRollback);
  }
}

function validarForma(clienteId, items) {
  if (!esEnteroPositivo(clienteId)) {
    throw new AppError(400, 'DATOS_INVALIDOS', 'cliente_id debe ser un número entero positivo');
  }
  if (!Array.isArray(items)) {
    throw new AppError(400, 'DATOS_INVALIDOS', 'items debe ser un array');
  }
  if (items.length === 0) {
    throw new AppError(400, 'VENTA_SIN_ITEMS', 'La venta no tiene ítems');
  }
  for (const item of items) {
    // La forma del ítem se valida antes de leerle una propiedad o de bindearla
    // en una query: un `null` daría TypeError y un producto_id ausente llegaría
    // como `undefined` a mysql2. Los dos terminaban en 500 en vez de 400.
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      throw new AppError(400, 'DATOS_INVALIDOS', 'Cada ítem debe ser un objeto con producto_id y cantidad');
    }
    if (!esEnteroPositivo(item.producto_id)) {
      throw new AppError(400, 'DATOS_INVALIDOS', 'producto_id debe ser un número entero positivo');
    }
    if (!esEnteroPositivo(item.cantidad)) {
      throw new AppError(
        400, 'CANTIDAD_INVALIDA',
        `Cantidad inválida para el producto ${item.producto_id}`
      );
    }
  }
}

// Agrupa las líneas por producto_id sumando las cantidades, y las devuelve
// ordenadas por producto_id. Dos cosas de un solo paso:
//   1) Si el mismo producto viene dos veces, el stock se valida UNA sola vez
//      contra la cantidad total. Sin esto, las dos líneas leían el mismo stock
//      (todavía no se escribió nada), las dos pasaban, y el bucle de escritura
//      descontaba dos veces: la venta se commiteaba con stock negativo.
//   2) Los locks se toman siempre en el mismo orden, sin importar en qué orden
//      mandó los ítems el cliente. Dos ventas con los mismos productos en
//      orden inverso ya no pueden deadlockear.
function consolidarItems(items) {
  const cantidadPorProducto = new Map();

  for (const item of items) {
    const acumulado = cantidadPorProducto.get(item.producto_id) ?? 0;
    cantidadPorProducto.set(item.producto_id, acumulado + item.cantidad);
  }

  return [...cantidadPorProducto.entries()]
    .map(([productoId, cantidad]) => ({ producto_id: productoId, cantidad }))
    .sort((a, b) => a.producto_id - b.producto_id);
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

  // 3) Un producto repetido se consolida en una sola línea antes de tocar la
  // base, así se valida una sola vez contra el stock y los locks se toman
  // siempre en el mismo orden.
  const lineas = consolidarItems(items);

  // 4) Todo lo que toca stock va adentro de UNA transacción.
  const conn = await ventaModel.obtenerConexion();
  let ventaId;

  try {
    await conn.beginTransaction();

    // 4.a) Primero se leen y bloquean todos los productos y se valida el
    // stock de todos. Recién después se escribe algo. Así, si el ítem 3
    // no tiene stock, los ítems 1 y 2 nunca llegaron a descontarse.
    let total = 0;
    const detalle = [];

    for (const linea of lineas) {
      const producto = await productoModel.buscarPorIdParaActualizar(conn, linea.producto_id);

      if (!producto) {
        throw new AppError(404, 'PRODUCTO_NO_ENCONTRADO', `No existe el producto ${linea.producto_id}`);
      }
      if (linea.cantidad > producto.stock) {
        throw new AppError(409, 'STOCK_INSUFICIENTE', `Stock insuficiente para el producto ${linea.producto_id}`);
      }

      const precioUnitario = producto.precio;              // se congela acá
      const subtotal = redondear(linea.cantidad * precioUnitario);
      total = redondear(total + subtotal);

      detalle.push({
        producto_id: producto.id,
        cantidad: linea.cantidad,
        precio_unitario: precioUnitario,
        subtotal
      });
    }

    // 4.b) Escrituras.
    ventaId = await ventaModel.crearCabecera(conn, clienteId, total);

    for (const linea of detalle) {
      await ventaModel.crearItem(conn, ventaId, linea);
      await productoModel.descontarStock(conn, linea.producto_id, linea.cantidad);
    }

    await conn.commit();
  } catch (err) {
    // Cualquier error deshace todo lo escrito en esta transacción.
    await revertir(conn);
    throw err;
  } finally {
    // Pase lo que pase, la conexión vuelve al pool. Sin esto, después de
    // diez errores el pool se queda sin conexiones y la app se cuelga.
    conn.release();
  }

  // 5) La venta ya está confirmada. Releerla para devolverla es una consulta
  // aparte, FUERA de la transacción: si acá fallara algo, no habría un
  // rollback() ejecutándose después del commit().
  return obtener(ventaId);
}

export async function anular(ventaId) {
  validarId(ventaId);

  const conn = await ventaModel.obtenerConexion();
  let huboReposicion = false;

  try {
    await conn.beginTransaction();

    // 1) La cabecera se lee CON BLOQUEO y dentro de la transacción: el estado
    // que se valida acá no lo puede cambiar nadie hasta el commit o el
    // rollback. Validar fuera del lock dejaba pasar dos anulaciones a la vez
    // y el stock se reponía dos veces.
    const cabecera = await ventaModel.buscarCabeceraParaActualizar(conn, ventaId);

    if (!cabecera) {
      throw new AppError(404, 'VENTA_NO_ENCONTRADA', `No existe la venta ${ventaId}`);
    }
    if (cabecera.estado === 'anulada') {
      throw new AppError(409, 'VENTA_YA_ANULADA', `La venta ${ventaId} ya está anulada`);
    }

    // 2) Bucle de lectura: acá no se escribe nada todavía.
    const items = await ventaModel.listarItems(conn, ventaId);

    // 3) Bucle de escritura: se repone el stock de cada ítem y se marca la venta.
    for (const item of items) {
      await productoModel.reponerStock(conn, item.producto_id, item.cantidad);
    }

    // 4) Cinturón además de tirantes: el UPDATE lleva su propia guarda
    // WHERE estado = 'pendiente'. Si no afectó ninguna fila, otra anulación
    // ganó la carrera: se deshace todo y se responde el mismo 409.
    const filasAfectadas = await ventaModel.marcarAnulada(conn, ventaId);
    if (filasAfectadas === 0) {
      throw new AppError(409, 'VENTA_YA_ANULADA', `La venta ${ventaId} ya está anulada`);
    }

    huboReposicion = items.length > 0;
    await conn.commit();
  } catch (err) {
    await revertir(conn);
    throw err;
  } finally {
    conn.release();
  }

  return { id: Number(ventaId), estado: 'anulada', stock_repuesto: huboReposicion };
}
