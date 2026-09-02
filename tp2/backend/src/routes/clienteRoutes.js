import { Router } from 'express';
import * as clienteController from '../controllers/clienteController.js';

const router = Router();

router.get('/', clienteController.listar);
router.get('/:id', clienteController.obtener);
router.post('/', clienteController.crear);
router.put('/:id', clienteController.actualizar);
router.delete('/:id', clienteController.desactivar);

export default router;
