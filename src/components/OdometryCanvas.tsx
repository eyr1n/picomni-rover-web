import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import type { Odometry } from '../types';

export type OdometryCanvasHandle = {
  push: (odometry: Odometry) => void;
  clear: () => void;
};

export const OdometryCanvas = forwardRef<OdometryCanvasHandle>((_, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const historyRef = useRef<Odometry[]>([]);
  const rafRef = useRef<number | null>(null);
  const rafScheduledRef = useRef(false);

  const draw = useCallback(() => {
    rafRef.current = null;
    rafScheduledRef.current = false;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const rect = canvas.getBoundingClientRect();

    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    const { width, height } = canvas;
    context.clearRect(0, 0, width, height);

    // Background
    context.fillStyle = '#0f172a';
    context.fillRect(0, 0, width, height);

    // Axes
    context.strokeStyle = '#1f2937';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(width / 2, 0);
    context.lineTo(width / 2, height);
    context.moveTo(0, height / 2);
    context.lineTo(width, height / 2);
    context.stroke();

    const drawArrow = (
      fromX: number,
      fromY: number,
      toX: number,
      toY: number,
      label: string,
      labelOffsetX: number,
      labelOffsetY: number,
    ) => {
      const headLength = 8;
      const dx = toX - fromX;
      const dy = toY - fromY;
      const angle = Math.atan2(dy, dx);
      context.strokeStyle = '#94a3b8';
      context.fillStyle = '#94a3b8';
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(fromX, fromY);
      context.lineTo(toX, toY);
      context.lineTo(
        toX - headLength * Math.cos(angle - Math.PI / 6),
        toY - headLength * Math.sin(angle - Math.PI / 6),
      );
      context.moveTo(toX, toY);
      context.lineTo(
        toX - headLength * Math.cos(angle + Math.PI / 6),
        toY - headLength * Math.sin(angle + Math.PI / 6),
      );
      context.stroke();
      context.font = '12px monospace';
      context.fillText(label, toX + labelOffsetX, toY + labelOffsetY);
    };

    const legendArrowLength = 80;
    const center = { x: width / 2, y: height / 2 };
    drawArrow(
      center.x,
      center.y,
      center.x + legendArrowLength,
      center.y,
      '+x',
      8,
      16,
    );
    drawArrow(
      center.x,
      center.y,
      center.x,
      center.y - legendArrowLength,
      '+y',
      6,
      -10,
    );

    const scale = 50; // 1m -> 50px
    const toScreen = (point: { x: number; y: number }) => ({
      // +x right, +y up
      x: width / 2 + point.x * scale,
      y: height / 2 - point.y * scale,
    });

    const path = historyRef.current;

    if (path.length > 1) {
      context.strokeStyle = '#38bdf8';
      context.lineWidth = 2;
      context.beginPath();
      const first = toScreen(path[0]);
      context.moveTo(first.x, first.y);
      for (let i = 1; i < path.length; i += 1) {
        const point = toScreen(path[i]);
        context.lineTo(point.x, point.y);
      }
      context.stroke();
    }

    const latest = path[path.length - 1];
    const pos = latest ? toScreen(latest) : { x: width / 2, y: height / 2 };

    if (latest) {
      const heading = latest.yaw + Math.PI / 2; // yaw=0 faces up
      const arrowLength = 24;
      const wingLength = 12;

      const worldToScreen = (dx: number, dy: number, len: number) => ({
        x: dx * len,
        y: -dy * len,
      });

      const frontDir = worldToScreen(
        Math.cos(heading),
        Math.sin(heading),
        arrowLength,
      );
      const leftDir = worldToScreen(
        Math.cos(heading + Math.PI * 0.75),
        Math.sin(heading + Math.PI * 0.75),
        wingLength,
      );
      const rightDir = worldToScreen(
        Math.cos(heading - Math.PI * 0.75),
        Math.sin(heading - Math.PI * 0.75),
        wingLength,
      );

      const front = { x: pos.x + frontDir.x, y: pos.y + frontDir.y };
      const left = { x: pos.x + leftDir.x, y: pos.y + leftDir.y };
      const right = { x: pos.x + rightDir.x, y: pos.y + rightDir.y };

      context.fillStyle = '#22c55e';
      context.beginPath();
      context.moveTo(front.x, front.y);
      context.lineTo(left.x, left.y);
      context.lineTo(right.x, right.y);
      context.closePath();
      context.fill();

      context.fillStyle = '#e2e8f0';
      context.font = '12px monospace';
      context.fillText(
        `x:${latest.x.toFixed(2)} y:${latest.y.toFixed(2)} yaw:${latest.yaw.toFixed(2)}`,
        pos.x + 10,
        pos.y - 14,
      );
    }
  }, []);

  const scheduleDraw = useCallback(() => {
    if (!rafScheduledRef.current) {
      rafScheduledRef.current = true;
      rafRef.current = window.requestAnimationFrame(draw);
    }
  }, [draw]);

  useEffect(() => {
    scheduleDraw();
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        rafScheduledRef.current = false;
      }
    };
  }, [scheduleDraw]);

  useImperativeHandle(
    ref,
    () => ({
      push: (odometry: Odometry) => {
        historyRef.current.push(odometry);
        if (historyRef.current.length > 400) {
          historyRef.current.shift();
        }
        scheduleDraw();
      },
      clear: () => {
        historyRef.current = [];
        scheduleDraw();
      },
    }),
    [scheduleDraw],
  );

  return (
    <canvas
      ref={canvasRef}
      className="h-64 w-full"
      aria-label="Odometry visualization"
    />
  );
});
