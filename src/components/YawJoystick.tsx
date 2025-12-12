import { useCallback, useEffect, useRef } from 'react';

const DEFAULT_MAX_YAW_RATE = 1; // rad/s
const TRACK_HEIGHT = 48;
const KNOB_SIZE = 34;

type YawJoystickProps = {
  onChange: (w: number) => void;
};

export function YawJoystick({ onChange }: YawJoystickProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const knobRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef(false);
  const posRef = useRef(0); // -1 to 1
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const reset = useCallback(() => {
    activeRef.current = false;
    posRef.current = 0;
    if (knobRef.current) {
      knobRef.current.style.transition = 'left 120ms ease';
      knobRef.current.style.left = '50%';
    }
    onChangeRef.current(0);
  }, []);

  const handlePointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    if (!track) return;

    const rect = track.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const normalized = Math.max(
      -1,
      Math.min(1, (offsetX - rect.width / 2) / (rect.width / 2)),
    );

    posRef.current = normalized;
    if (knobRef.current) {
      knobRef.current.style.left = `${(normalized + 1) * 50}%`;
    }
    onChangeRef.current(normalized * DEFAULT_MAX_YAW_RATE * -1);
  };

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  return (
    <div className="flex items-center justify-center">
      <div
        ref={trackRef}
        className="relative w-full touch-none select-none rounded-full border border-white/10 bg-slate-800 px-4"
        style={{ height: TRACK_HEIGHT }}
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
          className="pointer-events-none absolute top-1/2 rounded-full bg-amber-400/30"
          style={{
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: KNOB_SIZE,
            height: KNOB_SIZE,
            boxShadow: '0 0 0 1px rgba(251,191,36,0.8)',
            transition: 'left 120ms ease',
          }}
        />
      </div>
    </div>
  );
}
