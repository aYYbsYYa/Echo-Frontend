const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function formatRelativeTime(value: string): string {
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) return '时间未知'

  const elapsed = Math.max(0, Date.now() - timestamp)
  if (elapsed < MINUTE) return '刚刚'
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} 分钟前`
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} 小时前`
  return `${Math.floor(elapsed / DAY)} 天前`
}

export function formatDriftDuration(value: string): string {
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) return '漂流时间未知'

  const elapsed = Math.max(0, Date.now() - timestamp)
  const days = Math.floor(elapsed / DAY)
  return days < 1 ? '已漂流了不到 1 天' : `已漂流了 ${days} 天`
}

export function formatFlightDuration(value: string): string {
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) return '飞行时间未知'

  const elapsed = Math.max(0, Date.now() - timestamp)
  const days = Math.floor(elapsed / DAY)
  return days < 1 ? '已飞行了不到 1 天' : `已飞行了 ${days} 天`
}
