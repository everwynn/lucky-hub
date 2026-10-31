export interface Draw {
  code: string;
  date: string;
  red: number[];
  blue: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function formatDraw(d: Draw): string {
  return `${d.red.map(pad).join(' ')} | ${pad(d.blue)}`;
}

export function toShanghai(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}
