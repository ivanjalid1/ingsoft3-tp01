import * as productoService from '../services/productoService.js';

export async function listar(req, res, next) {
  try {
    const incluirInactivos = req.query.incluir_inactivos === 'true';
    const productos = await productoService.listar(incluirInactivos);
    res.status(200).json(productos);
  } catch (err) {
    next(err);
  }
}

export async function obtener(req, res, next) {
  try {
    const producto = await productoService.obtener(Number(req.params.id));
    res.status(200).json(producto);
  } catch (err) {
    next(err);
  }
}

export async function crear(req, res, next) {
  try {
    const { nombre, precio, stock } = req.body;
    const producto = await productoService.crear({ nombre, precio, stock });
    res.status(201).json(producto);
  } catch (err) {
    next(err);
  }
}

export async function actualizar(req, res, next) {
  try {
    const { nombre, precio, stock } = req.body;
    const producto = await productoService.actualizar(Number(req.params.id), { nombre, precio, stock });
    res.status(200).json(producto);
  } catch (err) {
    next(err);
  }
}

export async function desactivar(req, res, next) {
  try {
    const resultado = await productoService.desactivar(Number(req.params.id));
    res.status(200).json(resultado);
  } catch (err) {
    next(err);
  }
}
