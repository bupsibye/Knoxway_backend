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

// ==== настройки хранилища подарков ====
const STORAGE_USERNAME = 'xaroca'; // username хранилища
const STORAGE_LINK = 'https://t.me/xaroca';

enum GiftFlowStep {
  None = 'none',
  WaitingLink = 'waiting_link',
  WaitingStorageConfirm = 'waiting_storage_confirm',
}

const giftFlowState = new Map<
  number,
  { step: GiftFlowStep; giftLink?: string }
>();

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
                url: FRONTEND_URL || 'https://knoxway-frontend.vercel.app',
              },
            },
          ],
        ],
      },
    });
  });

  bot.help((ctx) =>
    ctx.reply('Используй мини-приложение, чтобы обмениваться подарками.')
  );

  // ======== Сценарий внесения подарка ========

  // старт через команду /add_gift (мы будем открывать её с фронта)
  bot.command('add_gift', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    giftFlowState.set(userId, { step: GiftFlowStep.WaitingLink });
    await ctx.reply(
      'Скиньте ссылку на подарок, который хотите внести в свой инвентарь.'
    );
  });

  // перехватываем текст только если ждём ссылку на подарок
  bot.on('text', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const state = giftFlowState.get(userId);
    if (!state || state.step !== GiftFlowStep.WaitingLink) {
      return; // не в процессе внесения подарка – ничего не делаем
    }

    const giftLink = ctx.message.text.trim();
    if (!giftLink) {
      await ctx.reply('Пожалуйста, отправьте корректную ссылку на подарок.');
      return;
    }

    giftFlowState.set(userId, {
      step: GiftFlowStep.WaitingStorageConfirm,
      giftLink,
    });

    const username = ctx.from?.username
      ? `@${ctx.from.username}`
      : `id ${userId}`;

    // сообщение пользователю с кнопкой на хранилище
    await ctx.reply('Отправьте подарок в наше хранилище.', {
      reply_markup: {
        inline_keyboard: [[{ text: 'Передать подарок', url: STORAGE_LINK }]],
      },
    });

    // сообщение аккаунту-хранилищу
    await bot.telegram.sendMessage(
      STORAGE_USERNAME,
      `${username} должен передать вам подарок:\n${giftLink}`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: 'Да, подарок получен', callback_data: `gift_yes:${userId}` },
            { text: 'Нет, подарок не получен', callback_data: `gift_no:${userId}` },
          ]],
        },
      }
    );
  });

  // ======== Обработка callback-кнопок (обмен + хранилище) ========

  bot.on('callback_query', async (ctx) => {
    const cb = ctx.callbackQuery;
    if (!('data' in cb) || !cb.data) return;

    const [action, payload] = cb.data.split(':');

    // --- кнопки хранилища ---
    if (action === 'gift_yes' || action === 'gift_no') {
      const targetUserId = Number(payload);
      const state = giftFlowState.get(targetUserId);
      if (!state || state.step !== GiftFlowStep.WaitingStorageConfirm) {
        await ctx.answerCbQuery('Процесс внесения подарка не найден или устарел');
        return;
      }

      giftFlowState.delete(targetUserId);

      if (action === 'gift_yes') {
        await ctx.answerCbQuery('Отмечено: подарок получен ✅');
        await bot.telegram.sendMessage(
          targetUserId,
          'Подарок успешно передан в наше хранилище, ожидайте пару минут и он появится у вас в инвентаре.'
        );
      } else {
        await ctx.answerCbQuery('Отмечено: подарок не получен');
        await bot.telegram.sendMessage(
          targetUserId,
          'К сожалению, вы не передали подарок в наше хранилище. Этот подарок не будет отображаться у вас в инвентаре.'
        );
      }

      return;
    }

    // --- старые кнопки обмена ---
    const requestId = payload;
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
    exchangeLink: null,
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
        Markup.button.callback('❌ Отклонить', `exchange_reject:${id}`),
      ],
    ])
  );
}
