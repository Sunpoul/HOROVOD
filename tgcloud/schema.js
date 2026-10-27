import { table, text } from 'sdk/db';

// Маленькое хранилище «ключ — значение» для служебных данных бота:
// версия применённых настроек и file_id картинки приветствия.
export const settings = table('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
