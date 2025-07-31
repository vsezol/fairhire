import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserActivity } from '../services/supabase';

interface MouseTrackerProps {
  activities: UserActivity[];
}

interface MouseEvent {
  x: number;
  y: number;
  timestamp: number;
  type: 'move' | 'left_click' | 'right_click';
}

export const MouseTracker: React.FC<MouseTrackerProps> = ({ activities }) => {
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
          activity.event_data.x &&
          activity.event_data.y
        ) {
          mouseEvents.push({
            x: activity.event_data.x,
            y: activity.event_data.y,
            timestamp: activity.timestamp,
            type: 'move',
          });
        } else if (
          activity.event_type === 'mouse_click' &&
          activity.event_data.x &&
          activity.event_data.y
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

      if (mouseEvents.length === 0) {
        setIsDrawing(false);
        return;
      }

      // Sort by timestamp
      mouseEvents.sort((a, b) => a.timestamp - b.timestamp);

      // Calculate canvas dimensions and scaling
      const maxX = Math.max(...mouseEvents.map((e) => e.x));
      const maxY = Math.max(...mouseEvents.map((e) => e.y));
      const minX = Math.min(...mouseEvents.map((e) => e.x));
      const minY = Math.min(...mouseEvents.map((e) => e.y));

      const scaleX = canvas.width / (maxX - minX + 100);
      const scaleY = canvas.height / (maxY - minY + 100);
      const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down

      // Draw movement path
      const moveEvents = mouseEvents.filter((e) => e.type === 'move');
      if (moveEvents.length > 1) {
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)'; // blue with opacity
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        moveEvents.forEach((event, index) => {
          const x = (event.x - minX + 50) * scale;
          const y = (event.y - minY + 50) * scale;

          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.stroke();
      }

      // Draw clicks
      const clickEvents = mouseEvents.filter((e) => e.type !== 'move');
      clickEvents.forEach((event) => {
        const x = (event.x - minX + 50) * scale;
        const y = (event.y - minY + 50) * scale;

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
  }, [activities]);

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

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">{t('mouseTracking.title')}</h3>
          {isDrawing && (
            <div className="flex items-center gap-2 text-sm text-base-content/60">
              <span className="loading loading-spinner loading-sm"></span>
              <span>Перерисовка...</span>
            </div>
          )}
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
        </div>
      </div>
      <div
        className={`bg-base-200 rounded-lg p-4 transition-opacity ${
          isDrawing ? 'opacity-75' : 'opacity-100'
        }`}
      >
        <canvas
          ref={canvasRef}
          width={800}
          height={400}
          className="w-full h-auto max-w-full border border-base-300 rounded bg-transparent"
          style={{ aspectRatio: '2/1' }}
        />
      </div>
    </div>
  );
};
