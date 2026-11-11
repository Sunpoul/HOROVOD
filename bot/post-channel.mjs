// Пост с кнопкой «Открыть HOROVOD» в Telegram-канал: картинка, подпись и кнопка со ссылкой на Mini App.
// Бот должен быть администратором канала с правом «Публикация сообщений» (для закрепа ещё «Закрепление сообщений»).
//
//   node bot/post-channel.mjs @имя_канала
//   node bot/post-channel.mjs @имя_канала --pin
//   node bot/post-channel.mjs -1001234567890 --text "Свой текст поста (HTML)" --button "Открыть редактор"
//   node bot/post-channel.mjs @имя_канала --dry      # только показать, что будет отправлено
//
// Параметры:
//   --text "…"     подпись к посту (HTML: <b>, <i>, <a href>); без него — стандартное описание HOROVOD
//   --button "…"   надпись на кнопке (по умолчанию «Открыть HOROVOD»)
//   --url "…"      куда ведёт кнопка (по умолчанию https://t.me/gethorovod_bot?startapp)
//   --no-photo     без картинки, только текст
//   --pin          закрепить пост без уведомления
//   --dry          ничего не отправлять
//
// Кнопка со ссылкой t.me/<бот>?startapp открывает Mini App, если в @BotFather включён Main Mini App:
// /mybots → бот → Bot Settings → Configure Mini App. Кнопка типа web_app в каналах не работает, только в личных чатах.
// Токен: BOT_TOKEN или файл bot/.token (как у самого бота). Скрипт не печатает и не сохраняет его.
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = n => args.includes(n);
const val = n => { const i = args.indexOf(n); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : undefined; };

const channel = args.find(a => /^(@[\w]{4,}|-100\d+)$/.test(a));
if (!channel) {
  console.error('Укажите канал: node bot/post-channel.mjs @имя_канала   (или числовой id вида -1001234567890)');
  process.exit(1);
}

const fileToken = () => { try { return readFileSync(path.join(here, '.token'), 'utf8').trim(); } catch (e) { return ''; } };
const TOKEN = process.env.BOT_TOKEN || fileToken();
const API = process.env.TG_API || 'https://api.telegram.org';
const COVER = path.join(here, '..', 'brand', 'telegram', 'welcome-1280x720.png');

const CAPTION = val('--text') || [
  '<b>HOROVOD</b>',
  '',
  'Живые постеры и афиши прямо в Telegram.',
  '',
  '🌀 объёмный текст по кругу, квадрату и цилиндру',
  '🎨 свои шрифты, картинки, фигуры и музыка',
  '✨ свет, эффекты, готовое видео или PNG',
  '',
  'Нажмите кнопку ниже, чтобы открыть редактор.',
].join('\n');
const BUTTON = val('--button') || 'Открыть HOROVOD';
const URL = val('--url') || 'https://t.me/gethorovod_bot?startapp';
const withPhoto = !flag('--no-photo');
const markup = { inline_keyboard: [[{ text: BUTTON, url: URL }]] };

if (flag('--dry')) {
  console.log(JSON.stringify({ channel, photo: withPhoto ? COVER : null, caption: CAPTION, reply_markup: markup, pin: flag('--pin') }, null, 2));
  process.exit(0);
}
if (!TOKEN) {
  console.error('Нет токена бота. Положите его в файл: скопируйте токен из @BotFather и выполните  pbpaste > bot/.token && chmod 600 bot/.token');
  process.exit(1);
}

const call = async (method, body, form) => {
  const res = await fetch(`${API}/bot${TOKEN}/${method}`, form ? { method: 'POST', body: form }
    : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
  const json = await res.json().catch(() => ({}));
  if (!json.ok) throw new Error(json.description || String(res.status));
  return json.result;
};

try {
  let msg;
  if (withPhoto) {
    const form = new FormData();
    form.set('chat_id', channel); form.set('caption', CAPTION); form.set('parse_mode', 'HTML'); form.set('reply_markup', JSON.stringify(markup));
    form.set('photo', new Blob([await readFile(COVER)], { type: 'image/png' }), 'horovod.png');
    msg = await call('sendPhoto', null, form);
  } else {
    msg = await call('sendMessage', { chat_id: channel, text: CAPTION, parse_mode: 'HTML', reply_markup: markup, link_preview_options: { is_disabled: true } });
  }
  const link = msg.chat && msg.chat.username ? `https://t.me/${msg.chat.username}/${msg.message_id}` : '(канал приватный, ссылки нет)';
  console.log('Опубликовано:', link);
  if (flag('--pin')) { await call('pinChatMessage', { chat_id: channel, message_id: msg.message_id, disable_notification: true }); console.log('Пост закреплён.'); }
} catch (e) {
  const m = String(e.message || e);
  if (/chat not found/i.test(m)) console.error('Канал не найден или бот в нём не состоит. Добавьте бота администратором канала и проверьте имя.');
  else if (/not enough rights|administrator|CHAT_ADMIN_REQUIRED/i.test(m)) console.error('У бота нет прав: в администраторах канала включите «Публикация сообщений» (и «Закрепление сообщений» для --pin).');
  else console.error('Не отправилось:', m);
  process.exit(1);
}
