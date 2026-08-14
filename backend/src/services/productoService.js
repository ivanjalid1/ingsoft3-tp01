import { AppError } from '../utils/AppError.js';
import * as productoModel from '../models/productoModel.js';
import { validarId } from './validaciones.js';

function validarDatos({ nombre, precio, stock }) {
  if (typeof nombre !== 'string' || nombre.trim() === '') {
    throw new AppError(400, 'DATOS_INVALIDOS', 'El nombre es obligatorio');
  }
  if (typeof precio !== 'number' || Number.isNaN(precio) || precio <= 0) {
    throw new AppError(400, 'DATOS_INVALIDOS', 'El precio debe ser mayor a cero');
  }
  if (!Number.isInteger(stock) || stock < 0) {
    throw new AppError(400, 'DATOS_INVALIDOS', 'El stock debe ser un entero mayor o igual a cero');
  }
}

export async function listar(incluirInactivos = false) {
  return productoModel.listar(incluirInactivos);
}

export async function obtener(id) {
  validarId(id);
  const producto = await productoModel.buscarPorId(id);
  if (!producto) {
    throw new AppError(404, 'PRODUCTO_NO_ENCONTRADO', `No existe el producto ${id}`);
  }
  return producto;
}

export async function crear(datos) {
  validarDatos(datos);
  return productoModel.crear(datos);
}

export async function actualizar(id, datos) {
  validarDatos(datos);
  await obtener(id); // lanza 404 si no existe
  return productoModel.actualizar(id, datos);
}

export async function desactivar(id) {
  await obtener(id); // lanza 404 si no existe
  await productoModel.desactivar(id);
  return { id: Number(id), activo: false };
}
