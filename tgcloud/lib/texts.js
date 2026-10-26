// Тексты и адреса бота HOROVOD. Меняете здесь — после `npx tgcloud push`
// бот подхватит их сам (см. SETUP_VERSION ниже).

export const APP_URL = 'https://horovod.su/';

// Картинка приветствия раздаётся GitHub Pages из папки brand/ репозитория.
// В Serverless нет файловой системы, поэтому Telegram скачивает её по ссылке,
// а дальше бот отправляет сохранённый file_id.
export const COVER_URL = 'https://horovod.su/brand/telegram/welcome-1280x720.png';

export const BUTTON = 'Начать';

export const CAPTION = [
  '<b>HOROVOD</b>',
  '',
  'Редактор объёмной типографики прямо в Telegram.',
  '',
  '• текст по кругу, квадрату и цилиндру в 3D',
  '• свои шрифты, картинки, фигуры и музыка',
  '• свет, эффекты, готовое видео или PNG',
  '',
  'Нажмите «Начать», чтобы открыть редактор.',
].join('\n');

export const ABOUT = 'Текст по кругу в 3D: редактор типографики, видео и PNG прямо в Telegram';

export const DESCRIPTION = 'HOROVOD — редактор объёмной типографики. Пишите текст по кругу, квадрату или цилиндру в 3D, добавляйте свои шрифты, картинки, музыку и эффекты. Сохраняйте результат как PNG или видео. Всё работает прямо в Telegram.';

export const COMMANDS = [
  { command: 'start', description: 'Открыть редактор' },
  { command: 'help', description: 'Что умеет HOROVOD' },
];

// Увеличьте число, если поменяли ABOUT, DESCRIPTION, COMMANDS или APP_URL:
// при следующем сообщении бот заново отправит настройки в Telegram.
// Если поменялась картинка приветствия — тоже увеличьте, чтобы сбросить её file_id.
export const SETUP_VERSION = 1;
