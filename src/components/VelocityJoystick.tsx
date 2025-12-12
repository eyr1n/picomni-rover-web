import { useCallback, useEffect, useRef } from 'react';

const JOYSTICK_SIZE = 152;
const JOYSTICK_RADIUS = JOYSTICK_SIZE / 2 - 12;
const JOYSTICK_KNOB_SIZE = 34;
const DEFAULT_MAX_SPEED = 0.15; // m/s

type VelocityJoystickProps = {
  onChange: (vx: number, vy: number) => void;
};

export function VelocityJoystick({ onChange }: VelocityJoystickProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const knobRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef(false);
  const posRef = useRef({ x: 0, y: 0 });
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const reset = useCallback(() => {
    activeRef.current = false;
    posRef.current = { x: 0, y: 0 };
    if (knobRef.current) {
      knobRef.current.style.transition = 'transform 120ms ease';
      knobRef.current.style.transform = 'translate(-50%, -50%)';
    }
    onChangeRef.current(0, 0);
  }, []);

  const handlePointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const surface = surfaceRef.current;
    if (!surface) return;

    const rect = surface.getBoundingClientRect();
    const offsetX = event.clientX - rect.left - rect.width / 2;
    const offsetY = event.clientY - rect.top - rect.height / 2;
    const distance = Math.hypot(offsetX, offsetY);
    const angle = Math.atan2(offsetY, offsetX);
    const clampedDistance = Math.min(distance, JOYSTICK_RADIUS);
    const clampedX = Math.cos(angle) * clampedDistance;
    const clampedY = Math.sin(angle) * clampedDistance;

    const normalizedX = clampedX / JOYSTICK_RADIUS; // right positive
    const normalizedY = clampedY / JOYSTICK_RADIUS; // down positive

    // +x right, +y up
    const nextVx = normalizedX * DEFAULT_MAX_SPEED;
    const nextVy = -normalizedY * DEFAULT_MAX_SPEED;

    posRef.current = { x: clampedX, y: clampedY };
    if (knobRef.current) {
      knobRef.current.style.transform = `translate(-50%, -50%) translate(${clampedX}px, ${clampedY}px)`;
    }
    onChangeRef.current(nextVx, nextVy);
  };

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  return (
    <div className="flex items-center justify-center">
      <div
        ref={surfaceRef}
        className="relative touch-none select-none rounded-full border border-white/10 bg-slate-800"
        style={{ width: JOYSTICK_SIZE, height: JOYSTICK_SIZE }}
        onPointerDown={(event) => {
          activeRef.current = true;
          if (knobRef.current) {
            knobRef.current.style.transition = 'none';
          }
          (event.currentTarget as HTMLDivElement).setPointerCapture(
            event.pointerId,
          );
          handlePointer(event);
        }}
        onPointerMove={(event) => {
          if (!activeRef.current) return;
          handlePointer(event);
        }}
        onPointerUp={(event) => {
          activeRef.current = false;
          (event.currentTarget as HTMLDivElement).releasePointerCapture(
            event.pointerId,
          );
          reset();
        }}
        onPointerLeave={() => {
          if (activeRef.current) {
            reset();
          }
        }}
        onPointerCancel={() => {
          if (activeRef.current) {
            reset();
          }
        }}
      >
        <div
          ref={knobRef}
          className="pointer-events-none absolute rounded-full bg-cyan-400/20"
          style={{
            width: JOYSTICK_KNOB_SIZE,
            height: JOYSTICK_KNOB_SIZE,
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            transition: 'transform 120ms ease',
            boxShadow: '0 0 0 1px rgba(59,130,246,0.5)',
          }}
        />
      </div>
    </div>
  );
}
