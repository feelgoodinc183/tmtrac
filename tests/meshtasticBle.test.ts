// Bluetooth transport tests against a fake Meshtastic device. The device's replies are built with
// the official definitions (@meshtastic/protobufs, dev dependency only).
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { create, toBinary, fromBinary } from '@bufbuild/protobuf';
import { Mesh, Telemetry, Portnums } from '@meshtastic/protobufs';

const store: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
};

const { MeshtasticBleMqttService } = await import('../src/services/meshtasticBleMqttService');

const MY = 0xa1b2c3d4;
const OTHER = 0x11223344;
const fr = (v: any) => toBinary(Mesh.FromRadioSchema, create(Mesh.FromRadioSchema, { payloadVariant: v }));
const tick = () => new Promise((r) => setImmediate(r));

class FakeTracker {
  queue: Uint8Array[] = [];
  readsInFlight = 0;
  maxReadsInFlight = 0;
  reads = 0;
  writes: any[] = [];
  connected = false;
  failConnect = false;
  notificationsWork = true;
  /** Link drops right after want_config_id, before the config arrives (edge of range) */
  dropDuringConfig = false;
  /** Chrome fires gattserverdisconnected asynchronously */
  asyncDisconnectEvent = false;
  connectAttempts = 0;
  failReads = false;
  private fromNumHandler: (() => void) | null = null;
  private disconnectHandler: (() => void) | null = null;

  configReply(configId: number): Uint8Array[] {
    return [
      fr({ case: 'myInfo', value: create(Mesh.MyNodeInfoSchema, { myNodeNum: MY }) }),
      fr({ case: 'metadata', value: create(Mesh.DeviceMetadataSchema, { firmwareVersion: '2.6.11', hwModel: Mesh.HardwareModel.T_ECHO }) }),
      fr({ case: 'nodeInfo', value: create(Mesh.NodeInfoSchema, { num: MY, user: create(Mesh.UserSchema, { longName: 'RM2', shortName: 'RM2' }) }) }),
      fr({ case: 'nodeInfo', value: create(Mesh.NodeInfoSchema, { num: OTHER, user: create(Mesh.UserSchema, { longName: 'Other' }), lastHeard: Math.floor(Date.now() / 1000) - 60, hopsAway: 1 }) }),
      fr({ case: 'configCompleteId', value: configId }),
    ];
  }

  private char(kind: 'to' | 'from' | 'num') {
    return {
      writeValueWithResponse: async (bytes: Uint8Array) => {
        const msg = fromBinary(Mesh.ToRadioSchema, bytes);
        this.writes.push(msg);
        if (msg.payloadVariant.case === 'wantConfigId') {
          if (this.dropDuringConfig) {
            setImmediate(() => {
              this.device.gatt.connected = false;
              this.drop();
            });
            return;
          }
          this.queue.push(...this.configReply(msg.payloadVariant.value as number));
          this.notify();
        }
      },
      readValue: async () => {
        assert.equal(kind, 'from');
        this.reads++;
        if (this.failReads) throw Object.assign(new Error('GATT operation failed for unknown reason.'), { name: 'NetworkError' });
        this.readsInFlight++;
        this.maxReadsInFlight = Math.max(this.maxReadsInFlight, this.readsInFlight);
        await tick();
        this.readsInFlight--;
        const next = this.queue.shift() ?? new Uint8Array(0);
        return new DataView(next.buffer, next.byteOffset, next.byteLength);
      },
      startNotifications: async () => {
        if (!this.notificationsWork) throw new Error('notifications not supported');
      },
      addEventListener: (_: string, h: () => void) => { this.fromNumHandler = h; },
      removeEventListener: () => { this.fromNumHandler = null; },
    };
  }

  notify() {
    this.fromNumHandler?.();
  }

  /** Push a packet as if it arrived over LoRa */
  receive(bytes: Uint8Array) {
    this.queue.push(bytes);
    this.notify();
  }

  /** Simulate the device going out of range / powering off */
  drop() {
    this.connected = false;
    this.disconnectHandler?.();
  }

  device = {
    id: 'dev-1',
    name: 'RM2_c3d4',
    addEventListener: (_: string, h: () => void) => { this.disconnectHandler = h; },
    removeEventListener: () => {},
    gatt: {
      connected: false,
      connect: async () => {
        this.connectAttempts++;
        if (this.failConnect) throw Object.assign(new Error('Connection attempt failed'), { name: 'NetworkError' });
        this.connected = true;
        this.device.gatt.connected = true;
        return {
          getPrimaryService: async (uuid: string) => {
            if (uuid !== '6ba1b218-15a8-461f-9fa8-5dcae273eafd') throw new Error('No such service');
            return {
              getCharacteristic: async (c: string) =>
                c.startsWith('f75c76d2') ? this.char('to') : c.startsWith('2c55e69e') ? this.char('from') : this.char('num'),
            };
          },
        };
      },
      disconnect: () => {
        this.device.gatt.connected = false;
        if (this.asyncDisconnectEvent) setImmediate(() => this.drop());
        else this.drop();
      },
    },
  };
}

async function connected() {
  const svc = new MeshtasticBleMqttService();
  const dev = new FakeTracker();
  const emitted: any[] = [];
  const statuses: string[] = [];
  svc.onNodeUpdate((n: any) => emitted.push({ ...n }));
  svc.onBleStatusChange((s: any) => statuses.push(s.state));
  const res = await (svc as any).connectToBleDevice(dev.device, false);
  return { svc, dev, emitted, statuses, res };
}

test('handshake: want_config_id, drain until config_complete_id, then show the tracker', async () => {
  const { dev, emitted, statuses, res } = await connected();
  assert.equal(res.success, true, res.error);
  assert.equal(res.nodeId, '!a1b2c3d4');
  assert.equal(dev.writes[0].payloadVariant.case, 'wantConfigId');
  assert.deepEqual(statuses, ['disconnected', 'connecting', 'configuring', 'connected']);

  const local = emitted.filter((n) => n.id === '!a1b2c3d4');
  assert.equal(local.length, 1, 'the tracker is shown once, after config completes');
  assert.equal(local[0].longName, 'RM2');
  assert.equal(local[0].firmwareVersion, '2.6.11');
  assert.equal(local[0].hardwareModel, 'LilyGO T-Echo');
  assert.ok(emitted.some((n) => n.id === '!11223344' && n.hops === 1));
  assert.ok(!emitted.some((n) => /TECHO/i.test(n.id)), 'no placeholder ids');
});

test('reads are serialised, even when FromNum notifies repeatedly', async () => {
  const { dev } = await connected();
  const pos = (lat: number) => fr({
    case: 'packet',
    value: create(Mesh.MeshPacketSchema, {
      from: OTHER, rxSnr: 5.5, rxRssi: -90, hopStart: 3, hopLimit: 1,
      payloadVariant: { case: 'decoded', value: create(Mesh.DataSchema, {
        portnum: Portnums.PortNum.POSITION_APP,
        payload: toBinary(Mesh.PositionSchema, create(Mesh.PositionSchema, { latitudeI: lat, longitudeI: 998200000, groundSpeed: 11, groundTrack: 9_000_000 })),
      }) },
    }),
  });
  dev.maxReadsInFlight = 0;
  for (let i = 0; i < 5; i++) dev.receive(pos(63080000 + i));
  for (let i = 0; i < 20; i++) await tick();
  assert.equal(dev.queue.length, 0, 'everything was drained');
  assert.equal(dev.maxReadsInFlight, 1, 'never more than one GATT read at a time');
});

test('position packets give SOG/COG in knots/degrees, plus SNR, RSSI and hops', async () => {
  const { dev, emitted } = await connected();
  dev.receive(fr({
    case: 'packet',
    value: create(Mesh.MeshPacketSchema, {
      from: OTHER, rxSnr: 5.5, rxRssi: -90, hopStart: 3, hopLimit: 1,
      payloadVariant: { case: 'decoded', value: create(Mesh.DataSchema, {
        portnum: Portnums.PortNum.POSITION_APP,
        payload: toBinary(Mesh.PositionSchema, create(Mesh.PositionSchema, { latitudeI: 63080000, longitudeI: 998200000, groundSpeed: 11, groundTrack: 9_000_000, satsInView: 8 })),
      }) },
    }),
  }));
  for (let i = 0; i < 10; i++) await tick();
  const n = emitted.filter((x) => x.id === '!11223344').pop();
  assert.equal(n.lat, 6.308);
  assert.equal(n.speedKt, 5.9); // 11 km/h
  assert.equal(n.headingDeg, 90);
  assert.equal(n.satsInView, 8);
  assert.equal(n.snr, 5.5);
  assert.equal(n.rssi, -90);
  assert.equal(n.hops, 2);
});

test('telemetry: battery 101 stays "external power", not 100%', async () => {
  const { dev, emitted } = await connected();
  dev.receive(fr({
    case: 'packet',
    value: create(Mesh.MeshPacketSchema, {
      from: MY,
      payloadVariant: { case: 'decoded', value: create(Mesh.DataSchema, {
        portnum: Portnums.PortNum.TELEMETRY_APP,
        payload: toBinary(Telemetry.TelemetrySchema, create(Telemetry.TelemetrySchema, {
          variant: { case: 'deviceMetrics', value: create(Telemetry.DeviceMetricsSchema, { batteryLevel: 101, voltage: 4.9 }) },
        })),
      }) },
    }),
  }));
  for (let i = 0; i < 10; i++) await tick();
  const n = emitted.filter((x) => x.id === '!a1b2c3d4').pop();
  assert.equal(n.battery, 101);
  assert.equal(n.voltage, 4.9);
});

test('no polling while FromNum notifications work; polling only as a fallback', async () => {
  const a = await connected();
  assert.equal((a.svc as any).pollIntervalTimer, null);
  a.svc.disconnectBle();

  const svc = new MeshtasticBleMqttService();
  const dev = new FakeTracker();
  dev.notificationsWork = false;
  const res = await (svc as any).connectToBleDevice(dev.device, false);
  assert.equal(res.success, true, res.error);
  assert.notEqual((svc as any).pollIntervalTimer, null);
  svc.disconnectBle();
});

test('a dropped connection shows at once, retries with backoff, then asks the user', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { svc, dev } = await connected();
    const seen: any[] = [];
    svc.onBleStatusChange((s: any) => seen.push(s));

    dev.failConnect = true;
    dev.drop();
    const afterDrop = seen[seen.length - 1];
    assert.equal(afterDrop.state, 'reconnecting');
    assert.equal(afterDrop.attempt, 1);
    assert.equal(svc.isBleActive(), false, 'shown as not connected immediately');

    // Each attempt fails; delays are 1, 2, 4, 8, 15 s
    for (const ms of [1000, 2000, 4000, 8000, 15000]) {
      mock.timers.tick(ms);
      for (let i = 0; i < 10; i++) await tick();
    }
    const last = seen[seen.length - 1];
    assert.equal(last.state, 'lost');
    assert.match(last.error, /could not reconnect/);
    assert.deepEqual(seen.filter((s) => s.state === 'reconnecting').map((s) => s.attempt), [1, 2, 3, 4, 5]);
  } finally {
    mock.timers.reset();
  }
});

test('reconnects on its own when the tracker comes back', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { svc, dev } = await connected();
    dev.drop();
    assert.equal(svc.getBleStatus().state, 'reconnecting');
    mock.timers.tick(1000);
    for (let i = 0; i < 30; i++) await tick();
    assert.equal(svc.getBleStatus().state, 'connected');
    assert.equal(dev.writes.filter((w) => w.payloadVariant.case === 'wantConfigId').length, 2, 'handshake runs again');
  } finally {
    mock.timers.reset();
  }
});

test('disconnecting on purpose does not trigger a reconnect', async () => {
  const { svc } = await connected();
  svc.disconnectBle();
  assert.equal(svc.getBleStatus().state, 'disconnected');
  assert.equal((svc as any).reconnectTimer, null);
});

test('text messages are a valid ToRadio packet', async () => {
  const { svc, dev } = await connected();
  const res = await svc.sendLoraTextMessage('Hello', '!11223344');
  assert.equal(res.success, true, res.error);
  const sent = dev.writes[dev.writes.length - 1];
  assert.equal(sent.payloadVariant.case, 'packet');
  const pkt = sent.payloadVariant.value;
  assert.equal(pkt.to, OTHER);
  assert.equal(pkt.wantAck, true);
  assert.equal(pkt.payloadVariant.value.portnum, Portnums.PortNum.TEXT_MESSAGE_APP);
  assert.equal(new TextDecoder().decode(pkt.payloadVariant.value.payload), 'Hello');
});

test('a tracker that keeps dropping during setup is retried 5 times, then the user is asked (no endless loop)', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { svc, dev } = await connected();
    const seen: any[] = [];
    svc.onBleStatusChange((st: any) => seen.push(st));
    dev.asyncDisconnectEvent = true;
    dev.dropDuringConfig = true;
    const attemptsBefore = dev.connectAttempts;
    dev.drop();
    for (const ms of [1000, 2000, 4000, 8000, 15000, 15000, 15000]) {
      for (let i = 0; i < 20; i++) await tick();
      mock.timers.tick(ms);
      for (let i = 0; i < 20; i++) await tick();
    }
    assert.equal(svc.getBleStatus().state, 'lost');
    assert.equal(dev.connectAttempts - attemptsBefore, 5, 'exactly five retries');
    assert.deepEqual(seen.filter((st) => st.state === 'reconnecting').map((st) => st.attempt), [1, 2, 3, 4, 5]);
  } finally {
    mock.timers.reset();
  }
});

test('reads that keep failing while GATT says connected are treated as a drop', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { svc, dev } = await connected();
    dev.failReads = true;
    for (let i = 0; i < 3; i++) {
      dev.notify();
      for (let j = 0; j < 10; j++) await tick();
    }
    assert.equal(svc.getBleStatus().state, 'reconnecting');
  } finally {
    mock.timers.reset();
  }
});
