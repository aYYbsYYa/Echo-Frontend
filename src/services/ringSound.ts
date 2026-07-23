export const RING_SERVICE_UUID = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E'
const RING_TX_UUID = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E'
const RING_RX_UUID = '6E400002-B5A3-F393-E0A9-E50E24DCCA9E'
const HEADER_SIZE = 11
const HEADER_MAGIC = 0x3f

export const RingCommand = {
  audioFrame: 0x0505,
  sensorStart: 0x0601,
  sensorStartResponse: 0x0602,
  sensorData: 0x0605,
  gesture: 0x0702,
  keyDoublePress: 0x0703,
} as const

export interface RingAudioFrame {
  fileIndex: number
  offset: number
  isEnd: boolean
  data: Uint8Array
}

export interface RingSensorSample {
  timestampMs: number
  accelX: number
  accelY: number
  accelZ: number
  gyroX: number
  gyroY: number
  gyroZ: number
}

export interface RingSensorBatch {
  sampleRateHz: number
  samples: RingSensorSample[]
}

export interface RingPacket {
  command: number
  body: Uint8Array
}

function crc16(data: Uint8Array): number {
  let crc = 0xffff
  for (const byte of data) {
    crc = ((crc >>> 8) | ((crc << 8) & 0xffff)) & 0xffff
    crc ^= byte
    crc ^= (crc & 0xff) >>> 4
    crc ^= (crc << 8) << 4
    crc ^= ((crc & 0xff) << 4) << 1
    crc &= 0xffff
  }
  return crc
}

function encodePacket(command: number, body = new Uint8Array()): Uint8Array {
  const output = new Uint8Array(HEADER_SIZE + body.byteLength)
  const view = new DataView(output.buffer)
  view.setUint8(0, HEADER_MAGIC)
  view.setUint16(1, 4)
  view.setUint16(3, command)
  view.setUint32(5, body.byteLength)
  view.setUint16(9, body.byteLength ? crc16(body) : 0)
  output.set(body, HEADER_SIZE)
  return output
}

class PacketStream {
  private buffer = new Uint8Array()

  feed(chunk: Uint8Array): RingPacket[] {
    const joined = new Uint8Array(this.buffer.byteLength + chunk.byteLength)
    joined.set(this.buffer)
    joined.set(chunk, this.buffer.byteLength)
    this.buffer = joined
    const packets: RingPacket[] = []
    while (this.buffer.byteLength >= HEADER_SIZE) {
      if (this.buffer[0] !== HEADER_MAGIC) {
        this.buffer = this.buffer.slice(1)
        continue
      }
      const view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength)
      const bodyLength = view.getUint32(5)
      const total = HEADER_SIZE + bodyLength
      if (this.buffer.byteLength < total) break
      const body = this.buffer.slice(HEADER_SIZE, total)
      if (bodyLength && view.getUint16(9) !== crc16(body)) {
        this.buffer = this.buffer.slice(total)
        continue
      }
      packets.push({ command: view.getUint16(3), body })
      this.buffer = this.buffer.slice(total)
    }
    return packets
  }
}

function readAudioFrame(body: Uint8Array): RingAudioFrame {
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength)
  const error = view.getUint16(0)
  if (error !== 0) throw new Error(`戒指录音读取失败（错误码 ${error}）`)
  const fileIndex = view.getUint32(2)
  const offset = view.getUint32(6)
  const frameSize = view.getUint32(10)
  const isEnd = view.getUint8(14) === 1
  const data = body.slice(15)
  if (data.byteLength !== frameSize) throw new Error('戒指录音帧长度不一致')
  return { fileIndex, offset, isEnd, data }
}

function readSensorBatch(body: Uint8Array, sampleRateHz: number): RingSensorBatch {
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength)
  const error = view.getUint16(0)
  if (error !== 0) throw new Error(`戒指传感器读取失败（错误码 ${error}）`)
  const frameCount = view.getUint16(6)
  const sampleSize = view.getUint16(8)
  if (sampleSize !== 16 || body.byteLength !== 10 + frameCount * sampleSize) {
    throw new Error('戒指传感器数据格式不受支持')
  }
  const samples: RingSensorSample[] = []
  let offset = 10
  for (let index = 0; index < frameCount; index += 1) {
    samples.push({
      timestampMs: view.getUint32(offset),
      accelX: view.getInt16(offset + 4),
      accelY: view.getInt16(offset + 6),
      accelZ: view.getInt16(offset + 8),
      gyroX: view.getInt16(offset + 10),
      gyroY: view.getInt16(offset + 12),
      gyroZ: view.getInt16(offset + 14),
    })
    offset += sampleSize
  }
  return { sampleRateHz, samples }
}

export class RingSoundConnection {
  private device: BluetoothDevice | null = null
  private tx: BluetoothRemoteGATTCharacteristic | null = null
  private rx: BluetoothRemoteGATTCharacteristic | null = null
  private stream = new PacketStream()
  private listeners = new Set<(packet: RingPacket) => void>()
  private pending = new Map<number, Array<(packet: RingPacket) => void>>()
  private sensorRateHz = 25

  get connected() {
    return Boolean(this.device?.gatt?.connected)
  }

  async connect(): Promise<void> {
    if (!navigator.bluetooth) throw new Error('当前浏览器不支持 Web Bluetooth，请使用 Chrome 或 Edge。')
    this.device = await navigator.bluetooth.requestDevice({ filters: [{ services: [RING_SERVICE_UUID] }] })
    this.device.addEventListener('gattserverdisconnected', () => this.emit({ command: -1, body: new Uint8Array() }))
    const server = await this.device.gatt?.connect()
    if (!server) throw new Error('无法连接戒指蓝牙服务。')
    const service = await server.getPrimaryService(RING_SERVICE_UUID)
    this.tx = await service.getCharacteristic(RING_TX_UUID)
    this.rx = await service.getCharacteristic(RING_RX_UUID)
    await this.tx.startNotifications()
    this.tx.addEventListener('characteristicvaluechanged', this.handleValue)
  }

  async disconnect(): Promise<void> {
    this.tx?.removeEventListener('characteristicvaluechanged', this.handleValue)
    if (this.device?.gatt?.connected) this.device.gatt.disconnect()
    this.device = null
    this.tx = null
    this.rx = null
  }

  onPacket(listener: (packet: RingPacket) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async startSensorReport(): Promise<void> {
    const packet = await this.request(RingCommand.sensorStart, RingCommand.sensorStartResponse)
    const view = new DataView(packet.body.buffer, packet.body.byteOffset, packet.body.byteLength)
    if (view.getUint16(0) !== 0) throw new Error('戒指不在手势模式，请先单击戒指切换模式。')
    this.sensorRateHz = view.getUint16(2) || 25
  }

  parseAudio(packet: RingPacket): RingAudioFrame | null {
    return packet.command === RingCommand.audioFrame ? readAudioFrame(packet.body) : null
  }

  parseSensor(packet: RingPacket): RingSensorBatch | null {
    return packet.command === RingCommand.sensorData ? readSensorBatch(packet.body, this.sensorRateHz) : null
  }

  isDoublePress(packet: RingPacket): boolean {
    return packet.command === RingCommand.keyDoublePress
  }

  private async request(command: number, responseCommand: number): Promise<RingPacket> {
    const response = new Promise<RingPacket>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('戒指响应超时。')), 8000)
      const queue = this.pending.get(responseCommand) || []
      queue.push((packet) => {
        window.clearTimeout(timer)
        resolve(packet)
      })
      this.pending.set(responseCommand, queue)
    })
    await this.write(encodePacket(command))
    return response
  }

  private async write(data: Uint8Array): Promise<void> {
    if (!this.rx) throw new Error('戒指尚未连接。')
    const payload = new ArrayBuffer(data.byteLength)
    new Uint8Array(payload).set(data)
    await this.rx.writeValueWithoutResponse(payload)
  }

  private handleValue = (event: Event) => {
    const value = (event.target as BluetoothRemoteGATTCharacteristic).value
    if (!value) return
    for (const packet of this.stream.feed(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))) {
      const queue = this.pending.get(packet.command)
      if (queue?.length) {
        queue.shift()?.(packet)
        if (!queue.length) this.pending.delete(packet.command)
      }
      this.emit(packet)
    }
  }

  private emit(packet: RingPacket) {
    for (const listener of this.listeners) listener(packet)
  }
}

export function supportsRingBluetooth(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator
}
