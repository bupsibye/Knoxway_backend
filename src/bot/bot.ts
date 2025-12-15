import { Telegraf, Context, Markup } from 'telegraf';
import { BOT_TOKEN, WEBHOOK_URL, FRONTEND_URL } from '../config';

if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN is required');
}

export const bot = new Telegraf(BOT_TOKEN);

// Хранилище состояний сценариев подарков
const giftFlowState = new Map<number, { step: string; link?: string; username?: string }>();

// ID аккаунта-хранилища
const STORAGE_USER_ID = 7626757547; // @xaroca
const STORAGE_USERNAME = '@xaroca';

export async function setupBot() {
  // Обработка /start с параметром add_gift
  bot.start(async (ctx) => {
    const payload = ctx.match?.trim();
    const userId = ctx.from.id;
    const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name || 'пользователь';

    if (payload === 'add_gift') {
      // ✅ Сценарий внесения подарка
      giftFlowState.set(userId, { step: 'waiting_link', username });
      await ctx.reply(
        '📦 Скиньте ссылку на подарок, который хотите внести в свой инвентарь.',
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Обычное приветствие
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
          [Markup.button.webApp('🛍 Открыть Knox Market', FRONTEND_URL)]
        ])
      }
    );
  });

  // Обработка текста (ссылка на подарок)
  bot.on('text', async (ctx, next) => {
    const userId = ctx.from.id;
    const state = giftFlowState.get(userId);

    if (state?.step === 'waiting_link') {
      const giftLink = ctx.message.text.trim();
      const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name || 'пользователь';

      // ✅ Сохраняем ссылку и переходим к передаче в хранилище
      giftFlowState.set(userId, { 
        step: 'waiting_storage_confirm', 
        link: giftLink, 
        username 
      });

      // Пользователю: кнопка передачи подарка
      await ctx.reply(
        '📤 <b>Отправьте подарок в наше хранилище</b>\n\n' +
        'Нажмите кнопку ниже, чтобы передать подарок:',
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.url('🚚 Передать подарок', `https://t.me/${STORAGE_USERNAME.slice(1)}`)]
          ])
        }
      );

      // ✅ ПИШЕМ ХРАНИЛИЩУ (@xaroca) уведомление
      const storageMessage = 
        `📦 <b>${username} должен передать вам подарок</b>\n\n` +
        `🔗 <a href="${giftLink}">Ссылка на подарок</a>\n\n` +
        '<b>Пользователь передал подарок?</b>`;

      await bot.telegram.sendMessage(
        STORAGE_USER_ID,
        storageMessage,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback('✅ Да, подарок получен', `storage_confirm_yes:${userId}:${giftLink}`),
              Markup.button.callback('❌ Нет, подарок не получен', `storage_confirm_no:${userId}`)
            ]
          ])
        }
      );

      return; // Не передаем дальше
    }

    return next(); // Обычная обработка текста
  });

  // Обработка кнопок хранилища
  bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const userId = ctx.from.id;

    // ✅ Хранилище подтвердило "Да, подарок получен"
    if (data?.startsWith('storage_confirm_yes:')) {
      const [, targetUserId, giftLink] = data.split(':');
      const targetId = Number(targetUserId);

      // Удаляем состояние
      giftFlowState.delete(targetId);

      // ✅ ПИШЕМ ПОЛЬЗОВАТЕЛЮ: успешно!
      await ctx.telegram.sendMessage(
        targetId,
        '✅ <b>Подарок успешно передан в наше хранилище!</b>\n\n' +
        'Ожидайте пару минут и он появится у вас в инвентаре.',
        { parse_mode: 'HTML' }
      );

      await ctx.answerCbQuery('Подарок подтверждён!');
      return;
    }

    // ✅ Хранилище подтвердило "Нет, подарок не получен"
    if (data?.startsWith('storage_confirm_no:')) {
      const [, targetUserId] = data.split(':');
      const targetId = Number(targetUserId);

      // Удаляем состояние
      giftFlowState.delete(targetId);

      // ✅ ПИШЕМ ПОЛЬЗОВАТЕЛЮ: отказ
      await ctx.telegram.sendMessage(
        targetId,
        '❌ <b>К сожалению, вы не передали подарок в наше хранилище.</b>\n\n' +
        'Этот подарок не будет отображаться у вас в инвентаре.',
        { parse_mode: 'HTML' }
      );

      await ctx.answerCbQuery('Подарок отклонён');
      return;
    }

    // Существующая логика обмена (НЕ ТРОГАЕТСЯ)
    // ... exchange_accept, exchange_reject handlers ...
  });

  // Существующие обработчики обмена (остаются без изменений)
  // bot.action('exchange_accept:...') 
  // bot.action('exchange_reject:...') 
  // exchangeRequests Map логика
}
