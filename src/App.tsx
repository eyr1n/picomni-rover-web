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
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const userDisconnectRef = useRef(false);

  const bleServiceRef = useRef<BluetoothService>(new BluetoothService());
  const commandRef = useRef<Command>({ vx: 0, vy: 0, w: 0 });
  const odometryCanvasRef = useRef<OdometryCanvasHandle | null>(null);

  const formatVelocity = (value: number) => {
    return (
      <>
        {value < 0 ? '-' : <>&nbsp;</>}
        {Math.abs(value).toFixed(2)}
      </>
    );
  };

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
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-md space-y-3 px-4 py-6">
        <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/80">
          <OdometryCanvas ref={odometryCanvasRef} />
        </div>

        <YawJoystick onChange={setCommandYaw} />
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0">
            <VelocityJoystick onChange={setCommandVelocities} />
          </div>
          <div className="flex-1 space-y-2">
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
            <div className="rounded-xl border border-white/10 bg-slate-900/60 px-2 py-3 text-xs text-slate-200 flex justify-center">
              <div className="space-y-1 font-mono text-sm">
                <div>vx: {formatVelocity(command.vx)} m/s</div>
                <div>vy: {formatVelocity(command.vy)} m/s</div>
                <div>&nbsp;w: {formatVelocity(command.w)} rad/s</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
