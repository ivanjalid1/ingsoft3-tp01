import { AppError } from '../utils/AppError.js';
import * as clienteModel from '../models/clienteModel.js';
import { validarId } from './validaciones.js';

// Validación deliberadamente simple: hay un @, hay un punto después y no hay
// espacios. Validar emails con una regex "completa" es un pozo sin fondo;
// la verificación real de un email es mandarle un mail.
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validarDatos({ nombre, email }) {
  if (typeof nombre !== 'string' || nombre.trim() === '') {
    throw new AppError(400, 'DATOS_INVALIDOS', 'El nombre es obligatorio');
  }
  if (typeof email !== 'string' || !RE_EMAIL.test(email)) {
    throw new AppError(400, 'DATOS_INVALIDOS', 'El email tiene formato inválido');
  }
}

// Único traductor de "la base rechazó por email duplicado" a AppError.
// Se usa tanto en crear() como en actualizar(): es la misma garantía real
// (el UNIQUE de la base) reaccionando a la misma ventana de carrera en los
// dos casos, así que vive en un solo lugar en vez de repetirse.
function relanzarSiEmailDuplicado(err, email) {
  if (err.code === 'ER_DUP_ENTRY') {
    throw new AppError(409, 'EMAIL_DUPLICADO', `Ya existe un cliente con el email ${email}`);
  }
  throw err;
}

export async function listar(incluirInactivos = false) {
  return clienteModel.listar(incluirInactivos);
}

export async function obtener(id) {
  validarId(id);
  const cliente = await clienteModel.buscarPorId(id);
  if (!cliente) {
    throw new AppError(404, 'CLIENTE_NO_ENCONTRADO', `No existe el cliente ${id}`);
  }
  return cliente;
}

export async function crear(datos) {
  validarDatos(datos);

  // Consulta previa: solo para dar un mensaje lindo.
  const existente = await clienteModel.buscarPorEmail(datos.email);
  if (existente) {
    throw new AppError(409, 'EMAIL_DUPLICADO', `Ya existe un cliente con el email ${datos.email}`);
  }

  try {
    return await clienteModel.crear(datos);
  } catch (err) {
    // Garantía REAL: el UNIQUE de la base. Si dos requests entran en simultáneo,
    // las dos pasan la consulta previa y una de las dos rebota acá.
    relanzarSiEmailDuplicado(err, datos.email);
  }
}

export async function actualizar(id, datos) {
  validarDatos(datos);
  await obtener(id); // lanza 404 si no existe

  const existente = await clienteModel.buscarPorEmail(datos.email);
  if (existente && existente.id !== Number(id)) {
    throw new AppError(409, 'EMAIL_DUPLICADO', `Ya existe un cliente con el email ${datos.email}`);
  }

  try {
    return await clienteModel.actualizar(id, datos);
  } catch (err) {
    relanzarSiEmailDuplicado(err, datos.email);
  }
}

export async function desactivar(id) {
  await obtener(id); // lanza 404 si no existe
  await clienteModel.desactivar(id);
  return { id: Number(id), activo: false };
}
