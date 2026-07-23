<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'

import { echoApi } from '@/api/echo'
import { RingSoundConnection, supportsRingBluetooth } from '@/services/ringSound'
import type { RingAudioFrame, RingPacket, RingSensorSample } from '@/services/ringSound'

const emit = defineEmits<{
  transcribed: [text: string]
  confirm: [source: 'double-press' | 'throw']
}>()

const connection = ref<RingSoundConnection | null>(null)
const connected = ref(false)
const listening = ref(false)
const motionEnabled = ref(false)
const busy = ref(false)
const status = ref('')
const supported = supportsRingBluetooth()
const audioFrames = new Map<number, Map<number, Uint8Array>>()
const audioEnds = new Map<number, number>()
const recentSamples: RingSensorSample[] = []
let unsubscribe: (() => void) | undefined
let lastThrowAt = 0

async function connect() {
  if (!supported || busy.value) return
  busy.value = true
  status.value = '请在浏览器弹窗中选择戒指。'
  try {
    const next = new RingSoundConnection()
    await next.connect()
    unsubscribe = next.onPacket(handlePacket)
    connection.value = next
    connected.value = true
    status.value = '戒指已连接。长按戒指录音，松开后等待转写。'
  } catch (error) {
    status.value = error instanceof Error ? error.message : '戒指连接失败。'
  } finally {
    busy.value = false
  }
}

async function disconnect() {
  unsubscribe?.()
  unsubscribe = undefined
  await connection.value?.disconnect()
  connection.value = null
  connected.value = false
  listening.value = false
  motionEnabled.value = false
  status.value = '戒指已断开。'
}

function armRecording() {
  if (!connected.value) return
  listening.value = true
  audioFrames.clear()
  audioEnds.clear()
  status.value = '正在等待录音，请长按戒指并在说完后松开。'
}

async function enableMotion() {
  if (!connection.value || busy.value) return
  busy.value = true
  try {
    await connection.value.startSensorReport()
    motionEnabled.value = true
    status.value = '动作识别已开启，请向前甩动戒指确认发送。'
  } catch (error) {
    status.value = error instanceof Error ? error.message : '无法开启动作识别。请先单击戒指切换到手势模式。'
  } finally {
    busy.value = false
  }
}

function handlePacket(packet: RingPacket) {
  if (!connection.value) return
  if (packet.command === -1) {
    connected.value = false
    status.value = '戒指蓝牙连接已断开。'
    return
  }
  if (connection.value.isDoublePress(packet)) {
    emit('confirm', 'double-press')
    status.value = '已收到双击确认。'
    return
  }
  try {
    const audio = connection.value.parseAudio(packet)
    if (audio) void handleAudioFrame(audio)
    const sensor = connection.value.parseSensor(packet)
    if (sensor && motionEnabled.value) {
      for (const sample of sensor.samples) {
        if (detectThrow(sample)) {
          emit('confirm', 'throw')
          status.value = '已识别投掷动作。'
          break
        }
      }
    }
  } catch (error) {
    status.value = error instanceof Error ? error.message : '戒指数据解析失败。'
  }
}

async function handleAudioFrame(frame: RingAudioFrame) {
  if (!listening.value) return
  const frames = audioFrames.get(frame.fileIndex) || new Map<number, Uint8Array>()
  frames.set(frame.offset, frame.data)
  audioFrames.set(frame.fileIndex, frames)
  if (frame.isEnd) audioEnds.set(frame.fileIndex, frame.offset + frame.data.byteLength)
  const end = audioEnds.get(frame.fileIndex)
  if (end === undefined) return
  const ordered = [...frames.entries()].sort(([left], [right]) => left - right)
  const bytes = new Uint8Array(ordered.reduce((total, [, data]) => total + data.byteLength, 0))
  let offset = 0
  for (const [frameOffset, data] of ordered) {
    if (frameOffset !== offset) return
    bytes.set(data, offset)
    offset += data.byteLength
  }
  if (offset < end) return
  listening.value = false
  busy.value = true
  status.value = '录音已收到，正在转换文字。'
  try {
    const text = await echoApi.transcribeRingAudio(bytes)
    emit('transcribed', text)
    status.value = '文字已填入发布框，可编辑后发送。'
  } catch (error) {
    status.value = error instanceof Error ? error.message : '语音转文字失败。'
  } finally {
    busy.value = false
  }
}

function detectThrow(sample: RingSensorSample): boolean {
  recentSamples.push(sample)
  if (recentSamples.length > 12) recentSamples.shift()
  if (recentSamples.length < 6 || Date.now() - lastThrowAt < 1800) return false
  const magnitudes = recentSamples.map((item) => Math.hypot(item.accelX, item.accelY, item.accelZ))
  const baseline = magnitudes.slice(0, -2).reduce((sum, value) => sum + value, 0) / Math.max(1, magnitudes.length - 2)
  const peak = Math.max(...magnitudes.slice(-3))
  const gyroPeak = Math.max(...recentSamples.slice(-3).map((item) => Math.max(Math.abs(item.gyroX), Math.abs(item.gyroY), Math.abs(item.gyroZ))))
  if (peak - baseline < 2500 || gyroPeak < 1500) return false
  lastThrowAt = Date.now()
  recentSamples.length = 0
  return true
}

onBeforeUnmount(() => {
  void disconnect()
})
</script>

<template>
  <section class="ring-panel" :class="{ 'is-connected': connected, 'is-listening': listening, 'is-busy': busy }" aria-label="戒指语音输入">
    <div class="ring-panel-heading">
      <span class="ring-indicator" :class="{ connected, listening, busy }" aria-hidden="true"></span>
      <div>
        <strong>Yeve Ring</strong>
        <p>{{ supported ? (listening ? '正在接收语音' : busy ? '正在处理' : connected ? '设备在线' : '等待蓝牙连接') : '当前浏览器不支持 Web Bluetooth' }}</p>
      </div>
    </div>
    <div class="ring-panel-actions">
      <button v-if="!connected" type="button" :disabled="!supported || busy" @click="connect">连接戒指</button>
      <button v-else type="button" :disabled="busy" @click="disconnect">断开</button>
      <button v-if="connected" type="button" :disabled="busy" @click="armRecording">{{ listening ? '等待录音中' : '戒指录音' }}</button>
      <button v-if="connected" type="button" :disabled="busy || motionEnabled" @click="enableMotion">{{ motionEnabled ? '动作识别中' : '开启投掷识别' }}</button>
    </div>
    <p v-if="status" class="ring-panel-status" role="status" aria-live="polite">{{ status }}</p>
    <div v-if="connected" class="ring-panel-hint"><span>双击确认</span><span>长按录音</span><span>甩动发送</span></div>
  </section>
</template>
