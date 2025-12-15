import { Router } from 'express';
import { createExchangeRequestAndNotify } from '../bot/bot';
import { getUserByUsername } from '../services/users'; // заглушка, см. ниже

export const exchangeRouter = Router();

/**
 * POST /api/exchange/request
 * body: { fromUserId: number; fromUsername?: string; toUsername: string }
 */
exchangeRouter.post('/request', async (req, res) => {
  try {
    const { fromUserId, fromUsername, toUsername } = req.body as {
      fromUserId: number;
      fromUsername?: string;
      toUsername: string;
    };

    if (!fromUserId || !toUsername) {
      return res.status(400).json({ error: 'fromUserId and toUsername are required' });
    }

    // ищем пользователя по username
    const targetUser = await getUserByUsername(toUsername.replace(/^@/, ''));

    if (!targetUser) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    createExchangeRequestAndNotify({
      fromUserId,
      fromUsername,
      toUserId: targetUser.telegramId,
      toUsername: targetUser.username
    });

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal error' });
  }
});
