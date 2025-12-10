import dotenv from 'dotenv';

dotenv.config();

export const PORT = Number(process.env.PORT) || 4000;
export const BOT_TOKEN = process.env.BOT_TOKEN || '';
export const WEBHOOK_URL = process.env.WEBHOOK_URL || '';

if (!BOT_TOKEN) {
  console.warn('⚠️ BOT_TOKEN is not set in .env');
}