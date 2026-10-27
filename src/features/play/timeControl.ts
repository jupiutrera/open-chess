export interface TimeControl {
  id: string
  label: string
  /** seconds; 0 = no clock */
  base: number
  /** seconds added per move */
  inc: number
}

export const TIME_CONTROLS: TimeControl[] = [
  { id: 'none', label: '∞', base: 0, inc: 0 },
  { id: '1+0', label: '1 min', base: 60, inc: 0 },
  { id: '3+2', label: '3 | 2', base: 180, inc: 2 },
  { id: '5+0', label: '5 min', base: 300, inc: 0 },
  { id: '10+0', label: '10 min', base: 600, inc: 0 },
  { id: '15+10', label: '15 | 10', base: 900, inc: 10 },
  { id: '30+0', label: '30 min', base: 1800, inc: 0 },
]

/** A preset, or any "minutes+increment" id (custom clocks); unknown ids mean no clock. */
export function timeControl(id: string | null | undefined): TimeControl {
  const preset = TIME_CONTROLS.find((c) => c.id === id)
  if (preset) return preset
  const m = /^(\d{1,3})\+(\d{1,2})$/.exec(id ?? '')
  if (m) {
    const min = Math.min(180, Math.max(1, Number(m[1])))
    const inc = Math.min(60, Number(m[2]))
    return { id: `${min}+${inc}`, label: inc ? `${min} | ${inc}` : `${min} min`, base: min * 60, inc }
  }
  return TIME_CONTROLS[0]
}
