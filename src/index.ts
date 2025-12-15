import express from 'express';
import cors from 'cors';
import { json } from 'express';
import { PORT, WEBHOOK_URL } from './config';
import routes from './routes';
import { bot, setupBot } from './bot/bot';

async function bootstrap() {
  const app = express();

  app.use(cors());
  app.use(json());

  // API
  app.use('/api', routes);

  // Webhook для бота
  app.post('/telegram/webhook', (req, res) => {
    (bot as any).handleUpdate(req.body);
    res.status(200).json({ ok: true });
  });

  await setupBot();

  // Настраиваем webhook у Telegram, если задан WEBHOOK_URL
  if (WEBHOOK_URL) {
    const webhookUrl = `${WEBHOOK_URL.replace(/\/+$/, '')}/telegram/webhook`;
    await bot.telegram.setWebhook(webhookUrl);
    console.log(`🤖 Webhook set to ${webhookUrl}`);
  } else {
    console.log('⚠️ WEBHOOK_URL is empty, Telegram updates не будут приходить');
  }

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Bootstrap error:', err);
  process.exit(1);
});
