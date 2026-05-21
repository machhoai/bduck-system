import { Router } from 'express';
import { sessionLogin, logout } from '../controllers/authController';

const router = Router();

router.post('/sessionLogin', sessionLogin);
router.post('/logout', logout);

export default router;
