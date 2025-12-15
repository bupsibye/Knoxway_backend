import { Router } from 'express';
import meRouter from './me';
import { exchangeRouter } from './exchange';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

router.use('/me', meRouter);
router.use('/exchange', exchangeRouter);

export default router;
