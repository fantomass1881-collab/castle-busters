# -*- coding: utf-8 -*-
"""
Castle Busters — игровой Telegram-бот.
Меню: Играть (WebApp), Ежедневная награда, Турнир, Магазин.
Покупки алмазов — через Telegram Stars (валюта XTR).
"""

import asyncio
import logging
import os
import sqlite3
import time
from datetime import date, datetime, timedelta

from aiogram import Bot, Dispatcher, F, Router
from aiogram.filters import Command, CommandStart
from aiogram.types import (
    LabeledPrice,
    Message,
    PreCheckoutQuery,
    ReplyKeyboardMarkup,
    KeyboardButton,
    WebAppInfo,
    CallbackQuery,
)
from aiogram.utils.keyboard import InlineKeyboardBuilder
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("GAME_BOT_TOKEN", "")
WEBAPP_URL = os.getenv("GAME_WEBAPP_URL", "")  # ссылка на index.html игры
DB_PATH = os.getenv("DB_PATH", "game.db")

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("castle-busters")

# ---------------- Магазин: каталог покупок через Stars ----------------
# Цены в XTR (Telegram Stars). Алмазы начисляются на аккаунт игрока.
SHOP_ITEMS = {
    "dia_mini":   {"title": "Мини-набор алмазов",     "desc": "40 алмазов",        "dia": 40,  "stars": 25},
    "dia_start":  {"title": "Стартовый набор",        "desc": "80 алмазов + сундук", "dia": 80,  "stars": 50},
    "dia_big":    {"title": "Большой набор алмазов",  "desc": "250 алмазов",        "dia": 250, "stars": 150},
    "hero_pack":  {"title": "Набор прокачки героев",  "desc": "120 алмазов",        "dia": 120, "stars": 75},
    "def_pack":   {"title": "Набор защиты",          "desc": "120 алмазов",        "dia": 120, "stars": 75},
    "castle_pack": {"title": "Набор развития замка",  "desc": "150 алмазов",        "dia": 150, "stars": 90},
}

DAILY_REWARDS = [
    "200 золота", "Материалы героев", "Материалы замка",
    "Обычный сундук", "30 алмазов", "Сундук защиты", "Большой сундук",
]

TOUR_BOTS = ["Лорд Кай", "Огненная Ада", "Бартоломео", "Стальная Вильма",
             "Гарт Топор", "Мирабелла", "Каменный Джо", "Астрид"]

# ---------------- База данных ----------------

def db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with db() as c:
        c.execute("""CREATE TABLE IF NOT EXISTS players (
            user_id INTEGER PRIMARY KEY,
            name TEXT, diamonds INTEGER DEFAULT 0,
            week TEXT, tour_points INTEGER DEFAULT 0,
            daily_last TEXT, daily_streak INTEGER DEFAULT 0)""")
        c.execute("""CREATE TABLE IF NOT EXISTS payments (
            charge_id TEXT PRIMARY KEY, user_id INTEGER,
            item_id TEXT, paid_at TEXT)""")

def get_player(user_id: int, name: str = "") -> sqlite3.Row:
    with db() as c:
        row = c.execute("SELECT * FROM players WHERE user_id=?", (user_id,)).fetchone()
        if not row:
            week = current_week()
            c.execute("INSERT INTO players (user_id, name, week) VALUES (?,?,?)",
                      (user_id, name, week))
            row = c.execute("SELECT * FROM players WHERE user_id=?", (user_id,)).fetchone()
        return row

def current_week() -> str:
    d = date.today()
    return f"{d.isocalendar()[0]}-W{d.isocalendar()[1]}"

def add_diamonds(user_id: int, amount: int):
    with db() as c:
        c.execute("UPDATE players SET diamonds=diamonds+? WHERE user_id=?", (amount, user_id))

def add_tour_points(user_id: int, amount: int):
    week = current_week()
    with db() as c:
        row = c.execute("SELECT week FROM players WHERE user_id=?", (user_id,)).fetchone()
        if row["week"] != week:
            c.execute("UPDATE players SET week=?, tour_points=0 WHERE user_id=?", (week, user_id))
        c.execute("UPDATE players SET tour_points=tour_points+? WHERE user_id=?", (amount, user_id))

def bot_points() -> list:
    """Имитация активности ботов в турнире (очень простой генератор)."""
    import random
    seed_day = date.today().toordinal()
    rng = random.Random(seed_day)
    return sorted(rng.sample(TOUR_BOTS, len(TOUR_BOTS))[:8])

# ---------------- Клавиатуры ----------------

def main_menu():
    rows = []
    if WEBAPP_URL:
        rows.append([KeyboardButton(text="Играть", web_app=WebAppInfo(url=WEBAPP_URL))])
    else:
        rows.append([KeyboardButton(text="Играть")])
    rows.append([KeyboardButton(text="Ежедневная награда"), KeyboardButton(text="Турнир")])
    rows.append([KeyboardButton(text="Магазин"), KeyboardButton(text="Помощь")])
    return ReplyKeyboardMarkup(keyboard=rows, resize_keyboard=True)

# ---------------- Хендлеры ----------------

router = Router()

@router.message(CommandStart())
async def cmd_start(m: Message):
    get_player(m.from_user.id, m.from_user.full_name)
    await m.answer(
        "Добро пожаловать в Castle Busters! Замки на ножках, герои, турниры и ежедневные призы.\n\n"
        "Нажми «Играть», чтобы открыть игру. Прогресс привязан к твоему аккаунту.",
        reply_markup=main_menu(),
    )

@router.message(F.text == "Играть")
async def play(m: Message):
    get_player(m.from_user.id, m.from_user.full_name)
    if WEBAPP_URL:
        await m.answer("Открываю игру — замки уже разминают ноги.", reply_markup=main_menu())
    else:
        await m.answer(
            "Ссылка на игру ещё не указана.\n"
            "Владельцу бота: задайте GAME_WEBAPP_URL в .env (ссылку на index.html игры).",
            reply_markup=main_menu(),
        )

@router.message(F.text == "Ежедневная награда")
async def daily(m: Message):
    uid = m.from_user.id
    get_player(uid, m.from_user.full_name)
    today = date.today().isoformat()
    with db() as c:
        row = c.execute("SELECT daily_last, daily_streak FROM players WHERE user_id=?", (uid,)).fetchone()
        if row["daily_last"] == today:
            await m.answer("Награда за сегодня уже получена. Возвращайся завтра!")
            return
        yesterday = (date.today() - timedelta(days=1)).isoformat()
        streak = row["daily_streak"] + 1 if row["daily_last"] == yesterday else 1
        reward = DAILY_REWARDS[(streak - 1) % 7]
        if reward == "30 алмазов":
            add_diamonds(uid, 30)
        c.execute("UPDATE players SET daily_last=?, daily_streak=? WHERE user_id=?", (today, streak, uid))
    await m.answer(
        f"Награда дня {streak}: {reward}!\n"
        "Серия дней сохраняется, пропуск дня не отнимает уже полученное."
    )

@router.message(F.text == "Турнир")
async def tournament(m: Message):
    uid = m.from_user.id
    get_player(uid, m.from_user.full_name)
    with db() as c:
        row = c.execute("SELECT week, tour_points FROM players WHERE user_id=?", (uid,)).fetchone()
        week = current_week()
        if row["week"] != week:
            add_tour_points(uid, 0)  # сброс новой недели
            row = {"tour_points": 0}
        you = row["tour_points"]
    bots = bot_points()
    lines = [f"Недельный турнир ({week})", ""]
    table = [(name, 30 + (len(bots) - i) * 7) for i, name in enumerate(bots)]
    table.append(("Ты", you))
    table.sort(key=lambda x: -x[1])
    medals = ["I", "II", "III"]
    for i, (name, pts) in enumerate(table):
        mark = f"{medals[i]}" if i < 3 else str(i + 1)
        lines.append(f"{mark}. {name} — {pts} очков")
    lines += ["", "Победа в рейтинговом бою: +25 очков, в турнирном: +50.",
              "Таблица обновляется каждую неделю."]
    await m.answer("\n".join(lines))

@router.message(F.text == "Магазин")
async def shop(m: Message):
    kb = InlineKeyboardBuilder()
    for item_id, it in SHOP_ITEMS.items():
        kb.button(text=f"{it['title']} — {it['stars']} Stars", callback_data=f"buy:{item_id}")
    kb.adjust(1)
    await m.answer("Наборы покупаются за Telegram Stars. Алмазы зачисляются автоматически:", reply_markup=kb.as_markup())

@router.callback_query(F.data.startswith("buy:"))
async def buy(cb: CallbackQuery, bot: Bot):
    item_id = cb.data.split(":", 1)[1]
    it = SHOP_ITEMS.get(item_id)
    if not it:
        await cb.answer("Набор не найден", show_alert=True)
        return
    await bot.send_invoice(
        chat_id=cb.from_user.id,
        title=it["title"],
        description=it["desc"],
        payload=item_id,
        provider_token="",  # для Stars пустая строка
        currency="XTR",
        prices=[LabeledPrice(label=it["title"], amount=it["stars"])],
    )
    await cb.answer()

@router.pre_checkout_query()
async def pre_checkout(q: PreCheckoutQuery, bot: Bot):
    # Здесь проверяем, что товар существует. Начисление — только после successful_payment.
    ok = q.invoice_payload in SHOP_ITEMS
    await bot.answer_pre_checkout_query(q.id, ok=ok)

@router.message(F.successful_payment)
async def successful_payment(m: Message):
    sp = m.successful_payment
    item_id = sp.invoice_payload
    charge_id = sp.telegram_payment_charge_id
    it = SHOP_ITEMS.get(item_id)
    if not it:
        await m.answer("Покупка не распознана, свяжитесь с поддержкой.")
        return
    with db() as c:
        try:
            c.execute("INSERT INTO payments (charge_id, user_id, item_id, paid_at) VALUES (?,?,?,?)",
                      (charge_id, m.from_user.id, item_id, datetime.utcnow().isoformat()))
        except sqlite3.IntegrityError:
            await m.answer("Эта покупка уже начислена.")
            return
    add_diamonds(m.from_user.id, it["dia"])
    await m.answer(
        f"Оплата получена! Начислено: {it['dia']} алмазов.\n"
        "Спасибо за поддержку Castle Busters."
    )

@router.message(F.text == "Помощь")
async def help_cmd(m: Message):
    await m.answer(
        "Castle Busters — как играть:\n\n"
        "Играть — открыть игру (замок ходит на ножках, стреляй и укрепляйся).\n"
        "Ежедневная награда — цепочка из 7 дней.\n"
        "Турнир — недельная таблица, очки за рейтинговые и турнирные бои.\n"
        "Магазин — наборы за Telegram Stars, алмазы зачисляются автоматически.\n\n"
        "Управление: A/D — движение, W — огонь, S — укрепление. Игрок 2: стрелки."
    )

# ---------------- Запуск ----------------

async def main():
    if not BOT_TOKEN:
        raise SystemExit("Задайте GAME_BOT_TOKEN в .env (токен от @BotFather)")
    init_db()
    bot = Bot(BOT_TOKEN)
    dp = Dispatcher()
    dp.include_router(router)
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
