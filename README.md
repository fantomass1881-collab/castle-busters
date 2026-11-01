# Castle Busters — игра + Telegram-бот

Игра «Castle Busters»: замки на ножках, герои, турниры, ежедневные призы,
наборы прокачки, режимы 1-на-1 и совместные с открытием по уровням.

## Что внутри

- `index.html` — вся игра одним файлом (графика, бой, меню, магазин, турниры)
- `telegram-bot/bot.py` — игровой Telegram-бот (ежедневная награда, турнир,
  магазин через Telegram Stars, кнопка «Играть» открывает игру как WebApp)

## Быстрый запуск игры

Просто открой `index.html` в браузере — работает без установки.

## Запуск игрового бота

1. Создай бота у [@BotFather](https://t.me/BotFather): команда `/newbot`, получишь токен.
2. Установка (нужен Python 3.10+):

```bash
cd telegram-bot
pip install -r requirements.txt
cp .env.example .env
```

3. Открой `.env` и вставь токен:

```
GAME_BOT_TOKEN=1234567890:AAA...ваш_токен
GAME_WEBAPP_URL=https://ваш-логин.github.io/castle-busters
```

4. Запуск:

```bash
python bot.py
```

Бот работает, пока запущен скрипт. Для постоянной работы нужен сервер
(любой VPS, Railway, Render, PythonAnywhere — бесплатно на старт).

## Как выложить на GitHub

```bash
git init
git add .
git commit -m "Castle Busters: игра и Telegram-бот"
git branch -M main
git remote add origin https://github.com/ВАШ_ЛОГИН/castle-busters.git
git push -u origin main
```

Файл `.env` добавлен в `.gitignore` — токен в репозиторий не попадёт.
Никогда не публикуй токен и не отправляй его в чаты.

## Включение игры как WebApp

1. Выложи репозиторий на GitHub Pages: Settings → Pages → ветка main.
2. Игра будет доступна по ссылке `https://ВАШ_ЛОГИН.github.io/castle-busters/`.
3. Эту ссылку вставь в `GAME_WEBAPP_URL` в `.env`.
4. В BotFather: `/setmenubutton` → выбрать бота → указать ту же ссылку.

## Покупки алмазов

Внутри Telegram покупки цифровых товаров проходят через Telegram Stars
(валюта `XTR`). В коде уже есть: выставление счёта, проверка предоплаты,
зачисление алмазов и защита от повторного начисления одного заказа.
Тестировать оплату Stars можно на своём аккаунте.

## Дальше по плану

- Перенос прогресса игры в базу бота (сейчас — локальное сохранение в браузере)
- Онлайн-бои между двумя игроками (нужен сервер с WebSocket)
- Сезонные турниры с наградами в алмазах
