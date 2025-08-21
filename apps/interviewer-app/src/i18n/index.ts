import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      urlInput: {
        placeholder: 'Enter call URL',
        button: 'Check Sessions',
        loading: 'Loading...',
      },
      sessions: {
        title: 'Sessions',
        active: 'Active',
        lastActive: 'Last active',
        noSessions: 'No sessions found for this URL',
        error: 'Error loading sessions',
        platform: 'Platform',
        version: 'Version',
      },
      activities: {
        title: 'Session Activities',
        noActivities: 'No activities found',
        suspicious: 'Suspicious Event',
        events: {
          app_focus: 'App gained focus',
          app_blur: 'App lost focus',
          app_show: 'App shown',
          app_hide: 'App hidden',
          app_open: 'App opened',
          app_close: 'App closed',
          key_down: 'Keyboard',
          mouse_click: 'Mouse clicked',
          window_resize: 'Window resized',
          screenshot_attempt: 'Screenshot attempt',
          process_start: 'Open {{name}}',
          process_end: 'Close {{name}}',
        },
      },
      mouseTracking: {
        title: 'Mouse Movement & Clicks',
        leftClick: 'Left Click',
        rightClick: 'Right Click',
        movement: 'Movement Path',
        noData: 'No mouse tracking data available',
      },
      runningApps: {
        total: 'Total:',
        title: 'Running Applications',
        suspiciousDetected: 'Suspicious detected',
        noApplications: 'No applications detected',
        appsCount: 'apps',
        errorLoading: 'Error loading applications',
      },
    },
  },
  ru: {
    translation: {
      urlInput: {
        placeholder: 'Введите ссылку на звонок',
        button: 'Проверить сессии',
        loading: 'Загрузка...',
      },
      sessions: {
        title: 'Сессии',
        active: 'Онлайн',
        lastActive: 'Оффлайн',
        noSessions: 'Сессии для данной ссылки не найдены',
        error: 'Ошибка при загрузке сессий',
        platform: 'Платформа',
        version: 'Версия',
        lastActiveDate: 'Последняя активность',
      },
      activities: {
        title: 'Активность сессии',
        noActivities: 'Активность не найдена',
        events: {
          app_focus: 'Приложение получило фокус',
          app_blur: 'Приложение потеряло фокус',
          app_show: 'Приложение показано',
          app_hide: 'Приложение скрыто',
          app_open: 'Приложение запущено',
          app_close: 'Приложение закрыто',
          key_down: 'Клавиатура',
          mouse_click: 'Клик мыши',
          window_resize: 'Изменен размер окна',
          screenshot_attempt: 'Попытка скриншота',
          process_start: 'Открытие {{name}}',
          process_end: 'Закрытие {{name}}',
        },
      },
      mouseTracking: {
        title: 'Главный экран',
        monitors: 'Всего мониторов: ',
        leftClick: 'Левый клик',
        rightClick: 'Правый клик',
        movement: 'Путь движения',
        noData: 'Нет данных о движении мыши',
      },
      runningApps: {
        total: 'Всего:',
        title: 'Запущенные приложения',
        suspiciousDetected: 'Обнаружены подозрительные',
        noApplications: 'Приложения не обнаружены',
        appsCount: 'приложений',
        errorLoading: 'Ошибка загрузки приложений',
      },
    },
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'ru', // default language
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
