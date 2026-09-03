// Telegram Web App integration (minimal)
(function(){
  if (!window.Telegram) return;
  const webApp = window.Telegram.WebApp;
  try {
    webApp.expand && webApp.expand();
    console.log('Telegram WebApp initialized', webApp.initDataUnsafe && webApp.initDataUnsafe.user);

    // Hook a MainButton to send results and close
    if (webApp.MainButton) {
      webApp.MainButton.text = 'Return to Telegram';
      webApp.MainButton.show();
      webApp.MainButton.onClick(() => {
        webApp.sendData(JSON.stringify({ type: 'returned', ts: Date.now() }));
        webApp.close();
      });
    }

    // Expose helper to send match result
    window.sendMatchResultToBot = function(result) {
      try {
        webApp.sendData(JSON.stringify(result));
        console.log('Sent match result to bot:', result);
      } catch(e) { console.warn('Failed to send data to bot', e); }
    }
  } catch(e) { console.warn('Telegram WebApp integration error', e); }
})();
