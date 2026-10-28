// Приветственный бот HOROVOD: на /start присылает картинку, описание и кнопку «Начать», которая открывает Mini App.
// Без зависимостей, нужен Node 18 или новее.
//
//   node bot/horovod-bot.mjs
//
// Токен из @BotFather скрипт берёт из BOT_TOKEN, затем из файла bot/.token, иначе спросит в терминале.
// Токен нигде не сохраняется и не печатается.
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
// скрытый ввод токена в терминале
function askToken() {
  return new Promise(resolve => {
    const stdin = process.stdin; let buf = '';
    process.stdout.write('Вставьте токен бота и нажмите Return (символы не показываются): ');
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8');
    const onData = chunk => {
      for (const c of chunk) {
        if (c === '\r' || c === '\n') { stdin.setRawMode(false); stdin.pause(); stdin.off('data', onData); process.stdout.write('\n'); resolve(buf.trim()); return; }
        if (c === '\u0003') process.exit(130);
        if (c === '\u007f' || c === '\b') buf = buf.slice(0, -1);
        else if (c >= ' ') buf += c;
      }
    };
    stdin.on('data', onData);
  });
}
// токен: переменная окружения, затем файл bot/.token (в git не попадает), затем скрытый запрос в терминале
const fileToken = () => { try { return readFileSync(path.join(here, '.token'), 'utf8').trim(); } catch (e) { return ''; } };
const TOKEN = process.env.BOT_TOKEN || fileToken() || (process.stdin.isTTY ? await askToken() : '');
const APP_URL = process.env.APP_URL || 'https://sunpoul.github.io/HOROVOD/';
const API = process.env.TG_API || 'https://api.telegram.org'; // свой адрес нужен только для проверки на поддельном API
const COVER = path.join(here, '..', 'brand', 'telegram', 'welcome-1280x720.png');

if (!TOKEN) { console.error('Токен не введён. Запустите в терминале: node bot/horovod-bot.mjs'); process.exit(1); }

const BUTTON = 'Начать';
const CAPTION = [
  '<b>HOROVOD</b>',
  '',
  'Живые постеры и афиши прямо в Telegram.',
  '',
  '🌀 объёмный текст по кругу, квадрату и цилиндру',
  '🎨 свои шрифты, картинки, фигуры и музыка',
  '✨ свет, эффекты, готовое видео или PNG',
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

async function nudge(chatId) {
  await call('sendMessage', { chat_id: chatId, text: 'Редактор HOROVOD открывается кнопкой «Начать». Если приветствие потерялось, отправьте /start.', reply_markup: keyboard });
}

async function setup() {
  await call('setMyCommands', { commands: [{ command: 'start', description: 'Открыть редактор' }, { command: 'help', description: 'Что умеет HOROVOD' }] });
  await call('setMyShortDescription', { short_description: ABOUT });
  await call('setMyDescription', { description: DESCRIPTION });
  await call('setChatMenuButton', { menu_button: { type: 'web_app', text: 'HOROVOD', web_app: { url: APP_URL } } });
}

// --- Отправка из редактора: Mini App присылает готовое видео, бот проверяет подпись Telegram и отправляет файл тому, кто его открыл ---
const PORT = Number(process.env.PORT) || 8787;
const ORIGINS = (process.env.ALLOW_ORIGINS || 'https://horovod.su,https://sunpoul.github.io').split(',').map(x => x.trim());
const MAX_BYTES = 50 * 1024 * 1024; // Bot API принимает файлы до 50 МБ
// initData подписан токеном бота: так мы знаем, что это настоящий пользователь Telegram, и берём его id из подписанных данных
function verifyInit(initData) {
  try {
    const p = new URLSearchParams(initData); const hash = p.get('hash'); if (!hash) return null; p.delete('hash');
    const check = [...p.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(TOKEN).digest();
    const mine = crypto.createHmac('sha256', secret).update(check).digest();
    const theirs = Buffer.from(hash, 'hex');
    if (theirs.length !== mine.length || !crypto.timingSafeEqual(mine, theirs)) return null;
    if (Date.now() / 1000 - Number(p.get('auth_date')) > 86400) return null; // данные старше суток не принимаем
    const user = JSON.parse(p.get('user') || 'null');
    return user && user.id ? user : null;
  } catch (e) { return null; }
}
function startServer() {
  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    const cors = { 'access-control-allow-origin': ORIGINS.includes(origin) ? origin : ORIGINS[0], 'access-control-allow-headers': 'content-type, x-init-data, x-kind, x-duration', 'access-control-allow-methods': 'POST, OPTIONS', vary: 'origin' };
    const reply = (code, obj) => { res.writeHead(code, { ...cors, 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
    if (req.method === 'GET' && req.url === '/') { reply(200, { ok: true, name: 'horovod-bot' }); return; }
    if (req.method !== 'POST' || req.url !== '/send') { reply(404, { ok: false, error: 'нет такого адреса' }); return; }
    if (origin && !ORIGINS.includes(origin)) { reply(403, { ok: false, error: 'запрос с чужого сайта' }); return; }
    const user = verifyInit(String(req.headers['x-init-data'] || ''));
    if (!user) { reply(401, { ok: false, error: 'не удалось проверить, что это Telegram' }); return; }
    const chunks = []; let size = 0;
    for await (const c of req) { size += c.length; if (size > MAX_BYTES) { reply(413, { ok: false, error: 'файл больше 50 МБ' }); req.destroy(); return; } chunks.push(c); }
    if (!size) { reply(400, { ok: false, error: 'пустой файл' }); return; }
    const note = req.headers['x-kind'] === 'note', sec = Math.min(60, Math.max(1, Number(req.headers['x-duration']) || 1));
    try {
      const form = new FormData();
      form.set('chat_id', String(user.id));
      const file = new Blob([Buffer.concat(chunks)], { type: 'video/mp4' });
      if (note) { form.set('length', '640'); form.set('duration', String(sec)); form.set('video_note', file, 'horovod.mp4'); await call('sendVideoNote', null, form); }
      else { form.set('supports_streaming', 'true'); form.set('video', file, 'horovod.mp4'); await call('sendVideo', null, form); }
      reply(200, { ok: true });
    } catch (e) {
      // чаще всего это «бот не может писать первым»: человек не нажимал START у бота
      console.error('Не отправилось:', e.message);
      reply(502, { ok: false, error: /blocked|chat not found|can't initiate/i.test(e.message) ? 'сначала откройте бота и нажмите START' : e.message });
    }
  });
  server.listen(PORT, () => console.log(`Приём файлов из редактора: порт ${PORT}`));
}

async function main() {
  await setup().catch(e => console.error('Настройка бота не выполнена:', e.message));
  startServer();
  console.log('Бот запущен. Остановить: Ctrl+C');
  let offset = 0;
  for (;;) {
    try {
      const updates = await call('getUpdates', { offset, timeout: 50, allowed_updates: ['message'] });
      for (const u of updates) {
        offset = u.update_id + 1;
        const m = u.message; if (!m || m.chat.type !== 'private') continue;
        // /start (так бот открывается впервые по кнопке START) получает полное приветствие, остальные сообщения — короткий ответ с той же кнопкой
        const first = /^\/start(\s|$|@)/.test(m.text || '');
        await (first ? welcome(m.chat.id) : nudge(m.chat.id)).catch(e => console.error('Не отправилось:', e.message));
      }
    } catch (e) {
      console.error('Связь с Telegram:', e.message);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}
main();
