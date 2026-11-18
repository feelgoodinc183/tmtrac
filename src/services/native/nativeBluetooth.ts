// Bluetooth inside the Android app.
//
// The app's web view has no Web Bluetooth, so this gives the tracker code the same small part of
// the Web Bluetooth API it already uses (pick a device, connect, find the Meshtastic service and
// its characteristics, read, write, notify, disconnect events), carried out by Android's own
// Bluetooth through @capacitor-community/bluetooth-le. The connection logic in
// meshtasticBleMqttService.ts stays the same in Chrome and in the app.

import { isNativeApp } from './platform';

/** The part of the plugin's BleClient used here (tests pass a fake) */
export interface BleClientLike {
  requestDevice(options: { services?: string[]; optionalServices?: string[] }): Promise<{ deviceId: string; name?: string }>;
  getDevices(deviceIds: string[]): Promise<{ deviceId: string; name?: string }[]>;
  connect(deviceId: string, onDisconnect?: (deviceId: string) => void): Promise<void>;
  disconnect(deviceId: string): Promise<void>;
  getServices(deviceId: string): Promise<{ uuid: string; characteristics: { uuid: string }[] }[]>;
  read(deviceId: string, service: string, characteristic: string): Promise<DataView>;
  write(deviceId: string, service: string, characteristic: string, value: DataView): Promise<void>;
  startNotifications(deviceId: string, service: string, characteristic: string, callback: (value: DataView) => void): Promise<void>;
  stopNotifications(deviceId: string, service: string, characteristic: string): Promise<void>;
}

type LoadClient = () => Promise<BleClientLike>;

function domError(name: string, message: string): Error {
  const err = new Error(message);
  err.name = name;
  return err;
}

function toDataView(bytes: BufferSource): DataView {
  if (bytes instanceof DataView) return bytes;
  if (ArrayBuffer.isView(bytes)) return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return new DataView(bytes as ArrayBuffer);
}

type Listener = (event: { type: string; target: unknown }) => void;

class Listeners {
  private byType = new Map<string, Set<Listener>>();
  addEventListener(type: string, fn: Listener) {
    if (!this.byType.has(type)) this.byType.set(type, new Set());
    this.byType.get(type)!.add(fn);
  }
  removeEventListener(type: string, fn: Listener) {
    this.byType.get(type)?.delete(fn);
  }
  protected emit(type: string, target: unknown) {
    for (const fn of [...(this.byType.get(type) || [])]) {
      try {
        fn({ type, target });
      } catch (err) {
        console.error('[BLE] listener failed', err);
      }
    }
  }
}

class NativeCharacteristic extends Listeners {
  value: DataView | null = null;
  constructor(
    private device: NativeBleDevice,
    private serviceUuid: string,
    readonly uuid: string
  ) {
    super();
  }

  async readValue(): Promise<DataView> {
    const client = await this.device.client();
    this.value = await client.read(this.device.id, this.serviceUuid, this.uuid);
    return this.value;
  }

  async writeValueWithResponse(bytes: BufferSource): Promise<void> {
    const client = await this.device.client();
    await client.write(this.device.id, this.serviceUuid, this.uuid, toDataView(bytes));
  }

  writeValue(bytes: BufferSource): Promise<void> {
    return this.writeValueWithResponse(bytes);
  }

  async startNotifications(): Promise<this> {
    const client = await this.device.client();
    await client.startNotifications(this.device.id, this.serviceUuid, this.uuid, (value) => {
      this.value = value;
      this.emit('characteristicvaluechanged', this);
    });
    return this;
  }

  async stopNotifications(): Promise<this> {
    const client = await this.device.client();
    await client.stopNotifications(this.device.id, this.serviceUuid, this.uuid);
    return this;
  }
}

class NativeService {
  constructor(
    private device: NativeBleDevice,
    readonly uuid: string,
    private characteristicUuids: string[]
  ) {}

  async getCharacteristic(uuid: string): Promise<NativeCharacteristic> {
    const want = uuid.toLowerCase();
    if (!this.characteristicUuids.includes(want)) {
      throw domError('NotFoundError', `The tracker has no characteristic ${uuid}.`);
    }
    return new NativeCharacteristic(this.device, this.uuid, want);
  }
}

class NativeGattServer {
  connected = false;
  private services: Map<string, string[]> | null = null;
  /** Bumped on every connect and deliberate disconnect, so a late event from an old link is ignored */
  private link = 0;

  constructor(private device: NativeBleDevice) {}

  async connect(): Promise<this> {
    const client = await this.device.client();
    const link = ++this.link;
    this.services = null;
    await client.connect(this.device.id, () => {
      if (link !== this.link || !this.connected) return;
      this.connected = false;
      this.services = null;
      this.device.disconnected();
    });
    if (link === this.link) this.connected = true;
    return this;
  }

  disconnect() {
    if (!this.connected) return;
    // Like Web Bluetooth, `connected` turns false at once. The tracker code ignores the
    // disconnect event that a deliberate disconnect causes, so none is sent for it.
    this.connected = false;
    this.services = null;
    this.link++;
    void this.device
      .client()
      .then((client) => client.disconnect(this.device.id))
      .catch((err) => console.warn('[BLE] disconnect failed', err));
  }

  async getPrimaryService(uuid: string): Promise<NativeService> {
    if (!this.connected) throw domError('NetworkError', 'The tracker is not connected.');
    if (!this.services) {
      const client = await this.device.client();
      const list = await client.getServices(this.device.id);
      this.services = new Map(
        list.map((s) => [s.uuid.toLowerCase(), s.characteristics.map((c) => c.uuid.toLowerCase())])
      );
    }
    const want = uuid.toLowerCase();
    const chars = this.services.get(want);
    if (!chars) throw domError('NotFoundError', `The tracker has no service ${uuid}.`);
    return new NativeService(this.device, want, chars);
  }
}

class NativeBleDevice extends Listeners {
  readonly gatt: NativeGattServer;
  constructor(
    readonly id: string,
    readonly name: string,
    readonly client: LoadClient
  ) {
    super();
    this.gatt = new NativeGattServer(this);
  }

  /** Called by the GATT server when Android reports the link dropped */
  disconnected() {
    this.emit('gattserverdisconnected', this);
  }
}

export interface BluetoothLike {
  requestDevice(options: { filters?: { services?: string[] }[]; optionalServices?: string[] }): Promise<any>;
  /** Devices this phone can reconnect to without the picker; pass the remembered ids */
  getDevices(ids?: string[]): Promise<any[]>;
}

/** A Web Bluetooth look-alike over the plugin's BleClient */
export function createNativeBluetooth(loadClient: LoadClient): BluetoothLike {
  // A refused permission must not stick: a failed load is retried on the next tap
  let clientPromise: Promise<BleClientLike> | null = null;
  const client: LoadClient = () => {
    if (!clientPromise) {
      clientPromise = loadClient();
      clientPromise.catch(() => {
        clientPromise = null;
      });
    }
    return clientPromise;
  };

  // One object per tracker, so a reconnect reuses the device the tracker code already holds
  const devices = new Map<string, NativeBleDevice>();
  const deviceFor = (id: string, name?: string) => {
    let d = devices.get(id);
    if (!d) {
      d = new NativeBleDevice(id, name || '', client);
      devices.set(id, d);
    }
    return d;
  };

  return {
    async requestDevice(options) {
      const ble = await client();
      const services = (options.filters || []).flatMap((f) => f.services || []);
      try {
        const picked = await ble.requestDevice({ services, optionalServices: options.optionalServices });
        return deviceFor(picked.deviceId, picked.name);
      } catch (err: any) {
        const message = String(err?.message || err || '');
        if (/cancel|no device|not found/i.test(message)) throw domError('NotFoundError', 'No tracker was selected.');
        throw err;
      }
    },

    async getDevices(ids) {
      if (!ids?.length) return [];
      const ble = await client();
      const found = await ble.getDevices(ids);
      return found.map((d) => deviceFor(d.deviceId, d.name));
    },
  };
}

let nativeBluetooth: BluetoothLike | null = null;

/**
 * The Bluetooth to use on this device: Android's own inside the app, Web Bluetooth in Chrome,
 * or null where neither exists (Safari, Firefox).
 */
export function getBluetooth(): BluetoothLike | null {
  if (isNativeApp()) {
    if (!nativeBluetooth) {
      nativeBluetooth = createNativeBluetooth(async () => {
        const { BleClient } = await import('@capacitor-community/bluetooth-le');
        await BleClient.initialize();
        return BleClient;
      });
    }
    return nativeBluetooth;
  }
  return ((globalThis as any).navigator?.bluetooth as BluetoothLike | undefined) || null;
}
