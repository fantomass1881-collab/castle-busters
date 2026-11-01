// Интеграция с Telegram Mini App: разворачиваем на весь экран, подстраиваем цвета.
(function () {
  if (!window.Telegram || !window.Telegram.WebApp) return;
  const webApp = window.Telegram.WebApp;
  try {
    webApp.ready && webApp.ready();
    webApp.expand && webApp.expand();
    if (webApp.disableVerticalSwipes) webApp.disableVerticalSwipes();
    if (webApp.setHeaderColor) webApp.setHeaderColor('#0b0716');
    if (webApp.setBackgroundColor) webApp.setBackgroundColor('#0b0716');
    if (webApp.MainButton) webApp.MainButton.hide();
    // Отправка результата матча боту (закрывает Mini App — вызывать только по желанию игрока)
    window.sendMatchResultToBot = function (result) {
      try { webApp.sendData(JSON.stringify(result)); } catch (e) { console.warn('Failed to send data to bot', e); }
    };
  } catch (e) { console.warn('Telegram WebApp integration error', e); }
})();
