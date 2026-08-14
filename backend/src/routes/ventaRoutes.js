import { Router } from 'express';
import * as ventaController from '../controllers/ventaController.js';

// El token ya lo exige el middleware montado en routes/index.js: acá no se
// vuelve a agregar. La ruta de anular llega en la Tarea 7.
const router = Router();

router.get('/', ventaController.listar);
router.get('/:id', ventaController.obtener);
router.post('/', ventaController.crear);

export default router;
