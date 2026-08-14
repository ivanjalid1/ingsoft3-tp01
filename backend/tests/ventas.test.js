import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import * as ventaModel from '../src/models/ventaModel.js';
import * as clienteModel from '../src/models/clienteModel.js';
import * as productoModel from '../src/models/productoModel.js';

vi.mock('../src/models/ventaModel.js', () => ({
  obtenerConexion: vi.fn(),
  listar: vi.fn(),
  buscarCabecera: vi.fn(),
  listarItems: vi.fn(),
  crearCabecera: vi.fn(),
  crearItem: vi.fn(),
  marcarAnulada: vi.fn()
}));

vi.mock('../src/models/clienteModel.js', () => ({
  listar: vi.fn(),
  buscarPorId: vi.fn(),
  buscarPorEmail: vi.fn(),
  crear: vi.fn(),
  actualizar: vi.fn(),
  desactivar: vi.fn()
}));

vi.mock('../src/models/productoModel.js', () => ({
  listar: vi.fn(),
  buscarPorId: vi.fn(),
  buscarPorIdParaActualizar: vi.fn(),
  crear: vi.fn(),
  actualizar: vi.fn(),
  desactivar: vi.fn(),
  descontarStock: vi.fn(),
  reponerStock: vi.fn()
}));

const TOKEN = jwt.sign(
  { sub: 1, email: 'admin@erp.local' },
  'secreto-de-test',
  { algorithm: 'HS256', expiresIn: '8h' }
);

const CLIENTE = {
  id: 1, nombre: 'Cliente Demo', email: 'demo@cliente.local',
  telefono: '3510000000', activo: true
};

const TECLADO = { id: 1, nombre: 'Teclado', precio: 15000, stock: 20 };
const MONITOR = { id: 2, nombre: 'Monitor', precio: 180000, stock: 5 };

// Doble de la conexión de mysql2. Registra si se hizo commit o rollback,
// que es exactamente lo que hay que poder afirmar en el test 3.
function conexionFalsa() {
  return {
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    release: vi.fn(),
    execute: vi.fn().mockResolvedValue([[], []])
  };
}

describe('POST /api/ventas', () => {
  let conn;

  beforeEach(() => {
    vi.clearAllMocks();
    conn = conexionFalsa();
    ventaModel.obtenerConexion.mockResolvedValue(conn);
    clienteModel.buscarPorId.mockResolvedValue(CLIENTE);
  });

  // ── TEST 1 del TP5 — Validación ────────────────────────────────
  it('rechaza con 400 VENTA_SIN_ITEMS una venta sin ítems', async () => {
    const respuesta = await request(app)
      .post('/api/ventas')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ cliente_id: 1, items: [] });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VENTA_SIN_ITEMS');
    // Ni siquiera se abrió una transacción.
    expect(ventaModel.obtenerConexion).not.toHaveBeenCalled();
    expect(ventaModel.crearCabecera).not.toHaveBeenCalled();
  });

  // ── TEST 2 del TP5 — Validación ────────────────────────────────
  it('rechaza con 400 CANTIDAD_INVALIDA una cantidad en cero', async () => {
    const respuesta = await request(app)
      .post('/api/ventas')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ cliente_id: 1, items: [{ producto_id: 1, cantidad: 0 }] });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('CANTIDAD_INVALIDA');
    expect(ventaModel.crearCabecera).not.toHaveBeenCalled();
  });

  it('rechaza con 400 CANTIDAD_INVALIDA una cantidad negativa', async () => {
    const respuesta = await request(app)
      .post('/api/ventas')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ cliente_id: 1, items: [{ producto_id: 1, cantidad: -3 }] });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('CANTIDAD_INVALIDA');
    expect(ventaModel.crearCabecera).not.toHaveBeenCalled();
  });

  // ── TEST 3 del TP5 — Restricción / integridad transaccional ─────
  it('rechaza con 409 STOCK_INSUFICIENTE y NO descuenta stock de ningún ítem', async () => {
    // El primer ítem tiene stock de sobra; el segundo no. La venta entera
    // se cae y no se descuenta NADA, ni siquiera lo del primero.
    productoModel.buscarPorIdParaActualizar
      .mockResolvedValueOnce(TECLADO)                        // pide 2, hay 20
      .mockResolvedValueOnce({ ...MONITOR, stock: 1 });      // pide 3, hay 1

    const respuesta = await request(app)
      .post('/api/ventas')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({
        cliente_id: 1,
        items: [
          { producto_id: 1, cantidad: 2 },
          { producto_id: 2, cantidad: 3 }
        ]
      });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('STOCK_INSUFICIENTE');
    expect(productoModel.descontarStock).not.toHaveBeenCalled();
    expect(ventaModel.crearCabecera).not.toHaveBeenCalled();
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.commit).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  // ── TEST 4 del TP5 — Cálculo ───────────────────────────────────
  it('crea la venta con 201, calcula el total y descuenta el stock exacto', async () => {
    productoModel.buscarPorIdParaActualizar
      .mockResolvedValueOnce(TECLADO)
      .mockResolvedValueOnce(MONITOR);
    ventaModel.crearCabecera.mockResolvedValue(7);
    ventaModel.crearItem.mockResolvedValue(1);
    ventaModel.buscarCabecera.mockResolvedValue({
      id: 7, cliente_id: 1, cliente_nombre: 'Cliente Demo',
      fecha: '2026-08-13T14:22:05.000Z', total: 210000, estado: 'pendiente'
    });
    ventaModel.listarItems.mockResolvedValue([
      { id: 1, producto_id: 1, producto_nombre: 'Teclado', cantidad: 2, precio_unitario: 15000, subtotal: 30000 },
      { id: 2, producto_id: 2, producto_nombre: 'Monitor', cantidad: 1, precio_unitario: 180000, subtotal: 180000 }
    ]);

    const respuesta = await request(app)
      .post('/api/ventas')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({
        cliente_id: 1,
        items: [
          { producto_id: 1, cantidad: 2 },
          { producto_id: 2, cantidad: 1 }
        ]
      });

    expect(respuesta.status).toBe(201);
    // 2 * 15000 + 1 * 180000 = 210000
    expect(ventaModel.crearCabecera).toHaveBeenCalledWith(conn, 1, 210000);
    expect(respuesta.body.total).toBe(210000);
    expect(respuesta.body.items).toHaveLength(2);

    // El precio se congela: el ítem lleva el precio leído del producto.
    expect(ventaModel.crearItem).toHaveBeenNthCalledWith(1, conn, 7, {
      producto_id: 1, cantidad: 2, precio_unitario: 15000, subtotal: 30000
    });
    expect(ventaModel.crearItem).toHaveBeenNthCalledWith(2, conn, 7, {
      producto_id: 2, cantidad: 1, precio_unitario: 180000, subtotal: 180000
    });

    // Y el stock se descuenta con las cantidades exactas.
    expect(productoModel.descontarStock).toHaveBeenNthCalledWith(1, conn, 1, 2);
    expect(productoModel.descontarStock).toHaveBeenNthCalledWith(2, conn, 2, 1);
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.rollback).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  it('rechaza con 404 PRODUCTO_NO_ENCONTRADO si el producto no existe o está inactivo', async () => {
    productoModel.buscarPorIdParaActualizar.mockResolvedValueOnce(null);

    const respuesta = await request(app)
      .post('/api/ventas')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ cliente_id: 1, items: [{ producto_id: 99, cantidad: 1 }] });

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('PRODUCTO_NO_ENCONTRADO');
    expect(conn.rollback).toHaveBeenCalledTimes(1);
  });

  it('rechaza con 404 CLIENTE_NO_ENCONTRADO si el cliente no existe', async () => {
    clienteModel.buscarPorId.mockResolvedValue(null);

    const respuesta = await request(app)
      .post('/api/ventas')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ cliente_id: 99, items: [{ producto_id: 1, cantidad: 1 }] });

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('CLIENTE_NO_ENCONTRADO');
    expect(ventaModel.obtenerConexion).not.toHaveBeenCalled();
  });

  it('rechaza con 400 DATOS_INVALIDOS si items no es un array', async () => {
    const respuesta = await request(app)
      .post('/api/ventas')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ cliente_id: 1, items: 'dos teclados' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('DATOS_INVALIDOS');
  });
});

describe('GET /api/ventas/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve 404 VENTA_NO_ENCONTRADA si no existe', async () => {
    ventaModel.buscarCabecera.mockResolvedValue(null);

    const respuesta = await request(app)
      .get('/api/ventas/99')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('VENTA_NO_ENCONTRADA');
  });

  // Misma regla que en clientes y productos: un :id no numérico se corta en
  // el service y nunca llega a una query.
  it('devuelve 400 DATOS_INVALIDOS con un id no numérico y no llega al model', async () => {
    const respuesta = await request(app)
      .get('/api/ventas/abc')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('DATOS_INVALIDOS');
    expect(ventaModel.buscarCabecera).not.toHaveBeenCalled();
  });
});
