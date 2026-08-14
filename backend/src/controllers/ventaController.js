import * as ventaService from '../services/ventaService.js';

export async function listar(req, res, next) {
  try {
    const ventas = await ventaService.listar();
    res.status(200).json(ventas);
  } catch (err) {
    next(err);
  }
}

export async function obtener(req, res, next) {
  try {
    const venta = await ventaService.obtener(Number(req.params.id));
    res.status(200).json(venta);
  } catch (err) {
    next(err);
  }
}

export async function crear(req, res, next) {
  try {
    const { cliente_id: clienteId, items } = req.body;
    const venta = await ventaService.crear(clienteId, items);
    res.status(201).json(venta);
  } catch (err) {
    next(err);
  }
}

export async function anular(req, res, next) {
  try {
    const resultado = await ventaService.anular(Number(req.params.id));
    res.status(200).json(resultado);
  } catch (err) {
    next(err);
  }
}
