// Приветственный бот HOROVOD: на /start присылает картинку, описание и кнопку «Начать», которая открывает Mini App.
// Новости об обновлениях: /news показывает последнюю версию из bot/news.json, при запуске новая версия один раз рассылается всем, кто писал боту.
// Поддержка: сообщения из экрана «Поддержка» в Mini App и любые сообщения в чате бот пересылает разработчику; ответ реплаем уходит обратно человеку.
// Без зависимостей, нужен Node 18 или новее.
//
//   node bot/horovod-bot.mjs
//
// Токен из @BotFather скрипт берёт из BOT_TOKEN, затем из файла bot/.token, иначе спросит в терминале.
// Токен нигде не сохраняется и не печатается.
import { readFile, writeFile, rename, appendFile } from 'node:fs/promises';
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

// --- Новости об обновлениях ---
// Источник — bot/news.json (новая версия добавляется в начало списка). Кому писать — bot/.subscribers.json:
// туда попадает каждый, кто написал боту в личку. Какая версия уже разослана — bot/.state.json. Оба файла в git не попадают.
const NEWS_FILE = path.join(here, 'news.json');
const SUBS_FILE = path.join(here, '.subscribers.json');
const STATE_FILE = path.join(here, '.state.json');
const readJson = async (file, fallback) => { try { return JSON.parse(await readFile(file, 'utf8')); } catch (e) { return fallback; } };
const writeJson = async (file, data) => { const tmp = file + '.tmp'; await writeFile(tmp, JSON.stringify(data, null, 2)); await rename(tmp, file); };
const subs = new Set((await readJson(SUBS_FILE, [])).map(Number));
let subsDirty = false;
const saveSubs = () => { if (!subsDirty) return Promise.resolve(); subsDirty = false; return writeJson(SUBS_FILE, [...subs]).catch(e => console.error('Список подписчиков не сохранён:', e.message)); };
function remember(chatId) { if (!subs.has(chatId)) { subs.add(chatId); subsDirty = true; saveSubs(); } }
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => saveSubs().finally(() => process.exit(0)));
const gotNews = new Set(); // кто уже получил последнюю версию за этот запуск (например, сам спросил /news во время рассылки)

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const ruDate = iso => { const [, m, d] = String(iso).split('-').map(Number); return m && d ? `${d} ${MONTHS[m - 1]}` : ''; };
async function latestNews() { const n = await readJson(NEWS_FILE, null); return n && Array.isArray(n.releases) && n.releases[0] || null; }
function newsText(r) {
  const out = [`<b>HRVD ${esc(r.version)}${r.title ? ' — ' + esc(r.title) : ''}</b>`];
  if (r.date) out.push(`<i>${ruDate(r.date)}</i>`);
  if (r.done && r.done.length) out.push('', '<b>Что нового</b>', ...r.done.map(x => '• ' + esc(x)));
  if (r.fixed && r.fixed.length) out.push('', '<b>Исправлено</b>', ...r.fixed.map(x => '• ' + esc(x)));
  out.push('', 'Нажмите «Открыть», чтобы попробовать.');
  return out.join('\n');
}
const newsKeyboard = { inline_keyboard: [[{ text: 'Открыть', web_app: { url: APP_URL } }]] };
async function sendNews(chatId) {
  const r = await latestNews();
  if (!r) { await call('sendMessage', { chat_id: chatId, text: 'Новостей пока нет.', reply_markup: keyboard }); return; }
  await call('sendMessage', { chat_id: chatId, text: newsText(r), parse_mode: 'HTML', reply_markup: newsKeyboard, link_preview_options: { is_disabled: true } });
  gotNews.add(chatId);
}
// Рассылка новой версии: один раз на версию, примерно 20 сообщений в секунду (лимит Telegram — 30).
// Кто заблокировал бота, удаляется из списка. ANNOUNCE=0 при запуске — не рассылать.
async function announce() {
  if (process.env.ANNOUNCE === '0') return;
  const r = await latestNews(); if (!r) return;
  const state = await readJson(STATE_FILE, {});
  if (state.announced === r.version) return;
  let sent = 0, gone = 0;
  for (const id of [...subs]) {
    if (gotNews.has(id)) continue;
    try { await sendNews(id); sent++; }
    catch (e) {
      if (/blocked|deactivated|chat not found|kicked/i.test(e.message)) { subs.delete(id); subsDirty = true; gone++; }
      else console.error(`Новость не ушла ${id}:`, e.message);
      const wait = /retry after (\d+)/i.exec(e.message); if (wait) await new Promise(res => setTimeout(res, (Number(wait[1]) + 1) * 1000));
    }
    await new Promise(res => setTimeout(res, 50));
  }
  await saveSubs();
  await writeJson(STATE_FILE, { ...state, announced: r.version, at: new Date().toISOString(), sent });
  console.log(`Новость ${r.version} разослана: ${sent} получили${gone ? `, ${gone} заблокировали бота` : ''}`);
}

// --- Поддержка ---
// Кому пересылать: bot/.admins — id чатов по одному в строке (свой id присылает команда /admin, записывается на сервере).
// Связь «пересланное сообщение → кому ответить» — bot/.support.json. Если админов нет, сообщения копятся в bot/.inbox.jsonl.
const ADMINS_FILE = path.join(here, '.admins');
const MAP_FILE = path.join(here, '.support.json');
const INBOX_FILE = path.join(here, '.inbox.jsonl');
const admins = () => { try { return readFileSync(ADMINS_FILE, 'utf8').split(/\s+/).map(Number).filter(Boolean); } catch (e) { return []; } };
const isAdmin = id => admins().includes(Number(id));
const replyMap = await readJson(MAP_FILE, {});
async function link(adminMsgId, userId) {
  replyMap[adminMsgId] = userId;
  const keys = Object.keys(replyMap); if (keys.length > 2000) keys.slice(0, keys.length - 2000).forEach(k => delete replyMap[k]);
  await writeJson(MAP_FILE, replyMap).catch(e => console.error('Связи поддержки не сохранены:', e.message));
}
const who = u => `${esc([u.first_name, u.last_name].filter(Boolean).join(' ') || 'Без имени')}${u.username ? ' @' + esc(u.username) : ''} (id <code>${u.id}</code>)`;
// text — для сообщения из Mini App; fromChat/messageId — для сообщения в чате (пересылаем как есть, со скриншотами и видео)
async function toSupport(user, { text, diag, fromChat, messageId, source, note }) {
  const list = admins();
  const head = `🐞 <b>Поддержка</b> · ${source}\nОт: ${who(user)}` + (text ? `\n\n${esc(text)}` : '') + (diag ? `\n\n<i>${esc(diag)}</i>` : '');
  if (!list.length) {
    await appendFile(INBOX_FILE, JSON.stringify({ at: new Date().toISOString(), user: user.id, name: user.username || user.first_name || '', source, text: text || note || '(вложение без подписи)', diag: diag || '' }) + '\n');
    console.warn('Сообщение в поддержку сохранено в bot/.inbox.jsonl: никто не получает поддержку (нет bot/.admins)');
    return;
  }
  for (const a of list) {
    try {
      const h = await call('sendMessage', { chat_id: a, text: head + '\n\nОтветьте реплаем на это сообщение — ответ уйдёт человеку.', parse_mode: 'HTML' });
      await link(h.message_id, user.id);
      if (fromChat) { const f = await call('forwardMessage', { chat_id: a, from_chat_id: fromChat, message_id: messageId }); await link(f.message_id, user.id); }
    } catch (e) { console.error(`Поддержка не дошла до ${a}:`, e.message); }
  }
}
const ackAt = new Map(); // не отвечать «передал» на каждое фото из альбома: не чаще раза в 2 минуты
async function ackSupport(chatId) {
  if (Date.now() - (ackAt.get(chatId) || 0) < 120000) return; ackAt.set(chatId, Date.now());
  await call('sendMessage', { chat_id: chatId, text: 'Спасибо, передал разработчику. Ответ придёт сюда.\n\nРедактор открывается кнопкой «Начать».', reply_markup: keyboard });
}
async function supportPrompt(chatId) {
  await call('sendMessage', { chat_id: chatId, text: 'Опишите, что случилось и что вы делали перед этим. Можно прислать скриншот или запись экрана. Всё передам разработчику, ответ придёт сюда.' });
}
// разработчик ответил реплаем на сообщение поддержки — копируем ответ человеку
async function adminReply(m) {
  const target = replyMap[m.reply_to_message.message_id];
  if (!target) { await call('sendMessage', { chat_id: m.chat.id, text: 'Не понял, кому ответить: отвечайте реплаем на сообщение «Поддержка» или пересланное сообщение человека.' }); return; }
  try {
    await call('sendMessage', { chat_id: target, text: '💬 Ответ разработчика HRVD:' });
    await call('copyMessage', { chat_id: target, from_chat_id: m.chat.id, message_id: m.message_id });
    await call('sendMessage', { chat_id: m.chat.id, text: '✓ Отправлено', reply_to_message_id: m.message_id });
  } catch (e) { await call('sendMessage', { chat_id: m.chat.id, text: 'Не отправилось: ' + e.message }); }
}

async function nudge(chatId) {
  await call('sendMessage', { chat_id: chatId, text: 'Редактор HOROVOD открывается кнопкой «Начать». Если приветствие потерялось, отправьте /start.', reply_markup: keyboard });
}

async function setup() {
  await call('setMyCommands', { commands: [{ command: 'start', description: 'Открыть редактор' }, { command: 'help', description: 'Что умеет HOROVOD' }, { command: 'news', description: 'Что нового в последней версии' }, { command: 'support', description: 'Написать в поддержку' }] });
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
// экран «Поддержка» в Mini App: текст до 2000 знаков и данные об устройстве; не чаще раза в 15 секунд от человека
const lastSupport = new Map();
async function supportRequest(req, user, reply) {
  if (Date.now() - (lastSupport.get(user.id) || 0) < 15000) { reply(429, { ok: false, error: 'подождите несколько секунд' }); return; }
  let raw = ''; for await (const c of req) { raw += c; if (raw.length > 20000) { reply(413, { ok: false, error: 'слишком длинное сообщение' }); req.destroy(); return; } }
  let body; try { body = JSON.parse(raw); } catch (e) { reply(400, { ok: false, error: 'не получилось прочитать сообщение' }); return; }
  const text = String(body.text || '').trim().slice(0, 2000), diag = String(body.diag || '').trim().slice(0, 1000);
  if (text.length < 2) { reply(400, { ok: false, error: 'пустое сообщение' }); return; }
  lastSupport.set(user.id, Date.now());
  try { await toSupport(user, { text, diag, source: 'из приложения' }); reply(200, { ok: true }); }
  catch (e) { console.error('Поддержка:', e.message); reply(502, { ok: false, error: 'не получилось передать, попробуйте позже' }); }
}
function startServer() {
  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    const cors = { 'access-control-allow-origin': ORIGINS.includes(origin) ? origin : ORIGINS[0], 'access-control-allow-headers': 'content-type, x-init-data, x-kind, x-duration, x-width, x-height', 'access-control-allow-methods': 'POST, OPTIONS', vary: 'origin' };
    const reply = (code, obj) => { res.writeHead(code, { ...cors, 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
    if (req.method === 'GET' && req.url === '/') { reply(200, { ok: true, name: 'horovod-bot' }); return; }
    if (req.method !== 'POST' || (req.url !== '/send' && req.url !== '/support')) { reply(404, { ok: false, error: 'нет такого адреса' }); return; }
    if (origin && !ORIGINS.includes(origin)) { reply(403, { ok: false, error: 'запрос с чужого сайта' }); return; }
    const user = verifyInit(String(req.headers['x-init-data'] || ''));
    if (!user) { reply(401, { ok: false, error: 'не удалось проверить, что это Telegram' }); return; }
    if (req.url === '/support') { await supportRequest(req, user, reply); return; }
    const chunks = []; let size = 0;
    for await (const c of req) { size += c.length; if (size > MAX_BYTES) { reply(413, { ok: false, error: 'файл больше 50 МБ' }); req.destroy(); return; } chunks.push(c); }
    if (!size) { reply(400, { ok: false, error: 'пустой файл' }); return; }
    const note = req.headers['x-kind'] === 'note', sec = Math.min(60, Math.max(1, Number(req.headers['x-duration']) || 1));
    try {
      const form = new FormData();
      form.set('chat_id', String(user.id));
      const file = new Blob([Buffer.concat(chunks)], { type: 'video/mp4' });
      if (note) { form.set('length', '640'); form.set('duration', String(sec)); form.set('video_note', file, 'horovod.mp4'); await call('sendVideoNote', null, form); }
      else {
        // Telegram не всегда сам разбирает размер кадра: без ширины и высоты вертикальное видео показывается сжатым в квадрат
        const w = Math.round(Number(req.headers['x-width'])), hh = Math.round(Number(req.headers['x-height']));
        if (w >= 16 && hh >= 16 && w <= 8192 && hh <= 8192) { form.set('width', String(w)); form.set('height', String(hh)); }
        form.set('supports_streaming', 'true'); form.set('video', file, 'horovod.mp4'); await call('sendVideo', null, form);
      }
      reply(200, { ok: true });
    } catch (e) {
      // чаще всего это «бот не может писать первым»: человек не нажимал START у бота
      console.error('Не отправилось:', e.message);
      reply(502, { ok: false, error: /blocked|chat not found|can't initiate/i.test(e.message) ? 'сначала откройте бота и нажмите START' : e.message });
    }
  });
  server.listen(PORT, () => console.log(`Приём файлов из редактора: порт ${PORT}`));
}

// /start [news|support], /news, /help, /support, /admin; реплай разработчика — ответ человеку; всё остальное — в поддержку
async function route(m) {
  const t = m.text || '', cmd = /^\/([a-z_]+)(?:@\w+)?(?:\s+(\S+))?/i.exec(t), name = cmd && cmd[1].toLowerCase(), arg = cmd && cmd[2];
  const id = m.chat.id;
  if (name === 'start') return arg === 'news' ? sendNews(id) : arg === 'support' ? supportPrompt(id) : welcome(id);
  if (name === 'help') return welcome(id);
  if (name === 'news') return sendNews(id);
  if (name === 'support' || name === 'bug') return supportPrompt(id);
  if (name === 'admin') return call('sendMessage', { chat_id: id, parse_mode: 'HTML', text: isAdmin(id) ? '✓ Вы получаете сообщения поддержки.' : `Ваш id: <code>${id}</code>\n\nЧтобы получать сообщения поддержки, выполните на сервере:\n<code>echo ${id} &gt;&gt; /opt/horovod/app/bot/.admins</code>` });
  if (isAdmin(id)) return m.reply_to_message ? adminReply(m) : call('sendMessage', { chat_id: id, text: 'Чтобы ответить человеку, ответьте реплаем на его сообщение из поддержки.' });
  if (cmd) return nudge(id); // незнакомая команда
  await toSupport(m.from, { fromChat: id, messageId: m.message_id, source: 'из чата', note: m.text || m.caption });
  await ackSupport(id);
}

async function main() {
  await setup().catch(e => console.error('Настройка бота не выполнена:', e.message));
  startServer();
  console.log('Бот запущен. Остановить: Ctrl+C');
  announce().catch(e => console.error('Рассылка новостей:', e.message));
  let offset = 0;
  for (;;) {
    try {
      const updates = await call('getUpdates', { offset, timeout: 50, allowed_updates: ['message'] });
      for (const u of updates) {
        offset = u.update_id + 1;
        const m = u.message; if (!m || m.chat.type !== 'private') continue;
        // /start (так бот открывается впервые по кнопке START) получает полное приветствие, остальные сообщения — короткий ответ с той же кнопкой
        remember(m.chat.id);
        await route(m).catch(e => console.error('Не отправилось:', e.message));
      }
    } catch (e) {
      console.error('Связь с Telegram:', e.message);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}
main();
