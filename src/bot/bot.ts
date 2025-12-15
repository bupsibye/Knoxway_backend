import { Telegraf, Context, Markup } from 'telegraf';
import { BOT_TOKEN, WEBHOOK_URL, FRONTEND_URL } from '../config';

if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN is required');
}

export const bot = new Telegraf(BOT_TOKEN);

type ExchangeRequestStatus = 'pending' | 'accepted' | 'rejected';

interface ExchangeRequest {
  id: string;
  fromUserId: number;
  fromUsername?: string;
  toUserId: number;
  toUsername?: string;
  status: ExchangeRequestStatus;
  exchangeLink: string | null;
}

const exchangeRequests = new Map<string, ExchangeRequest>();

// простая генерация id
function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

export async function setupBot() {
  // /start
  bot.start(async (ctx) => {
    const user = ctx.from;
    const name = user?.username ? `@${user.username}` : user?.first_name || 'друг';

    const text =
      `👋 Привет, ${name}! Добро пожаловать в Knox Market!\n\n` +
      `Здесь ты можешь:\n` +
      `- 💬 Обмениваться подарками с друзьями;\n` +
      `- 🎁 Покупать и дарить подарки за рубли;\n` +
      `- ⭐️ Покупать звезды по выгодному курсу;\n` +
      `- 🔒 Обмениваться безопасно, без «скинь первым — иду на доверии».\n\n` +
      `Нажми кнопку ниже, чтобы начать:`;

    await ctx.reply(text, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🛍 Открыть Knox Market',
              web_app: {
                url: FRONTEND_URL || 'https://knoxway-frontend.vercel.app'
              }
            }
          ]
        ]
      }
    });
  });

  bot.help((ctx) =>
    ctx.reply('Используй мини-приложение, чтобы обмениваться подарками.')
  );

  // ======== API-хендлер, который дергает backend (см. routes/exchange.ts) ========
  // Вызывается не пользователем, а твоим сервером через bot.telegram.sendMessage,
  // поэтому здесь дополнительных команд не нужно.

  // ======== Обработка callback-кнопок Принять / Отклонить ========

  bot.on('callback_query', async (ctx) => {
    const cb = ctx.callbackQuery;
    if (!('data' in cb) || !cb.data) return;

    const [action, requestId] = cb.data.split(':');
    const request = exchangeRequests.get(requestId);
    if (!request) {
      await ctx.answerCbQuery('Заявка не найдена или устарела');
      return;
    }

    const fromUser = request.fromUsername
      ? `@${request.fromUsername}`
      : `id ${request.fromUserId}`;
    const toUser = request.toUsername
      ? `@${request.toUsername}`
      : `id ${request.toUserId}`;

    if (action === 'exchange_accept') {
      if (request.status !== 'pending') {
        await ctx.answerCbQuery('Заявка уже обработана');
        return;
      }

      request.status = 'accepted';
      const exchangeId = generateId();
      const link =
        (FRONTEND_URL || 'https://knoxway-frontend.vercel.app') +
        `/exchange?exchangeId=${exchangeId}`;
      request.exchangeLink = link;
      exchangeRequests.set(request.id, request);

      await ctx.answerCbQuery('Обмен принят ✅', { show_alert: false });

      // отправляем ссылку обоим
      await bot.telegram.sendMessage(
        request.toUserId,
        `✅ Вы приняли обмен с ${fromUser}.\n\nВот ссылка на экран обмена:\n${link}`
      );
      await bot.telegram.sendMessage(
        request.fromUserId,
        `✅ ${toUser} принял(а) ваше предложение обмена.\n\nВот ссылка на экран обмена:\n${link}`
      );
    }

    if (action === 'exchange_reject') {
      if (request.status !== 'pending') {
        await ctx.answerCbQuery('Заявка уже обработана');
        return;
      }

      request.status = 'rejected';
      exchangeRequests.set(request.id, request);

      await ctx.answerCbQuery('Предложение отклонено', { show_alert: false });

      await bot.telegram.sendMessage(
        request.fromUserId,
        `❌ ${toUser} отказался от вашего предложения обмена`
      );
    }
  });

  // запуск
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

// Вспомогательная функция, чтобы backend мог создать заявку и отправить предложение
export function createExchangeRequestAndNotify(params: {
  fromUserId: number;
  fromUsername?: string;
  toUserId: number;
  toUsername?: string;
}) {
  const id = generateId();
  const request: ExchangeRequest = {
    id,
    fromUserId: params.fromUserId,
    fromUsername: params.fromUsername,
    toUserId: params.toUserId,
    toUsername: params.toUsername,
    status: 'pending',
    exchangeLink: null
  };

  exchangeRequests.set(id, request);

  const fromUser = params.fromUsername ? `@${params.fromUsername}` : 'пользователь';

  const text =
    `🔄 У вас новое предложение на обмен!\n\n` +
    `От: ${fromUser}\n` +
    `Предлагает обменяться подарками.\n\n` +
    `👉 Примите или отклоните:`;

  bot.telegram.sendMessage(
    params.toUserId,
    text,
    Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Принять', `exchange_accept:${id}`),
        Markup.button.callback('❌ Отклонить', `exchange_reject:${id}`)
      ]
    ])
  );
}
