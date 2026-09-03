# castle-busters

Castle Busters — Telegram Mini App game

## Запуск локально (для разработки и тестов)
1. Клонируйте репозиторий и перейдите в папку:

   git clone https://github.com/fantomass1881-collab/castle-busters.git
   cd castle-busters

2. Перейдите на ветку с изменениями (feature/units-config-and-respawn):

   git fetch origin
   git checkout feature/units-config-and-respawn

3. Запустите простой статический сервер (нужен для корректной загрузки units.json):

   # Python 3
   python3 -m http.server 8000

   # или Node (если установлен)
   npx http-server -p 8080

4. Откройте в браузере:

   http://localhost:8000/index.html

5. Smoke test (быстрая проверка):
   - Откройте DevTools → Console. Должно появиться сообщение "Units config loaded:" с параметрами юнитов.
   - Нажмите ATTACK / LINE FIRE / ABILITY — поведение сохранено.
   - Повреждение замка видно в HP‑шкалах (player/enemy).
   - При поражении/победе появится prompt с предложением перезапустить.

## Быстрая правка баланса
- Откройте units.json в корне репозитория.
- Измените параметры (damage, cooldown и т.д.) у нужного юнита и сохраните.
- Перезагрузите страницу (F5) и повторите тесты — новые параметры применятся автоматически.

## Скриншоты (assets)
Ветки содержит папку assets/screens/ с метаданными изображений. При наличии оригиналов в полном разрешении, загрузите файлы в assets/screens/image1.png, image2.png, image3.png чтобы превью отображались в README.

## Что было сделано в feature/units-config-and-respawn
- Добавлен units.json (конфигурация юнитов).  
- Обновлён game.js: загрузка units.json и использование параметров для базовой атаки; добавлен Restart handler и prompt при поражении/победе.  
- Подготовлены инструкции для локального теста.

## Чек‑лист для PR ревью
- [ ] units.json корректно загружается (см. консоль).  
- [ ] Поведение ATTACK/LINE FIRE/ABILITY соответствует ожиданиям.  
- [ ] Restart/Respawn работает (reload page).  
- [ ] README содержит инструкции по запуску.
