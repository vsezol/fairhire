import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserActivity, Session } from '../services/supabase';

interface MouseTrackerProps {
  activities: UserActivity[];
  session?: Session;
}

interface MouseEvent {
  x: number;
  y: number;
  timestamp: number;
  type: 'move' | 'left_click' | 'right_click';
}

export const MouseTracker: React.FC<MouseTrackerProps> = ({
  activities,
  session,
}) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);

    // Small delay to show the drawing animation
    const drawTimeout = setTimeout(() => {
      // Extract mouse events
      const mouseEvents: MouseEvent[] = [];

      activities.forEach((activity) => {
        if (
          activity.event_type === 'mouse_move' &&
          activity.event_data &&
          typeof activity.event_data === 'object' &&
          'x' in activity.event_data &&
          'y' in activity.event_data &&
          typeof activity.event_data.x === 'number' &&
          typeof activity.event_data.y === 'number'
        ) {
          mouseEvents.push({
            x: activity.event_data.x,
            y: activity.event_data.y,
            timestamp: activity.timestamp,
            type: 'move',
          });
        } else if (
          activity.event_type === 'mouse_click' &&
          activity.event_data &&
          typeof activity.event_data === 'object' &&
          'x' in activity.event_data &&
          'y' in activity.event_data &&
          'button' in activity.event_data &&
          typeof activity.event_data.x === 'number' &&
          typeof activity.event_data.y === 'number'
        ) {
          mouseEvents.push({
            x: activity.event_data.x,
            y: activity.event_data.y,
            timestamp: activity.timestamp,
            type:
              activity.event_data.button === 'left'
                ? 'left_click'
                : 'right_click',
          });
        }
      });

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Получаем геометрию сессии
      const sessionGeometry =
        session &&
        session.screen_width &&
        session.screen_height &&
        session.window_width &&
        session.window_height
          ? {
              screen: {
                width: session.screen_width,
                height: session.screen_height,
                scaleFactor: session.screen_scale_factor || 1,
              },
              window: {
                x: session.window_x || 0,
                y: session.window_y || 0,
                width: session.window_width,
                height: session.window_height,
                isVisible: session.window_is_visible ?? true,
                isFocused: session.window_is_focused ?? true,
              },
            }
          : null;

      // Canvas представляет экран пользователя
      // Масштабируем координаты относительно размеров canvas
      let scaleX = 1;
      let scaleY = 1;
      let offsetX = 0;
      let offsetY = 0;

      if (sessionGeometry) {
        // Есть данные о геометрии - используем их
        scaleX = canvas.width / sessionGeometry.screen.width;
        scaleY = canvas.height / sessionGeometry.screen.height;

        // Рисуем окно приложения относительно canvas (который представляет экран)
        const windowX = sessionGeometry.window.x * scaleX;
        const windowY = sessionGeometry.window.y * scaleY;
        const windowWidth = sessionGeometry.window.width * scaleX;
        const windowHeight = sessionGeometry.window.height * scaleY;

        // Разные цвета в зависимости от статуса окна
        if (!sessionGeometry.window.isVisible) {
          // Скрытое окно - серый пунктир
          ctx.fillStyle = 'rgba(128, 128, 128, 0.1)';
          ctx.fillRect(windowX, windowY, windowWidth, windowHeight);

          ctx.strokeStyle = 'rgba(128, 128, 128, 0.6)';
          ctx.lineWidth = 2;
          ctx.setLineDash([10, 5]);
          ctx.strokeRect(windowX, windowY, windowWidth, windowHeight);

          ctx.fillStyle = 'rgba(128, 128, 128, 0.8)';
          ctx.font = '14px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(
            'Hidden Window',
            windowX + windowWidth / 2,
            windowY + windowHeight / 2
          );
        } else {
          // Видимое окно - зеленый
          ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
          ctx.fillRect(windowX, windowY, windowWidth, windowHeight);

          ctx.strokeStyle = 'rgba(34, 197, 94, 0.8)';
          ctx.lineWidth = 2;
          ctx.setLineDash([]);
          ctx.strokeRect(windowX, windowY, windowWidth, windowHeight);

          ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
          ctx.font = '14px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(
            'App Window',
            windowX + windowWidth / 2,
            windowY + windowHeight / 2
          );
        }
      } else if (mouseEvents.length > 0) {
        // Fallback: масштабируем по координатам мыши если нет данных о геометрии
        const maxX = Math.max(...mouseEvents.map((e) => e.x));
        const maxY = Math.max(...mouseEvents.map((e) => e.y));
        const minX = Math.min(...mouseEvents.map((e) => e.x));
        const minY = Math.min(...mouseEvents.map((e) => e.y));

        const rangeX = maxX - minX + 100; // добавляем отступы
        const rangeY = maxY - minY + 100;

        scaleX = (canvas.width - 100) / rangeX;
        scaleY = (canvas.height - 100) / rangeY;
        const scale = Math.min(scaleX, scaleY, 1); // не увеличиваем, только уменьшаем

        scaleX = scale;
        scaleY = scale;
        offsetX = 50 - minX * scale;
        offsetY = 50 - minY * scale;
      }

      if (mouseEvents.length === 0) {
        setIsDrawing(false);
        return;
      }

      // Sort by timestamp
      mouseEvents.sort((a, b) => a.timestamp - b.timestamp);

      // Draw movement path
      const moveEvents = mouseEvents.filter((e) => e.type === 'move');
      if (moveEvents.length > 1) {
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)'; // blue with opacity
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([]);

        ctx.beginPath();
        moveEvents.forEach((event, index) => {
          let x, y;
          if (sessionGeometry) {
            // Mouse move события - это глобальные координаты экрана
            x = event.x * scaleX;
            y = event.y * scaleY;
          } else {
            // Fallback случай - масштабирование + смещение
            x = event.x * scaleX + offsetX;
            y = event.y * scaleY + offsetY;
          }

          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.stroke();
      }

      // Draw clicks - клики относительно окна приложения
      const clickEvents = mouseEvents.filter((e) => e.type !== 'move');
      clickEvents.forEach((event) => {
        let x, y;
        if (sessionGeometry) {
          // Клики приходят с координатами относительно окна браузера (clientX, clientY)
          // Нужно их позиционировать внутри прямоугольника окна на canvas
          const windowX = sessionGeometry.window.x * scaleX;
          const windowY = sessionGeometry.window.y * scaleY;

          // Масштабируем клик относительно размеров окна на canvas
          const windowCanvasWidth = sessionGeometry.window.width * scaleX;
          const windowCanvasHeight = sessionGeometry.window.height * scaleY;

          x =
            windowX +
            (event.x / sessionGeometry.window.width) * windowCanvasWidth;
          y =
            windowY +
            (event.y / sessionGeometry.window.height) * windowCanvasHeight;
        } else {
          // Fallback случай - масштабирование + смещение
          x = event.x * scaleX + offsetX;
          y = event.y * scaleY + offsetY;
        }

        ctx.beginPath();
        ctx.arc(x, y, 8, 0, 2 * Math.PI);

        if (event.type === 'left_click') {
          ctx.fillStyle = 'rgba(34, 197, 94, 0.7)'; // green for left click
        } else {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.7)'; // red for right click
        }

        ctx.fill();

        // Add border
        ctx.strokeStyle = event.type === 'left_click' ? '#22c55e' : '#ef4444';
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      setIsDrawing(false);
    }, 200);

    return () => {
      clearTimeout(drawTimeout);
      setIsDrawing(false);
    };
  }, [activities, session]);

  const mouseActivities = activities.filter(
    (activity) =>
      activity.event_type === 'mouse_move' ||
      activity.event_type === 'mouse_click'
  );

  if (mouseActivities.length === 0) {
    return (
      <div className="text-center py-8 text-base-content/60">
        {t('mouseTracking.noData')}
      </div>
    );
  }

  // Определяем размеры canvas на основе геометрии экрана
  const sessionGeometry =
    session && session.screen_width && session.screen_height
      ? {
          width: session.screen_width,
          height: session.screen_height,
        }
      : { width: 1920, height: 1080 }; // Fallback

  // Вычисляем пропорции экрана
  const aspectRatio = sessionGeometry.width / sessionGeometry.height;
  const canvasWidth = 800;
  const canvasHeight = Math.round(canvasWidth / aspectRatio);

  // Получаем статус окна
  const windowStatus = session
    ? {
        isVisible: session.window_is_visible ?? true,
        isFocused: session.window_is_focused ?? true,
      }
    : { isVisible: true, isFocused: false };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">{t('mouseTracking.title')}</h3>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded-full opacity-70"></div>
            <span>{t('mouseTracking.leftClick')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded-full opacity-70"></div>
            <span>{t('mouseTracking.rightClick')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-blue-500 opacity-60"></div>
            <span>{t('mouseTracking.movement')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-green-500 bg-green-100 opacity-70"></div>
            <span>Visible Window</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 border-2 border-gray-500 bg-gray-100 opacity-70"
              style={{ borderStyle: 'dashed' }}
            ></div>
            <span>Hidden</span>
          </div>
        </div>
      </div>
      <div className="text-sm text-base-content/60 mb-2">
        Screen: {sessionGeometry.width} × {sessionGeometry.height}px
        {session?.window_width && session?.window_height && (
          <span className="ml-4">
            Window: {session.window_width} × {session.window_height}px at (
            {session.window_x || 0}, {session.window_y || 0})
          </span>
        )}
      </div>
      <div
        className={`bg-base-200 rounded-lg p-4 transition-opacity ${
          isDrawing ? 'opacity-75' : 'opacity-100'
        }`}
      >
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          className={`w-full h-auto max-w-full rounded ${
            !windowStatus.isVisible ? 'bg-gray-700' : 'bg-gray-900'
          }`}
          style={{
            aspectRatio: `${sessionGeometry.width}/${sessionGeometry.height}`,
          }}
        />
        {!windowStatus.isVisible && (
          <div className="text-center mt-2 text-sm text-orange-400">
            ⚠️ Application window was hidden during this session
          </div>
        )}
      </div>
    </div>
  );
};
