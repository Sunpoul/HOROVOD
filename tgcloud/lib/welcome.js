import { api } from 'sdk';
import { getSetting, setSetting } from './store.js';
import { APP_URL, COVER_URL, BUTTON, CAPTION, ABOUT, DESCRIPTION, COMMANDS, SETUP_VERSION } from './texts.js';

const keyboard = { inline_keyboard: [[{ text: BUTTON, web_app: { url: APP_URL } }]] };

// Команды, описание, строка «О боте» и кнопка меню. Применяются один раз на SETUP_VERSION:
// отдельного «запуска» у serverless-бота нет, поэтому настройки уходят при первом сообщении после деплоя.
export async function ensureSetup() {
  if (Number(await getSetting('setup_version')) >= SETUP_VERSION) return;
  await api.setMyCommands({ commands: COMMANDS });
  await api.setMyShortDescription({ short_description: ABOUT });
  await api.setMyDescription({ description: DESCRIPTION });
  await api.setChatMenuButton({ menu_button: { type: 'web_app', text: 'HOROVOD', web_app: { url: APP_URL } } });
  await setSetting('cover_file_id', '');            // новая версия — картинку загрузим заново
  await setSetting('setup_version', SETUP_VERSION);
}

// Приветственный пост: картинка, подпись и кнопка «Начать», открывающая Mini App.
export async function sendWelcome(chatId) {
  const cached = await getSetting('cover_file_id');
  const base = { chat_id: chatId, caption: CAPTION, parse_mode: 'HTML', reply_markup: keyboard };
  try {
    const msg = await api.sendPhoto({ ...base, photo: cached || COVER_URL });
    if (!cached && msg.photo && msg.photo.length) await setSetting('cover_file_id', msg.photo.at(-1).file_id);
  } catch (e) {
    // Картинка недоступна (например, домен ещё не подключён): сбрасываем кэш и шлём текст с той же кнопкой.
    console.error('sendPhoto не удался:', e.description || e.message);
    if (cached) await setSetting('cover_file_id', '');
    await api.sendMessage({ chat_id: chatId, text: CAPTION, parse_mode: 'HTML', reply_markup: keyboard });
  }
}
