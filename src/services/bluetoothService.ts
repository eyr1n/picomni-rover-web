import type { Command } from '../types';

export type BleHandlers = {
  onNotify: (dataView: DataView) => void;
  onDisconnect: () => void;
};

export const SERVICE_UUID = '69321c59-8017-488e-b5e2-b6d30c834bc5';
export const CHARACTERISTIC_UUID = '87bc2dc5-2207-408d-99f6-3d35573c4472';

export class BluetoothService {
  #device?: BluetoothDevice;
  #server?: BluetoothRemoteGATTServer;
  #writeChar?: BluetoothRemoteGATTCharacteristic;
  #notifyChar?: BluetoothRemoteGATTCharacteristic;
  #notifyHandler?: (event: Event) => void;
  #disconnectHandler?: EventListener;
  #serviceUuid: BluetoothServiceUUID;
  #characteristicUuid: BluetoothCharacteristicUUID;
  #writeLoopId: number | null = null;
  #writeBusy = false;

  constructor() {
    this.#serviceUuid = SERVICE_UUID;
    this.#characteristicUuid = CHARACTERISTIC_UUID;
  }

  async connect(handlers: BleHandlers) {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [this.#serviceUuid] }],
      optionalServices: [this.#serviceUuid],
    });

    const disconnectHandler: EventListener = () => {
      handlers.onDisconnect();
    };
    device.addEventListener('gattserverdisconnected', disconnectHandler);
    this.#disconnectHandler = disconnectHandler;

    const server = await device.gatt?.connect();
    if (!server) throw new Error('Failed to open a GATT server.');

    const service = await server.getPrimaryService(this.#serviceUuid);
    const writeChar = await service.getCharacteristic(this.#characteristicUuid);
    const notifyChar = writeChar;

    const notifyHandler = (event: Event) => {
      const target = event.target as BluetoothRemoteGATTCharacteristic;
      if (!target.value) return;
      handlers.onNotify(target.value);
    };

    this.#notifyHandler = notifyHandler;
    notifyChar.addEventListener('characteristicvaluechanged', notifyHandler);
    await notifyChar.startNotifications();

    this.#device = device;
    this.#server = server;
    this.#writeChar = writeChar;
    this.#notifyChar = notifyChar;
  }

  async disconnect() {
    await this.#stopNotifications();
    if (this.#server?.connected) {
      this.#server.disconnect();
    }
    if (this.#device && this.#disconnectHandler) {
      this.#device.removeEventListener(
        'gattserverdisconnected',
        this.#disconnectHandler,
      );
    }
    this.#device = undefined;
    this.#server = undefined;
    this.#writeChar = undefined;
    this.#notifyChar = undefined;
    this.#disconnectHandler = undefined;
  }

  #stopNotifications = async () => {
    if (this.#notifyChar && this.#notifyHandler) {
      this.#notifyChar.removeEventListener(
        'characteristicvaluechanged',
        this.#notifyHandler,
      );
      try {
        await this.#notifyChar.stopNotifications();
      } catch (error) {
        console.warn('通知の停止に失敗しました', error);
      }
    }
    this.#notifyHandler = undefined;
  };

  async writeCommand(command: Command) {
    if (!this.#writeChar)
      throw new Error('書き込み用キャラクタリスティックが利用できません。');
    const payload = this.#encodeCommand(command);
    if (this.#writeChar.writeValueWithoutResponse) {
      await this.#writeChar.writeValueWithoutResponse(payload);
    } else {
      await this.#writeChar.writeValueWithResponse(payload);
    }
  }

  startCommandLoop(
    getCommand: () => Command,
    onError: (message: string) => void,
    intervalMs = 50,
  ) {
    if (this.#writeLoopId !== null) return;
    this.#writeLoopId = window.setInterval(async () => {
      if (this.#writeBusy) return;
      this.#writeBusy = true;
      try {
        const command = getCommand();
        if (Object.values(command).some((value) => Number.isNaN(value))) {
          throw new Error(
            '現在のコマンドに不正な数値があります。入力を確認してください。',
          );
        }
        await this.writeCommand(command);
      } catch (error) {
        console.error(error);
        onError((error as Error).message);
        this.stopCommandLoop();
      } finally {
        this.#writeBusy = false;
      }
    }, intervalMs);
  }

  stopCommandLoop() {
    if (this.#writeLoopId !== null) {
      window.clearInterval(this.#writeLoopId);
      this.#writeLoopId = null;
    }
    this.#writeBusy = false;
  }

  #encodeCommand(command: Command) {
    const buffer = new ArrayBuffer(12);
    const view = new DataView(buffer);
    view.setFloat32(0, command.vx, true);
    view.setFloat32(4, command.vy, true);
    view.setFloat32(8, command.w, true);
    return new Uint8Array(buffer);
  }
}
