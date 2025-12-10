import { Telegraf } from 'telegraf';
import { BOT_TOKEN, WEBHOOK_URL } from '../config';

if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN is required');
}

export const bot = new Telegraf(BOT_TOKEN);

export async function setupBot() {
  bot.start((ctx) =>
    ctx.reply(
      'Привет! Это бот для мини-приложения обмена подарками. Открой Mini App через кнопку в меню.'
    )
  );

  bot.help((ctx) =>
    ctx.reply('Используй мини-приложение, чтобы обмениваться подарками.')
  );

  if (WEBHOOK_URL) {
    await bot.telegram.setWebhook(WEBHOOK_URL);
    console.log('✅ Webhook set:', WEBHOOK_URL);
  } else {
    await bot.launch();
    console.log('✅ Bot started with long polling');
  }

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}