import { Telegraf, Markup } from 'telegraf';
import { BOT_TOKEN, FRONTEND_URL } from '../config';

if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN is required');
}

export const bot = new Telegraf(BOT_TOKEN);

// ====== Обмен: in‑memory заявки ======

type ExchangeRequestStatus = 'pending' | 'accepted' | 'rejected';

interface ExchangeRequest {
  id: string;
  fromUserId: number;
  fromUsername?: string;
  toUserId: number;
  toUsername?: string;
  status: ExchangeRequestStatus;
}

const exchangeRequests = new Map<string, ExchangeRequest>();

export interface CreateExchangeParams {
  fromUserId: number;
  fromUsername?: string;
  toUserId: number;
  toUsername?: string;
}

/**
 * Создаёт заявку на обмен и отправляет уведомление получателю
 */
export async function createExchangeRequestAndNotify(params: CreateExchangeParams) {
  const id = Math.random().toString(36).slice(2, 10);

  const req: ExchangeRequest = {
    id,
    fromUserId: params.fromUserId,
    fromUsername: params.fromUsername,
    toUserId: params.toUserId,
    toUsername: params.toUsername,
    status: 'pending',
  };

  exchangeRequests.set(id, req);

  const fromUserText = params.fromUsername ? `@${params.fromUsername}` : 'пользователь';

  const text =
    '🔄 У вас новое предложение на обмен!\n\n' +
    `От: ${fromUserText}\n` +
    'Предлагает обменяться подарками.\n\n' +
    '👉 Примите или отклоните:';

  await bot.telegram.sendMessage(
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

// ====== Подарки: сценарий с хранилищем ======

const giftFlowState = new Map<number, { step: string; link?: string; username?: string }>();

// ID аккаунта-хранилища (Telegram ID @xaroca)
const STORAGE_USER_ID = 7626757547; // проверь, что это реальный ID аккаунта-хранилища
const STORAGE_USERNAME = '@xaroca';

export async function setupBot() {
  // /start и /start add_gift
  bot.start(async (ctx) => {
    // match может быть строкой или массивом — берём безопасно
    const rawMatch = ctx.match as unknown;
    const payload =
      typeof rawMatch === 'string'
        ? rawMatch.trim()
        : Array.isArray(rawMatch) && typeof rawMatch[0] === 'string'
        ? rawMatch[0].trim()
        : undefined;

    const userId = ctx.from.id;
    const username = ctx.from.username
      ? `@${ctx.from.username}`
      : ctx.from.first_name || 'пользователь';

    // /start add_gift → сценарий внесения подарка
    if (payload === 'add_gift') {
      giftFlowState.set(userId, { step: 'waiting_link', username });
      await ctx.reply(
        '📦 Скиньте ссылку на подарок, который хотите внести в свой инвентарь.',
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Любой другой /start → приветствие
    await ctx.reply(
      `👋 Привет, ${username}! Добро пожаловать в <b>Knox Market</b>!\n\n` +
        'Здесь ты можешь:\n' +
        '• 💬 Обмениваться подарками с друзьями\n' +
        '• 🎁 Покупать и дарить подарки за рубли\n' +
        '• ⭐️ Покупать звезды по выгодному курсу\n' +
        '• 🔒 Обмениваться безопасно\n\n' +
        '<b>Нажми кнопку ниже, чтобы начать:</b>',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('🛍 Открыть Knox Market', FRONTEND_URL)],
        ]),
      }
    );
  });

  // Ссылка на подарок от пользователя
  bot.on('text', async (ctx, next) => {
    const userId = ctx.from.id;
    const state = giftFlowState.get(userId);

    if (state?.step === 'waiting_link') {
      const giftLink = ctx.message.text.trim();
      const username = ctx.from.username
        ? `@${ctx.from.username}`
        : ctx.from.first_name || 'пользователь';

      giftFlowState.set(userId, {
        step: 'waiting_storage_confirm',
        link: giftLink,
        username,
      });

      // пользователю — кнопка передачи подарка
      await ctx.reply(
        '📤 <b>Отправьте подарок в наше хранилище</b>\n\n' +
          'Нажмите кнопку ниже, чтобы передать подарок:',
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [
              Markup.button.url(
                '🚚 Передать подарок',
                `https://t.me/${STORAGE_USERNAME.slice(1)}`
              ),
            ],
          ]),
        }
      );

      // хранилищу — уведомление с кнопками
      const storageMessage =
        `📦 <b>${username} должен передать вам подарок</b>\n\n` +
        `🔗 <a href="${giftLink}">Ссылка на подарок</a>\n\n` +
        '<b>Пользователь передал подарок?</b>';

      await bot.telegram.sendMessage(STORAGE_USER_ID, storageMessage, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              '✅ Да, подарок получен',
              `storage_confirm_yes:${userId}:${giftLink}`
            ),
            Markup.button.callback(
              '❌ Нет, подарок не получен',
              `storage_confirm_no:${userId}`
            ),
          ],
        ]),
      });

      return;
    }

    return next();
  });

  // Все callback‑кнопки
  bot.on('callback_query', async (ctx) => {
    const cq: any = ctx.callbackQuery;
    const data: string = cq && 'data' in cq ? cq.data : '';

    // ====== Кнопки хранилища ======

    if (data.startsWith('storage_confirm_yes:')) {
      const [, targetUserId] = data.split(':');
      const targetId = Number(targetUserId);

      giftFlowState.delete(targetId);

      await ctx.telegram.sendMessage(
        targetId,
        '✅ <b>Подарок успешно передан в наше хранилище!</b>\n\n' +
          'Ожидайте пару минут и он появится у вас в инвентаре.',
        { parse_mode: 'HTML' }
      );

      await ctx.answerCbQuery('Подарок подтверждён!');
      return;
    }

    if (data.startsWith('storage_confirm_no:')) {
      const [, targetUserId] = data.split(':');
      const targetId = Number(targetUserId);

      giftFlowState.delete(targetId);

      await ctx.telegram.sendMessage(
        targetId,
        '❌ <b>К сожалению, вы не передали подарок в наше хранилище.</b>\n\n' +
          'Этот подарок не будет отображаться у вас в инвентаре.',
        { parse_mode: 'HTML' }
      );

      await ctx.answerCbQuery('Подарок отклонён');
      return;
    }

    // ====== Кнопки обмена ======

    if (data.startsWith('exchange_accept:')) {
      const [, exchangeId] = data.split(':');
      const req = exchangeRequests.get(exchangeId);

      if (!req || req.status !== 'pending') {
        await ctx.answerCbQuery('Заявка не найдена или уже обработана');
        return;
      }

      req.status = 'accepted';
      exchangeRequests.set(exchangeId, req);

      const toUserName = req.toUsername ? `@${req.toUsername}` : 'пользователь';

      await ctx.telegram.sendMessage(
        req.fromUserId,
        `✅ ${toUserName} принял(а) ваше предложение обмена`
      );

      await ctx.answerCbQuery('Вы приняли предложение обмена');
      return;
    }

    if (data.startsWith('exchange_reject:')) {
      const [, exchangeId] = data.split(':');
      const req = exchangeRequests.get(exchangeId);

      if (!req || req.status !== 'pending') {
        await ctx.answerCbQuery('Заявка не найдена или уже обработана');
        return;
      }

      req.status = 'rejected';
      exchangeRequests.set(exchangeId, req);

      const toUserName = req.toUsername ? `@${req.toUsername}` : 'пользователь';

      await ctx.telegram.sendMessage(
        req.fromUserId,
        `❌ ${toUserName} отказался(ась) от вашего предложения обмена`
      );

      await ctx.answerCbQuery('Вы отклонили предложение обмена');
      return;
    }
  });

  // дальше остаётся запуск/вебхук, как в твоём проекте
}
