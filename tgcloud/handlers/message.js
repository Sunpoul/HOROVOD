// Любое личное сообщение боту (в том числе /start и /help) получает приветственный пост
// с кнопкой «Начать», которая открывает Mini App. Групповые чаты бот игнорирует.
import { ensureSetup, sendWelcome } from '../lib/welcome.js';

export default async function (message) {
  if (!message.chat || message.chat.type !== 'private') return;
  try {
    await ensureSetup();
  } catch (e) {
    console.error('Настройка бота не выполнена:', e.description || e.message); // приветствие всё равно отправим
  }
  await sendWelcome(message.chat.id);
}
