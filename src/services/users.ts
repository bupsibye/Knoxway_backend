// backend/src/services/users.ts

export interface User {
  telegramId: number;
  username: string;
}

const users: User[] = [
  // тестовые пользователи, подставь реальные id и username, когда узнаешь их
  { telegramId: 111111111, username: 'user1' },
  { telegramId: 222222222, username: 'user2' }
];

export async function getUserByUsername(username: string): Promise<User | null> {
  const clean = username.replace(/^@/, '').toLowerCase();
  const user = users.find((u) => u.username.toLowerCase() === clean);
  return user || null;
}

