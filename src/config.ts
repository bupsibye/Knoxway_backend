import dotenv from 'dotenv';

dotenv.config();

export const PORT = Number(process.env.PORT) || 4000;
export const BOT_TOKEN = process.env.BOT_TOKEN || '8212274685:AAEN_jjb3hUnVN9CxdR9lSrG416yQXmk4Tk';
export const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://knoxway-backend.onrender.com/telegram/webhook';

if (!BOT_TOKEN) {
  console.warn('⚠️ BOT_TOKEN is not set in .env');
}
