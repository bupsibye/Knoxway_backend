import express from 'express';
import cors from 'cors';
import { json } from 'express';
import { PORT } from './config';
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

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });

  await setupBot();
}

bootstrap().catch((err) => {
  console.error('Bootstrap error:', err);
  process.exit(1);
});
