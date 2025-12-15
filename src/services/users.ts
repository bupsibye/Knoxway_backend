// backend/src/services/users.ts
export interface User {
  telegramId: number;
  username: string;
}

const users: User[] = [
  // тестовые пользователи
  { telegramId: 7626757547, username: 'xaroca' },
  { telegramId: 7203050773, username: 'knifenrose' },
];

export async function getUserByUsername(username: string): Promise<User | null> {
  const clean = username.replace(/^@/, '').toLowerCase();
  const user = users.find((u) => u.username.toLowerCase() === clean);
  return user || null;
}
