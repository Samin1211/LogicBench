/* ============================================================================
   Automatic detailed schematic for any solved design.

   Every part is drawn as a logic symbol with real pin numbers: inputs on the
   left, outputs on the right, VCC on top, GND below. Parts are placed in
   columns by signal depth (inputs → … → F) and ordered inside each column to
   follow their drivers. A net whose driver and loads sit in neighbouring
   columns is drawn as a wire in the channel between them; every other net
   (A/B/select inputs, long or fan-out-across-columns nets) is joined by a
   matching label on each pin stub.
   ========================================================================== */

import type { ReactNode } from "react"
import { CHIPS } from "../engine/chips"
import type { Design, Part } from "../engine/solve"
import { Dot, INK, RED, Sheet, Wires } from "./primitives"

const PITCH = 26
const BODY_W = 150
const STUB = 34
const HEAD = 34 // body top → first pin
const GAP_Y = 84
const TRACK = 14
const DIM = "#71717a"
const charW = 7.4

type Pin = { pin: string; name: string; net: string }
type Node = {
  part: Part
  left: Pin[]
  right: Pin[]
  vcc?: Pin
  gnd?: Pin
  col: number
  h: number
  x: number
  y: number
}

const SELECT_PINS: Record<string, string[]> = {
  "74157": ["1", "15"], "74153": ["2", "14", "1", "15"], "74151": ["9", "10", "11", "7"], "74150": ["11", "13", "14", "15", "9"],
}

function symbolPins(part: Part) {
  const def = CHIPS[part.type]
  const outs = new Set(Object.keys(def.model(() => 0)))
  const byName = (a: Pin, b: Pin) => a.name.localeCompare(b.name, undefined, { numeric: true })
  const left: Pin[] = []
  const right: Pin[] = []
  let vcc: Pin | undefined
  let gnd: Pin | undefined
  for (const [pin, net] of Object.entries(part.pins)) {
    const p = { pin, net, name: def.pinNames[pin] ?? "" }
    if (def.vcc && pin === String(def.vcc)) vcc = { ...p, name: "VCC" }
    else if (def.gnd && pin === String(def.gnd)) gnd = { ...p, name: "GND" }
    else (outs.has(pin) ? right : left).push(p)
  }
  const sel = SELECT_PINS[part.type] ?? []
  const rank = (p: Pin) => (sel.includes(p.pin) ? 1 + sel.indexOf(p.pin) : 0)
  left.sort((a, b) => rank(a) - rank(b) || byName(a, b))
  right.sort(byName)
  return { left, right, vcc, gnd }
}

function layout(parts: Part[], text: (net: string) => string) {
  const labelW = (net: string) => text(net).length * charW + 10
  const driver = new Map<string, { part: Part; pin: string }>()
  for (const part of parts) {
    const outs = Object.keys(CHIPS[part.type].model(() => 0))
    for (const pin of outs) if (part.pins[pin]) driver.set(part.pins[pin], { part, pin })
  }

  // column = longest path from the primary inputs
  const depth = new Map<string, number>()
  const depthOf = (part: Part): number => {
    if (depth.has(part.id)) return depth.get(part.id)!
    depth.set(part.id, 0) // cycle guard
    const outs = new Set(Object.keys(CHIPS[part.type].model(() => 0)))
    let dd = 0
    for (const [pin, net] of Object.entries(part.pins)) {
      if (outs.has(pin)) continue
      const drv = driver.get(net)
      if (drv && drv.part !== part) dd = Math.max(dd, depthOf(drv.part) + 1)
    }
    depth.set(part.id, dd)
    return dd
  }

  const nodes: Node[] = parts.map((part) => {
    const s = symbolPins(part)
    const rows = Math.max(s.left.length, s.right.length, 1)
    return { part, ...s, col: depthOf(part), h: HEAD + rows * PITCH + 4, x: 0, y: 0 }
  })
  const byId = new Map(nodes.map((n) => [n.part.id, n]))
  const nCols = Math.max(...nodes.map((n) => n.col)) + 1
  const cols: Node[][] = Array.from({ length: nCols }, () => [])
  for (const n of nodes) cols[n.col].push(n)

  const leftY = (n: Node, j: number) => n.y + HEAD + j * PITCH
  const rightY = (n: Node, j: number) => n.y + HEAD + j * PITCH + ((Math.max(n.left.length, n.right.length) - n.right.length) * PITCH) / 2

  // which nets are wired: one driver in column c, every load on a left pin in column c+1
  const loads = new Map<string, { node: Node; j: number }[]>()
  for (const n of nodes) n.left.forEach((p, j) => loads.set(p.net, [...(loads.get(p.net) ?? []), { node: n, j }]))
  const allUses = new Map<string, number>()
  for (const n of nodes) for (const net of Object.values(n.part.pins)) allUses.set(net, (allUses.get(net) ?? 0) + 1)
  const wired = new Set<string>()
  for (const [net, drv] of driver) {
    const ls = loads.get(net) ?? []
    const dn = byId.get(drv.part.id)!
    if (net === "VCC" || net === "GND" || !ls.length) continue
    if (allUses.get(net) !== ls.length + 1) continue
    if (ls.every((l) => l.node.col === dn.col + 1)) wired.add(net)
  }

  // vertical order: column 0 by role, later columns by the mean y of their drivers
  cols[0].sort((a, b) => a.part.role.localeCompare(b.part.role) || a.part.id.localeCompare(b.part.id, undefined, { numeric: true }))
  const place = (col: Node[]) => {
    let y = 0
    for (const n of col) (n.y = y), (y += n.h + GAP_Y)
    return y - GAP_Y
  }
  const heights: number[] = []
  heights[0] = place(cols[0])
  for (let c = 1; c < nCols; c++) {
    const key = (n: Node) => {
      const ys: number[] = []
      for (const p of n.left) {
        const drv = driver.get(p.net)
        const dn = drv && byId.get(drv.part.id)
        if (dn && dn.col < c) ys.push(rightY(dn, dn.right.findIndex((r) => r.pin === drv!.pin)))
      }
      return ys.length ? ys.reduce((a, b) => a + b) / ys.length : 1e9
    }
    const keys = new Map(cols[c].map((n) => [n, key(n)]))
    cols[c].sort((a, b) => keys.get(a)! - keys.get(b)!)
    heights[c] = place(cols[c])
  }
  const sheetH = Math.max(...heights)
  for (let c = 0; c < nCols; c++) {
    const off = (sheetH - heights[c]) / 2
    for (const n of cols[c]) n.y += off + 70
  }

  // horizontal: label room left, body, label room right, then the wiring channel
  const tracks: string[][] = Array.from({ length: nCols }, () => [])
  for (const net of wired) tracks[byId.get(driver.get(net)!.part.id)!.col].push(net)
  let x = 30
  const colX: number[] = []
  const lws: number[] = []
  const rws: number[] = []
  for (let c = 0; c < nCols; c++) {
    const lw = Math.max(0, ...cols[c].flatMap((n) => n.left.filter((p) => !wired.has(p.net)).map((p) => labelW(p.net))))
    lws[c] = lw
    x += lw + STUB
    colX[c] = x
    for (const n of cols[c]) n.x = x
    x += BODY_W + STUB
    const rw = Math.max(0, ...cols[c].flatMap((n) => n.right.map((p) => (wired.has(p.net) ? 0.8 : 1) * labelW(p.net))))
    rws[c] = rw
    x += Math.max(rw, 10) + (tracks[c].length ? tracks[c].length * TRACK + 30 : 20)
  }
  const width = x + 20
  const height = sheetH + 160

  // wires through each channel; tracks ordered by driver y so verticals rarely cross
  const paths: number[][][] = []
  const dots: [number, number][] = []
  for (let c = 0; c < nCols; c++) {
    const nets = tracks[c]
      .map((net) => {
        const drv = driver.get(net)!
        const dn = byId.get(drv.part.id)!
        return { net, dn, y: rightY(dn, dn.right.findIndex((r) => r.pin === drv.pin)) }
      })
      .sort((a, b) => a.y - b.y)
    const x0 = colX[c] + BODY_W + STUB
    const x1 = c + 1 < nCols ? colX[c + 1] - STUB : x0 + 40
    nets.forEach(({ net, y }, t) => {
      const a = x0 + rws[c] + 10
      const b = x1 - (c + 1 < nCols ? lws[c + 1] : 0) - 10
      const tx = Math.round(a + (t + 0.5) * ((b - a) / nets.length))
      const ls = loads.get(net)!.map((l) => leftY(l.node, l.j))
      paths.push([[x0, y], [tx, y]])
      const ys = [y, ...ls]
      const lo = Math.min(...ys)
      const hi = Math.max(...ys)
      if (hi > lo) paths.push([[tx, lo], [tx, hi]])
      for (const ly of ls) {
        paths.push([[tx, ly], [x1, ly]])
        if (ly > lo && ly < hi) dots.push([tx, ly])
      }
      if (y > lo && y < hi) dots.push([tx, y])
    })
  }

  return { nodes, wired, paths, dots, width, height, leftY, rightY }
}

const T = ({ x, y, t, a = "start", size = 13, color = INK, w = 500, mono }: { x: number; y: number; t: string; a?: "start" | "end" | "middle"; size?: number; color?: string; w?: number; mono?: boolean }) => (
  <text x={x} y={y} fontSize={size} fill={color} fontWeight={w} textAnchor={a} dominantBaseline="middle" className={mono ? "num" : "hand"}>
    {t}
  </text>
)

/** Bits a part serves, read from its bit-indexed nets (A3, Σ3, A3·B3, F3…). */
function bitsOf(part: Part, lines: string[]) {
  const bits = new Set<number>()
  for (const net of Object.values(part.pins)) {
    if (lines.includes(net)) continue
    for (const m of net.matchAll(/(?:^|[^A-Za-z])[ABXYFLΣ](\d+)/g)) bits.add(+m[1])
    const c = net.match(/^C(\d+)$/)
    if (c) bits.add(+c[1])
  }
  return [...bits]
}

const MAX_CHIPS = 12

/** Split the parts into sheets of consecutive bits; shared logic goes on the first sheet. */
function paginate(d: Design) {
  const n = d.problem.bits
  const key = d.parts.map((p) => {
    const b = bitsOf(p, d.problem.lines)
    return b.length ? Math.min(...b) : -1
  })
  for (const g of [n, 4, 2, 1]) {
    const groups = Math.ceil(n / g)
    const sheets: Part[][] = Array.from({ length: groups }, () => [])
    d.parts.forEach((p, i) => sheets[key[i] < 0 ? 0 : Math.floor(key[i] / g)].push(p))
    if (g === 1 || sheets.every((s) => s.length <= MAX_CHIPS))
      return sheets
        .map((parts, k) => ({ parts, lo: k * g, hi: Math.min(n, (k + 1) * g) - 1 }))
        .filter((s) => s.parts.length)
  }
  return [{ parts: d.parts, lo: 0, hi: n - 1 }]
}

export function AutoSchematic({ d }: { d: Design }) {
  const sheets = paginate(d)
  // where each driven net appears, so labels can point to the other sheet
  const driven = new Set<string>()
  for (const p of d.parts) for (const pin of Object.keys(CHIPS[p.type].model(() => 0))) if (p.pins[pin]) driven.add(p.pins[pin])
  const onSheets = new Map<string, Set<number>>()
  sheets.forEach((s, k) => s.parts.forEach((p) => Object.values(p.pins).forEach((net) => onSheets.set(net, (onSheets.get(net) ?? new Set()).add(k + 1)))))
  return (
    <>
      {sheets.map((s, k) => {
        const text = (net: string) => {
          const other = driven.has(net) ? [...(onSheets.get(net) ?? [])].filter((q) => q !== k + 1) : []
          return other.length ? `${net} ↗${other.join(",")}` : net
        }
        const range = s.lo === s.hi ? `bit ${s.lo}` : `bits ${s.lo}–${s.hi}`
        return (
          <OneSheet
            key={k}
            parts={s.parts}
            text={text}
            n={sheets.length > 1 ? `Sheet ${k + 1}/${sheets.length}` : "Schematic"}
            title={sheets.length > 1 ? `${range}${k === 0 ? " · shared logic" : ""}` : d.problem.title}
            note={sheets.length > 1 ? "↗n = signal continues on sheet n · matching labels are connected" : "pin numbers on every stub · matching labels are connected"}
          />
        )
      })}
    </>
  )
}

function OneSheet({ parts, text, n: sheetN, title, note }: { parts: Part[]; text: (net: string) => string; n: string; title: string; note: string }) {
  const L = layout(parts, text)
  const el: ReactNode[] = []
  for (const n of L.nodes) {
    const { x, y, h, part } = n
    const def = CHIPS[part.type]
    el.push(
      <rect key={`${part.id}b`} x={x} y={y} width={BODY_W} height={h} rx={4} fill="#fff" stroke={INK} strokeWidth={1.8} />,
      <T key={`${part.id}t`} x={x} y={y - 26} t={`${part.id}  ${def.pins ? def.name : "FA"}`} w={600} color={RED} />,
      <T key={`${part.id}r`} x={x} y={y - 12} t={part.role} size={11} color={DIM} />,
    )
    const pin = (p: Pin, side: "l" | "r", py: number) => {
      const sx = side === "l" ? x - STUB : x + BODY_W
      const k = `${part.id}.${p.pin}`
      el.push(<line key={k} x1={sx} y1={py} x2={sx + STUB} y2={py} stroke={INK} strokeWidth={1.6} />)
      if (def.pins) el.push(<T key={`${k}n`} x={side === "l" ? x - 5 : x + BODY_W + 5} y={py - 8} t={p.pin} size={10} a={side === "l" ? "end" : "start"} color={DIM} mono />)
      el.push(<T key={`${k}f`} x={side === "l" ? x + 7 : x + BODY_W - 7} y={py} t={p.name} size={11.5} a={side === "l" ? "start" : "end"} color={DIM} />)
      if (L.wired.has(p.net)) {
        if (side === "r") el.push(<T key={`${k}w`} x={x + BODY_W + STUB + 4} y={py - 8} t={p.net} size={10.5} color={RED} />)
      } else {
        const tie = p.net === "VCC" || p.net === "GND"
        el.push(<T key={`${k}l`} x={side === "l" ? x - STUB - 5 : x + BODY_W + STUB + 5} y={py} t={text(p.net)} a={side === "l" ? "end" : "start"} w={side === "r" ? 600 : 500} color={tie ? DIM : INK} />)
      }
    }
    n.left.forEach((p, j) => pin(p, "l", L.leftY(n, j)))
    n.right.forEach((p, j) => pin(p, "r", L.rightY(n, j)))
    if (n.vcc || n.gnd)
      el.push(
        <T key={`${part.id}pw`} x={x + BODY_W - 6} y={y + 14} t={`VCC ${def.vcc} · GND ${def.gnd}`} size={10} a="end" color="#a1a1aa" mono />,
      )
  }

  return (
    <Sheet n={sheetN} title={title} note={note} vb={`0 0 ${L.width} ${L.height}`}>
      <Wires paths={L.paths} />
      {L.dots.map(([x, y], i) => (
        <Dot key={i} x={x} y={y} />
      ))}
      {el}
    </Sheet>
  )
}
