// /start (так бот открывается впервые по кнопке START) получает приветственный пост с кнопкой «Начать»,
// остальные личные сообщения — короткое напоминание с той же кнопкой. Групповые чаты бот игнорирует.
import { ensureSetup, sendWelcome, sendNudge } from '../lib/welcome.js';

export default async function (message) {
  if (!message.chat || message.chat.type !== 'private') return;
  try {
    await ensureSetup();
  } catch (e) {
    console.error('Настройка бота не выполнена:', e.description || e.message); // ответ всё равно отправим
  }
  const isStart = /^\/start(\s|$|@)/.test(message.text || '');
  await (isStart ? sendWelcome(message.chat.id) : sendNudge(message.chat.id));
}
