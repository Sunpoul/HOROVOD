// Приветственный бот HOROVOD: на /start присылает картинку, описание и кнопку «Начать», которая открывает Mini App.
// Без зависимостей, нужен Node 18 или новее.
//
//   BOT_TOKEN=<токен из @BotFather> node bot/horovod-bot.mjs
//
// Токен берётся только из переменной окружения и нигде не сохраняется и не печатается.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const TOKEN = process.env.BOT_TOKEN;
const APP_URL = process.env.APP_URL || 'https://sunpoul.github.io/HOROVOD/';
const API = process.env.TG_API || 'https://api.telegram.org'; // свой адрес нужен только для проверки на поддельном API
const here = path.dirname(fileURLToPath(import.meta.url));
const COVER = path.join(here, '..', 'brand', 'telegram', 'welcome-1280x720.png');

if (!TOKEN) { console.error('Задайте токен: BOT_TOKEN=... node bot/horovod-bot.mjs'); process.exit(1); }

const BUTTON = 'Начать';
const CAPTION = [
  '<b>HOROVOD</b>',
  '',
  'Живые постеры и афиши прямо в Telegram.',
  '',
  '• объёмный текст по кругу, квадрату и цилиндру',
  '• свои шрифты, картинки, фигуры и музыка',
  '• свет, эффекты, готовое видео или PNG',
  '',
  'Нажмите «Начать», чтобы открыть редактор.',
].join('\n');
const ABOUT = 'Живые постеры и афиши: объёмный текст, музыка и эффекты, видео и PNG прямо в Telegram';
const DESCRIPTION = 'HOROVOD — редактор живых постеров и афиш. Собирайте объёмную типографику: текст по кругу, квадрату или цилиндру, свои шрифты, картинки, фигуры, музыку и эффекты. Сохраняйте результат как видео или PNG. Всё работает прямо в Telegram.';

const call = async (method, body, form) => {
  const res = await fetch(`${API}/bot${TOKEN}/${method}`, form ? { method: 'POST', body: form }
    : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
  const json = await res.json().catch(() => ({}));
  if (!json.ok) throw new Error(`${method}: ${json.description || res.status}`);
  return json.result;
};

const keyboard = { inline_keyboard: [[{ text: BUTTON, web_app: { url: APP_URL } }]] };
let coverId = null; // после первой отправки Telegram запоминает файл, повторно его не загружаем
async function welcome(chatId) {
  if (coverId) { await call('sendPhoto', { chat_id: chatId, photo: coverId, caption: CAPTION, parse_mode: 'HTML', reply_markup: keyboard }); return; }
  const form = new FormData();
  form.set('chat_id', String(chatId)); form.set('caption', CAPTION); form.set('parse_mode', 'HTML'); form.set('reply_markup', JSON.stringify(keyboard));
  form.set('photo', new Blob([await readFile(COVER)], { type: 'image/png' }), 'horovod.png');
  const msg = await call('sendPhoto', null, form);
  coverId = msg.photo && msg.photo.at(-1) && msg.photo.at(-1).file_id;
}

async function setup() {
  await call('setMyCommands', { commands: [{ command: 'start', description: 'Открыть редактор' }, { command: 'help', description: 'Что умеет HOROVOD' }] });
  await call('setMyShortDescription', { short_description: ABOUT });
  await call('setMyDescription', { description: DESCRIPTION });
  await call('setChatMenuButton', { menu_button: { type: 'web_app', text: 'HOROVOD', web_app: { url: APP_URL } } });
}

async function main() {
  await setup().catch(e => console.error('Настройка бота не выполнена:', e.message));
  console.log('Бот запущен. Остановить: Ctrl+C');
  let offset = 0;
  for (;;) {
    try {
      const updates = await call('getUpdates', { offset, timeout: 50, allowed_updates: ['message'] });
      for (const u of updates) {
        offset = u.update_id + 1;
        const m = u.message; if (!m || m.chat.type !== 'private') continue;
        await welcome(m.chat.id).catch(e => console.error('Не отправилось:', e.message));
      }
    } catch (e) {
      console.error('Связь с Telegram:', e.message);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}
main();
