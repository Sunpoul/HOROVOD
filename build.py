"""Собирает приложение из src/app.src.html и шрифтов.

  index.html                              — веб-версия, библиотеки из vendor/ встроены в файл (работает без CDN)
  ios/TextCircle3D/Resources/Web/*        — офлайн-версия для iOS-приложения (библиотеки из vendor/)
"""
import base64, json, pathlib, re, shutil, subprocess

root = pathlib.Path(__file__).parent
b64 = lambda p: base64.b64encode((root / 'fonts' / p).read_bytes()).decode()
src = (root / 'src' / 'app.src.html').read_text(encoding='utf-8')
app = (src.replace('__UB__', b64('unbounded-bold-subset.ttf'))
          .replace('__RM__', b64('rubik-mono-one-subset.ttf'))
          .replace('__CJK__', b64('noto-sans-sc-bold-subset.ttf'))
          .replace('__TS__', b64('tsarevich.ttf'))
          .replace("'__MUXER__'", json.dumps((root / 'vendor' / 'mp4-muxer.mjs').read_text(encoding='utf-8')).replace('</', '<\\/'))
          .replace('__BN__', b64('bebas-neue.ttf'))
          .replace('__OS__', b64('oswald-bold.ttf')))

# стикеры: stickers/sticker-<id>.png → встроенный список
import json
STICKER_LABELS = {'wings': 'Сердце с крыльями', 'glasses': 'Очки-сердца', 'mushroom': 'Мухомор', 'fire': 'Огонь', 'smile': 'Смайл'}
stickers = []
for sid, label in STICKER_LABELS.items():
    f = root / 'stickers' / f'sticker-{sid}.png'
    if f.exists():
        stickers.append({'id': sid, 'label': label, 'src': 'data:image/png;base64,' + base64.b64encode(f.read_bytes()).decode()})
app = app.replace("'__STICKERS__'", json.dumps(stickers, ensure_ascii=False))

# Библиотеки с CDN — источник правды для обеих сборок (iOS заменяет их на файлы из бандла)
VENDOR = [
    ('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', 'three.min.js'),
    ('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js', 'OrbitControls.js'),
    ('https://cdn.jsdelivr.net/npm/opentype.js@1.3.4/dist/opentype.min.js', 'opentype.min.js'),
]

# Веб: встраиваем библиотеки прямо в index.html, чтобы редактор не зависел от CDN
# (cdnjs работает через Cloudflare, который в России замедляют) и открывался без интернета.
web = app
for cdn, local in VENDOR:
    tag = f'<script src="{cdn}"></script>'
    assert tag in web, cdn
    code = (root / 'vendor' / local).read_text(encoding='utf-8')
    code = re.sub(r'</(script)', r'<\\/\1', code, flags=re.I)  # не закрыть <script> раньше времени
    web = web.replace(tag, f'<script>/* {local} */\n{code}\n</script>')
# Google Fonts интерфейса не блокируют отрисовку: при недоступности сервиса остаётся system-ui
web = re.sub(r'<link rel="stylesheet" (href="https://fonts\.googleapis\.com/[^"]+")>',
             r'<link rel="stylesheet" \1 media="print" onload="this.media=\'all\'">', web)
(root / 'index.html').write_text(web, encoding='utf-8')

print('Собрано: index.html (библиотеки встроены)')

# iOS-часть собирается только если рядом лежит папка ios/
if not (root / 'ios' / 'genspec.js').exists():
    print('Папки ios/ нет — iOS-бандл пропущен')
    raise SystemExit(0)

# iOS: свой каркас страницы, библиотеки из бандла, без Google Fonts
ios = re.sub(r'<link rel="(preconnect|stylesheet)"[^>]*>\n?', '', app)
for cdn, local in VENDOR:
    assert cdn in ios, cdn
    ios = ios.replace(cdn, local)
head = ('<!doctype html><html lang="ru"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">'
        '<style>html,body{height:100%;margin:0;background:#000;-webkit-user-select:none;user-select:none;'
        '-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}[hidden]{display:none!important}</style>'
        # ловим любые ошибки движка (в т.ч. незагрузившиеся скрипты) и показываем их в приложении
        '<script>(function(){function send(t){try{webkit.messageHandlers.krug.postMessage({type:"engineError",text:String(t).slice(0,300)})}catch(e){}}'
        'window.addEventListener("error",function(e){var s=e.target&&e.target.src;'
        'send(s?"Не загрузился файл "+s.split("/").pop():(e.message||"Ошибка")+(e.filename?" · "+e.filename.split("/").pop()+":"+e.lineno:""))},true);'
        'window.addEventListener("unhandledrejection",function(e){var r=e.reason;send(r&&r.message?r.message:r)})})();</script>'
        '</head><body>')
web = root / 'ios' / 'TextCircle3D' / 'Resources' / 'Web'
web.mkdir(parents=True, exist_ok=True)
(web / 'index.html').write_text(head + ios + '</body></html>', encoding='utf-8')
for f in ['three.min.js', 'OrbitControls.js', 'opentype.min.js']:
    shutil.copy(root / 'vendor' / f, web / f)

# миниатюры стикеров для нативного интерфейса
sdir = root / 'ios' / 'TextCircle3D' / 'Resources' / 'Stickers'
sdir.mkdir(parents=True, exist_ok=True)
for sid in STICKER_LABELS:
    if (root / 'stickers' / f'sticker-{sid}.png').exists():
        shutil.copy(root / 'stickers' / f'sticker-{sid}.png', sdir / f'sticker-{sid}.png')

# Подписи и диапазоны ползунков для SwiftUI берутся из того же исходника
subprocess.run(['node', str(root / 'ios' / 'genspec.js')], check=True)
print('Собрано: iOS-бандл ios/TextCircle3D/Resources/Web')
