/*
 * Настройки сайта CRM RP — меняй только этот файл.
 * Пустая строка '' = ссылки пока нет, на сайте будет «скоро».
 */
window.CRM_SITE = {
  // прямая ссылка на установщик лаунчера (появится, когда соберём и зальём лаунчер)
  download: 'https://github.com/yolterfamq/crmrp-client/releases/download/launcher/CRM-RP-Launcher-Setup.exe',
  // вес установщика, показывается под кнопкой
  downloadSize: '≈ 100 МБ',
  // сколько весит игра после установки
  gameSize: '≈ 14 ГБ',

  forum: '', // ссылка на форум, когда поднимем его на VPS
  discord: '',
  vk: '',
  telegram: '',
  youtube: '',

  // серверы — только название и статус. IP на сайте НЕ показывается: игроки подключаются через лаунчер.
  // status: 'open' — работает, 'soon' — скоро, 'later' — позже
  servers: [
    { name: 'CRM RP #1', status: 'soon' },
    { name: 'CRM RP #2', status: 'later' },
  ],
};
