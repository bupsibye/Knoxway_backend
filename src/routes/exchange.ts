import { Router, Request, Response } from 'express';

const router = Router();

router.post('/request', (req: Request, res: Response) => {
  const { targetUsername } = req.body as { targetUsername?: string };

  if (!targetUsername) {
    return res.status(400).json({ error: 'targetUsername is required' });
  }

  const fakeTradeId = 'trade_' + Date.now();

  res.json({
    tradeId: fakeTradeId,
    status: 'pending',
    message: `Предложение обмена отправлено пользователю @${targetUsername}`,
  });
});

router.get('/history', (req: Request, res: Response) => {
  const userId = req.query.userId as string | undefined;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  res.json({
    userId,
    trades: [],
  });
});

export default router;