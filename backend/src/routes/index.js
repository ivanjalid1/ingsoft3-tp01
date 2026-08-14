import { Router } from 'express';
import { verificarToken } from '../middlewares/auth.js';
import authRoutes from './authRoutes.js';
import clienteRoutes from './clienteRoutes.js';

const router = Router();

// Público: es el único endpoint al que se llega sin token.
router.use('/auth', authRoutes);

// De acá para abajo, todo pide token. El middleware se monta una sola vez:
// cualquier router nuevo que se agregue debajo queda protegido sin hacer nada.
router.use(verificarToken);

router.use('/clientes', clienteRoutes);

export default router;
