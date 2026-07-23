/// <reference types="vite/client" />

interface Navigator {
  bluetooth?: Bluetooth
}

interface Bluetooth {
  requestDevice(options: { filters: Array<{ services: string[] }> }): Promise<BluetoothDevice>
}

interface BluetoothDevice extends EventTarget {
  gatt?: BluetoothRemoteGATTServer
}

interface BluetoothRemoteGATTServer {
  connected: boolean
  connect(): Promise<BluetoothRemoteGATTServer>
  getPrimaryService(uuid: string): Promise<BluetoothRemoteGATTService>
  disconnect(): void
}

interface BluetoothRemoteGATTService {
  getCharacteristic(uuid: string): Promise<BluetoothRemoteGATTCharacteristic>
}

interface BluetoothRemoteGATTCharacteristic extends EventTarget {
  value?: DataView
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>
  writeValueWithoutResponse(value: BufferSource): Promise<void>
}
