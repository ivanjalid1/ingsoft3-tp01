import { Router } from 'express';
import * as ventaController from '../controllers/ventaController.js';

// El token ya lo exige el middleware montado en routes/index.js: acá no se
// vuelve a agregar.
const router = Router();

router.get('/', ventaController.listar);
router.get('/:id', ventaController.obtener);
router.post('/', ventaController.crear);
router.post('/:id/anular', ventaController.anular);

export default router;
