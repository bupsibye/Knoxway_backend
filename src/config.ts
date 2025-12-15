// backend/src/config.ts

export const PORT = Number(process.env.PORT) || 3000;

export const BOT_TOKEN = process.env.BOT_TOKEN || '';
export const WEBHOOK_URL = process.env.WEBHOOK_URL || '';

export const FRONTEND_URL =
  process.env.FRONTEND_URL || 'https://knoxway-frontend.vercel.app';

export const BACKEND_URL =
  process.env.BACKEND_URL || 'https://knoxway-backend.onrender.com';
