// CombinedSheetWide renderer for 3- and 4-bit reference schematics.

import type { ReactNode } from "react"
import { bitsDesc, chan157, fmtSel, sub, type Design } from "../../alu/derive"
import {
  Arrow,
  ChipBody,
  Gnd,
  INK,
  NC,
  Net,
  PINS_157,
  pinL,
  pinR,
  Sheet,
  Term,
  Vcc,
  Wires,
  type Chip,
} from "../primitives"
import { tagP } from "./helpers"

export function CombinedSheetWide({ d }: { d: Design }) {
  const n = d.bits
  const M2: Chip = { x: 760, y: 200, w: 210 }
  const L = (p: number) => pinL(M2, p)
  const R = (p: number) => pinR(M2, p)
  const arrowX = 1480

  const topBox = { x: 70, y: 262, w: 200, h: 170 }
  const botBox = { x: 70, y: 452, w: 200, h: 150 }
  const edge = topBox.x + topBox.w
  const logic = { t: "① LOGIC UNIT", s: "(M1 · 74157)", name: (b: number) => `Y${chan157(n, b).name}` }
  const arith = { t: "② ARITHMETIC UNIT", s: `(CM1${n > 2 ? ", CM2" : ""} + 7483)`, name: (b: number) => `Σ${b + 1}` }
  const [top, bot] = d.arithWhen ? [logic, arith] : [arith, logic]

  const paths: number[][][] = []
  const labels: ReactNode[] = []
  const lbl = (k: string, x: number, y: number, t: string) => labels.push(<Net key={k} x={x} y={y} t={t} anchor="start" />)

  const leftBits = bitsDesc(n).slice(0, 2)
  const rightBits = bitsDesc(n).slice(2)

  // channels a/b: top box straight into I0, bottom box jogs up into I1
  leftBits.forEach((bit, j) => {
    const ch = chan157(n, bit)
    const p0 = L(ch.i0)
    paths.push([[edge, p0.y], [p0.x, p0.y]])
    lbl(`t${bit}`, edge + 12, p0.y - 8, `${top.name(bit)} → pin ${ch.i0} (bit ${bit}${tagP(bit, n).replace(" (", ", ").replace(")", "")})`)
    const p1 = L(ch.i1)
    const sy = 470 + 30 * j
    const col = [610, 640][j]
    paths.push([[edge, sy], [col, sy], [col, p1.y], [p1.x, p1.y]])
    lbl(`b${bit}`, edge + 12, sy - 8, `${bot.name(bit)} → pin ${ch.i1} (bit ${bit}${tagP(bit, n).replace(" (", ", ").replace(")", "")})`)
  })

  // channels c/d: over the top of M2 and down the right side
  type Over = { key: string; sy: number; pin: number; text: string }
  const over: Over[] = []
  const byPinDesc = (pins: { bit: number; pin: number }[]) => pins.sort((a, b) => R(b.pin).y - R(a.pin).y)
  byPinDesc(rightBits.map((bit) => ({ bit, pin: chan157(n, bit).i0 }))).forEach(({ bit, pin }, i) =>
    over.push({ key: `t${bit}`, sy: [320, 350][i], pin, text: `${top.name(bit)} → pin ${pin} (bit ${bit}${tagP(bit, n).replace(" (", ", ").replace(")", "")})` }),
  )
  byPinDesc(rightBits.map((bit) => ({ bit, pin: chan157(n, bit).i1 }))).forEach(({ bit, pin }, i) =>
    over.push({ key: `b${bit}`, sy: [530, 560][i], pin, text: `${bot.name(bit)} → pin ${pin} (bit ${bit}${tagP(bit, n).replace(" (", ", ").replace(")", "")})` }),
  )
  over.forEach((o, k) => {
    const xc = 430 + 50 * k
    const ly = 70 + 22 * k
    const xr = 1100 + 40 * (over.length - 1 - k)
    const p = R(o.pin)
    paths.push([[edge, o.sy], [xc, o.sy], [xc, ly], [xr, ly], [xr, p.y], [p.x, p.y]])
    lbl(o.key, edge + 12, o.sy - 8, o.text)
  })

  // unit select
  paths.push([[90, L(1).y], [L(1).ex, L(1).y]])

  // outputs: a/b dropped to bottom lanes, c/d straight out on the right
  const outText = (bit: number, pin: number) => `F${sub(bit)} = ALU output bit ${bit}${tagP(bit, n)} — pin ${pin}`
  leftBits.forEach((bit, j) => {
    const p = L(chan157(n, bit).y)
    const col = [690, 665][j]
    const ly = 640 + 22 * j
    paths.push([[p.x, p.y], [col, p.y], [col, ly], [arrowX, ly]])
    labels.push(
      <g key={`f${bit}`}>
        <Arrow x={arrowX} y={ly} dir="r" />
        <Net x={arrowX - 10} y={ly - 6} t={outText(bit, chan157(n, bit).y)} anchor="end" />
      </g>,
    )
  })
  rightBits.forEach((bit) => {
    const p = R(chan157(n, bit).y)
    paths.push([[p.x, p.y], [arrowX, p.y]])
    labels.push(
      <g key={`f${bit}`}>
        <Arrow x={arrowX} y={p.y} dir="r" />
        <Net x={arrowX - 10} y={p.y - 8} t={outText(bit, chan157(n, bit).y)} anchor="end" />
      </g>,
    )
  })

  const usedRight = new Set(rightBits.flatMap((b) => [chan157(n, b).i0, chan157(n, b).i1, chan157(n, b).y]))

  return (
    <Sheet n="③ Combined ALU" title={`Merge Logic + Arithmetic  (select = ${fmtSel(d.unitLine)})`} note={d.titles.combinedNote} vb="0 0 1560 700">
      <Wires paths={paths} />
      {[
        { b: topBox, ...top },
        { b: botBox, ...bot },
      ].map(({ b, t, s }) => (
        <g key={t}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={6} fill="#fff" stroke={INK} strokeWidth={2.4} strokeDasharray="7 5" />
          <text x={b.x + b.w / 2} y={b.y + b.h / 2 - 8} className="title" fontSize={24} fill={INK} textAnchor="middle">
            {t}
          </text>
          <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 18} className="hand" fontSize={15} fill="#71717a" textAnchor="middle">
            {s}
          </text>
        </g>
      ))}
      <Term x={90} y={L(1).y} label={`${fmtSel(d.unitLine)} (unit select)`} dir="r" />
      <ChipBody c={M2} name="M2" sub="74157" left={PINS_157.left} right={PINS_157.right} />
      <Vcc x={R(16).x} y={R(16).y} dir="r" />
      <Gnd x={R(15).x} y={R(15).y} dir="r" />
      <Gnd x={L(8).x} y={L(8).y} dir="l" />
      {[9, 10, 11, 12, 13, 14]
        .filter((p) => !usedRight.has(p))
        .map((p) => (
          <NC key={p} c={M2} n={p} />
        ))}
      {labels}
    </Sheet>
  )
}
