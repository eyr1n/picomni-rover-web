import { useEffect, useRef, useState } from 'react';
import {
  OdometryCanvas,
  type OdometryCanvasHandle,
} from './components/OdometryCanvas';
import { VelocityJoystick } from './components/VelocityJoystick';
import { YawJoystick } from './components/YawJoystick';
import { BluetoothService } from './services/bluetoothService';
import type { Command, Odometry } from './types';

function decodeOdometry(view: DataView): Odometry {
  if (view.byteLength < 12) {
    throw new Error('Notification payload shorter than 12 bytes.');
  }

  return {
    x: view.getFloat32(0, true),
    y: view.getFloat32(4, true),
    yaw: view.getFloat32(8, true),
  };
}

function isUserCancelledError(error: unknown) {
  const message = (error as Error).message?.toLowerCase?.() ?? '';
  const name = (error as DOMException).name?.toLowerCase?.() ?? '';
  return (
    message.includes('user cancelled') ||
    message.includes('user canceled') ||
    message.includes('usercancelled') ||
    message.includes('usercanceled') ||
    (name === 'notfounderror' && message.includes('cancelled'))
  );
}

export function App() {
  const [command, setCommand] = useState<Command>({
    vx: 0,
    vy: 0,
    w: 0,
    a: false,
    b: false,
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const userDisconnectRef = useRef(false);

  const bleServiceRef = useRef<BluetoothService>(new BluetoothService());
  const commandRef = useRef<Command>({
    vx: 0,
    vy: 0,
    w: 0,
    a: false,
    b: false,
  });
  const odometryCanvasRef = useRef<OdometryCanvasHandle | null>(null);

  const setCommandVelocities = (vx: number, vy: number) => {
    setCommand((prev) => {
      if (prev.vx === vx && prev.vy === vy) return prev;
      const next = { ...prev, vx, vy };
      commandRef.current = next;
      return next;
    });
  };
  const setCommandYaw = (w: number) => {
    setCommand((prev) => {
      if (prev.w === w) return prev;
      const next = { ...prev, w };
      commandRef.current = next;
      return next;
    });
  };

  const setButtonA = (pressed: boolean) => {
    setCommand((prev) => {
      if (prev.a === pressed) return prev;
      const next = { ...prev, a: pressed };
      commandRef.current = next;
      return next;
    });
  };

  const setButtonB = (pressed: boolean) => {
    setCommand((prev) => {
      if (prev.b === pressed) return prev;
      const next = { ...prev, b: pressed };
      commandRef.current = next;
      return next;
    });
  };

  const clearOdometry = () => {
    odometryCanvasRef.current?.clear();
  };

  const handleDisconnected = () => {
    bleServiceRef.current.stopCommandLoop();
    setIsConnected(false);
    clearOdometry();
    if (!userDisconnectRef.current) {
      window.alert('予期せず切断されました。');
    }
    userDisconnectRef.current = false;
  };

  const disconnectDevice = async () => {
    userDisconnectRef.current = true;
    setIsDisconnecting(true);
    bleServiceRef.current.stopCommandLoop();
    await bleServiceRef.current.disconnect();
    setIsConnected(false);
    setIsDisconnecting(false);
    userDisconnectRef.current = false;
  };

  useEffect(() => {
    commandRef.current = command;
  }, [command]);

  const showError = (message: string) => {
    window.alert(message);
  };

  const connect = async () => {
    if (isConnecting || isDisconnecting) return;
    if (!navigator.bluetooth) {
      showError('このブラウザではWeb Bluetoothが利用できません。');
      return;
    }

    userDisconnectRef.current = false;
    bleServiceRef.current.stopCommandLoop();
    setIsConnecting(true);

    try {
      await bleServiceRef.current.connect({
        onNotify: (value) => {
          try {
            const odometry = decodeOdometry(value);
            odometryCanvasRef.current?.push(odometry);
          } catch (decodeError) {
            showError((decodeError as Error).message);
          }
        },
        onDisconnect: handleDisconnected,
      });

      setIsConnected(true);
      await startWriteLoop();
    } catch (connectError) {
      console.error(connectError);
      if (!isUserCancelledError(connectError)) {
        showError((connectError as Error).message);
        setIsConnected(false);
        await disconnectDevice();
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const startWriteLoop = () => {
    if (isDisconnecting || isConnecting) return;
    bleServiceRef.current.stopCommandLoop();
    bleServiceRef.current.startCommandLoop(
      () => commandRef.current,
      (message) => showError(message),
      50,
    );
  };

  const connectionBusy = isConnecting || isDisconnecting;
  const buttonLabel = isConnecting
    ? '接続中...'
    : isDisconnecting
      ? '切断中...'
      : isConnected
        ? '切断'
        : '接続';

  return (
    <div>
      <div className="mx-auto max-w-md space-y-3 px-4 py-6">
        <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/80">
          <OdometryCanvas ref={odometryCanvasRef} command={command} />
        </div>

        <YawJoystick onChange={setCommandYaw} />
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0">
            <VelocityJoystick onChange={setCommandVelocities} />
          </div>
          <div className="flex-1 self-stretch flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                if (isConnected) {
                  void disconnectDevice();
                } else {
                  void connect();
                }
              }}
              disabled={connectionBusy}
              className={`w-full rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                isConnected
                  ? 'bg-rose-500 text-rose-950 hover:bg-rose-400'
                  : 'bg-emerald-500 text-emerald-950 hover:bg-emerald-400'
              }`}
            >
              {buttonLabel}
            </button>
            <div className="grid grid-cols-2 gap-2 flex-1">
              <button
                type="button"
                onPointerDown={() => setButtonA(true)}
                onPointerUp={() => setButtonA(false)}
                onPointerLeave={() => setButtonA(false)}
                className={`rounded-lg py-2 font-bold transition select-none flex items-center justify-center text-xl ${
                  command.a
                    ? 'bg-red-600 text-white scale-95 shadow-inner'
                    : 'bg-red-500/20 text-red-400 hover:bg-red-500/30 shadow-sm border border-red-500/40'
                }`}
              >
                A
              </button>
              <button
                type="button"
                onPointerDown={() => setButtonB(true)}
                onPointerUp={() => setButtonB(false)}
                onPointerLeave={() => setButtonB(false)}
                className={`rounded-lg py-2 font-bold transition select-none flex items-center justify-center text-xl ${
                  command.b
                    ? 'bg-blue-600 text-white scale-95 shadow-inner'
                    : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 shadow-sm border border-blue-500/40'
                }`}
              >
                B
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
