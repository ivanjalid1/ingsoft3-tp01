import * as clienteService from '../services/clienteService.js';

export async function listar(req, res, next) {
  try {
    const incluirInactivos = req.query.incluir_inactivos === 'true';
    const clientes = await clienteService.listar(incluirInactivos);
    res.status(200).json(clientes);
  } catch (err) {
    next(err);
  }
}

export async function obtener(req, res, next) {
  try {
    const cliente = await clienteService.obtener(Number(req.params.id));
    res.status(200).json(cliente);
  } catch (err) {
    next(err);
  }
}

export async function crear(req, res, next) {
  try {
    const { nombre, email, telefono } = req.body;
    const cliente = await clienteService.crear({ nombre, email, telefono });
    res.status(201).json(cliente);
  } catch (err) {
    next(err);
  }
}

export async function actualizar(req, res, next) {
  try {
    const { nombre, email, telefono } = req.body;
    const cliente = await clienteService.actualizar(Number(req.params.id), { nombre, email, telefono });
    res.status(200).json(cliente);
  } catch (err) {
    next(err);
  }
}

export async function desactivar(req, res, next) {
  try {
    const resultado = await clienteService.desactivar(Number(req.params.id));
    res.status(200).json(resultado);
  } catch (err) {
    next(err);
  }
}
