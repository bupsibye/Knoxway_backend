-- Включаем расширение для UUID
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Пользователи
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  telegram_id   BIGINT NOT NULL UNIQUE,
  username      TEXT,
  first_name    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Баланс звёзд
CREATE TABLE IF NOT EXISTS user_balances (
  user_id       INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  stars         INTEGER NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Подарки
CREATE TABLE IF NOT EXISTS gifts (
  id            SERIAL PRIMARY KEY,
  owner_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  link          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'stored',   -- stored | pending_withdraw | withdrawn | used
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Обмены
CREATE TABLE IF NOT EXISTS exchanges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending | accepted | rejected | completed
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Подарки внутри конкретного обмена
CREATE TABLE IF NOT EXISTS exchange_items (
  id            SERIAL PRIMARY KEY,
  exchange_id   UUID NOT NULL REFERENCES exchanges(id) ON DELETE CASCADE,
  gift_id       INTEGER NOT NULL REFERENCES gifts(id) ON DELETE CASCADE,
  side          TEXT NOT NULL,  -- from | to
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Покупки за рубли
CREATE TABLE IF NOT EXISTS purchases (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_name     TEXT NOT NULL,
  price_rub     NUMERIC(10,2) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
