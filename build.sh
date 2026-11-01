#!/usr/bin/env bash
# Собирает урок:
#   docs/index.html  — страница ведущего (GitHub Pages), с голосованием с телефонов
#   docs/p.html      — страница для телефонов учеников
#   urok-dengi.html  — та же страница ведущего одним файлом (открывается двойным кликом)
# Необязательный аргумент — путь для версии без <html>/<head>/<body> и без телефонов (для claude.ai).
set -e
cd "$(dirname "$0")"

FONTS='<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Unbounded:wght@500;600;700;800;900&family=Onest:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap">'

common_head() {
  cat <<EOF
<title>Деньги и их функции</title>
<meta name="claude:viewport-fit-sides" content="cover">
$FONTS
EOF
  echo "<style>"; cat src/styles.css src/coffee.css; echo "</style>"
}
scripts() {
  echo "<script>"
  [ "$1" = "nolive" ] && echo "window.NO_LIVE = true;"
  cat src/data.js src/coffee.js src/core.js src/vendor/qrcode.js src/mq.js src/live.js src/lesson.js src/game.js src/boot.js
  echo "</script>"
}
presenter() {
  echo '<!doctype html>'
  echo '<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
  common_head
  echo '</head><body>'
  cat src/body.html
  scripts
  echo '</body></html>'
}
phone() {
  echo '<!doctype html>'
  echo '<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
  echo '<title>Урок «Деньги и их функции»: голосование</title>'
  echo '<meta name="theme-color" content="#136447">'
  echo "$FONTS"
  echo "<style>"; cat src/phone.css src/coffee.css; echo "</style>"
  echo '</head><body>'
  cat src/phone.html
  echo "<script>"; cat src/mq.js src/coffee.js src/phone.js; echo "</script>"
  echo '</body></html>'
}

mkdir -p docs
presenter > docs/index.html
cp docs/index.html urok-dengi.html
phone > docs/p.html
touch docs/.nojekyll

if [ -n "$1" ]; then
  { common_head; cat src/body.html; scripts nolive; } > "$1"
fi
echo "built: docs/index.html $(wc -c < docs/index.html) B, docs/p.html $(wc -c < docs/p.html) B"
