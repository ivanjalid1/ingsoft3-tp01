import { Router } from 'express';
import * as productoController from '../controllers/productoController.js';

const router = Router();

router.get('/', productoController.listar);
router.get('/:id', productoController.obtener);
router.post('/', productoController.crear);
router.put('/:id', productoController.actualizar);
router.delete('/:id', productoController.desactivar);

export default router;
