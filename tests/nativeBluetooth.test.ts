// The Android app's Bluetooth: the Web Bluetooth look-alike over the Capacitor plugin, driven by
// the real tracker service against a fake plugin that behaves like a Meshtastic T-Echo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { create, toBinary, fromBinary } from '@bufbuild/protobuf';
import { Mesh } from '@meshtastic/protobufs';

const store: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
};

const { MeshtasticBleMqttService, MESHTASTIC_SERVICE_UUID, TO_RADIO_UUID, FROM_RADIO_UUID, FROM_NUM_UUID, BATTERY_SERVICE_UUID, BATTERY_LEVEL_UUID } =
  await import('../src/services/meshtasticBleMqttService');
const { createNativeBluetooth } = await import('../src/services/native/nativeBluetooth');

const MY = 0xa1b2c3d4;
const fr = (v: any) => toBinary(Mesh.FromRadioSchema, create(Mesh.FromRadioSchema, { payloadVariant: v }));
const dv = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);
const tick = () => new Promise((r) => setImmediate(r));

/** The plugin's BleClient, as Android would answer for one T-Echo (ids are MAC addresses) */
class FakeBleClient {
  id = 'F1:E2:D3:C4:B5:A6';
  pickerCancelled = false;
  hasBattery = true;
  connected = false;
  connects = 0;
  disconnects = 0;
  queue: Uint8Array[] = [];
  writes: any[] = [];
  private onDisconnect: ((id: string) => void) | null = null;
  private onFromNum: ((v: DataView) => void) | null = null;

  async requestDevice(opts: { services?: string[] }) {
    assert.deepEqual(opts.services, [MESHTASTIC_SERVICE_UUID]);
    if (this.pickerCancelled) throw new Error('requestDevice cancelled.');
    return { deviceId: this.id, name: 'RM2_c3d4' };
  }
  async getDevices(ids: string[]) {
    return ids.filter((i) => i === this.id).map((deviceId) => ({ deviceId, name: 'RM2_c3d4' }));
  }
  async connect(id: string, onDisconnect?: (id: string) => void) {
    assert.equal(id, this.id);
    this.connects++;
    this.connected = true;
    this.onDisconnect = onDisconnect || null;
  }
  async disconnect() {
    this.disconnects++;
    this.connected = false;
    setImmediate(() => this.onDisconnect?.(this.id));
  }
  async getServices() {
    const services = [
      { uuid: MESHTASTIC_SERVICE_UUID.toUpperCase(), characteristics: [TO_RADIO_UUID, FROM_RADIO_UUID, FROM_NUM_UUID].map((uuid) => ({ uuid })) },
    ];
    if (this.hasBattery) services.push({ uuid: BATTERY_SERVICE_UUID, characteristics: [{ uuid: BATTERY_LEVEL_UUID }] });
    return services;
  }
  async read(_id: string, service: string, ch: string) {
    if (service === BATTERY_SERVICE_UUID) return dv(new Uint8Array([87]));
    assert.equal(ch, FROM_RADIO_UUID);
    await tick();
    return dv(this.queue.shift() ?? new Uint8Array(0));
  }
  async write(_id: string, _service: string, ch: string, value: DataView) {
    assert.equal(ch, TO_RADIO_UUID);
    const msg = fromBinary(Mesh.ToRadioSchema, new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
    this.writes.push(msg);
    if (msg.payloadVariant.case === 'wantConfigId') {
      this.queue.push(
        fr({ case: 'myInfo', value: create(Mesh.MyNodeInfoSchema, { myNodeNum: MY }) }),
        fr({ case: 'nodeInfo', value: create(Mesh.NodeInfoSchema, { num: MY, user: create(Mesh.UserSchema, { longName: 'RM2', shortName: 'RM2' }) }) }),
        fr({ case: 'configCompleteId', value: msg.payloadVariant.value as number })
      );
      this.onFromNum?.(dv(new Uint8Array([1, 0, 0, 0])));
    }
  }
  async startNotifications(_id: string, _service: string, ch: string, cb: (v: DataView) => void) {
    assert.equal(ch, FROM_NUM_UUID);
    this.onFromNum = cb;
  }
  async stopNotifications() {}

  /** Out of range or switched off */
  drop() {
    this.connected = false;
    this.onDisconnect?.(this.id);
  }
}

async function setup(opts: { hasBattery?: boolean } = {}) {
  const ble = new FakeBleClient();
  if (opts.hasBattery === false) ble.hasBattery = false;
  const bt = createNativeBluetooth(async () => ble);
  const svc = new MeshtasticBleMqttService();
  const statuses: string[] = [];
  const nodes: any[] = [];
  svc.onBleStatusChange((s: any) => statuses.push(s.state));
  svc.onNodeUpdate((n: any) => nodes.push({ ...n }));
  return { ble, bt, svc, statuses, nodes };
}

async function pickAndConnect(opts: { hasBattery?: boolean } = {}) {
  const ctx = await setup(opts);
  const device = await ctx.bt.requestDevice({ filters: [{ services: [MESHTASTIC_SERVICE_UUID] }], optionalServices: [BATTERY_SERVICE_UUID] });
  const res = await (ctx.svc as any).connectToBleDevice(device, false);
  return { ...ctx, device, res };
}

test('app Bluetooth: picks a T-Echo, runs the Meshtastic handshake and shows the tracker', async () => {
  const { ble, res, statuses, nodes } = await pickAndConnect();
  assert.equal(res.success, true, res.error);
  assert.equal(res.nodeId, '!a1b2c3d4');
  assert.equal(ble.writes[0].payloadVariant.case, 'wantConfigId');
  assert.deepEqual(statuses, ['disconnected', 'connecting', 'configuring', 'connected']);
  const local = nodes.filter((n) => n.id === '!a1b2c3d4');
  assert.equal(local.at(-1).longName, 'RM2');
  assert.equal(local.at(-1).battery, 87);
});

test('app Bluetooth: a tracker without a battery service still connects', async () => {
  const { res } = await pickAndConnect({ hasBattery: false });
  assert.equal(res.success, true, res.error);
});

test('app Bluetooth: closing the picker reads as "no tracker selected"', async () => {
  const { ble, bt, svc } = await setup();
  ble.pickerCancelled = true;
  await assert.rejects(bt.requestDevice({ filters: [{ services: [MESHTASTIC_SERVICE_UUID] }] }), { name: 'NotFoundError' });
  assert.equal(svc.getBleStatus().state, 'disconnected');
});

test('app Bluetooth: a dropped link starts the reconnect, which reuses the same tracker', async () => {
  const { ble, svc, statuses } = await pickAndConnect();
  ble.drop();
  assert.equal(statuses.at(-1), 'reconnecting');
  svc.disconnectBle(); // stop the retry timer
});

test('app Bluetooth: disconnecting on purpose closes the link and does not reconnect', async () => {
  const { ble, svc, statuses } = await pickAndConnect();
  svc.disconnectBle();
  await tick();
  await tick();
  assert.equal(ble.disconnects, 1);
  assert.equal(statuses.at(-1), 'disconnected');
  assert.ok(!statuses.slice(statuses.lastIndexOf('connected')).includes('reconnecting'));
});

test('app Bluetooth: the remembered tracker is found again by its id, as the same object', async () => {
  const { bt, device } = await pickAndConnect();
  assert.deepEqual(await bt.getDevices([]), []);
  const [again] = await bt.getDevices([device.id]);
  assert.equal(again, device);
});
