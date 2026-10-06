// LogicSheetWide renderer for 3- and 4-bit reference schematics.

import type { ReactNode } from "react"
import { bitExpr, bitsDesc, chan157, compact, fmtSel, sub, type Design } from "../../alu/derive"
import { LOGIC_OPS } from "../../alu/spec"
import {
  Arrow,
  BinGate,
  binOut,
  ChipBody,
  Dot,
  Gnd,
  Mirror,
  NC,
  Net,
  NotG,
  notOut,
  PINS_157,
  pinL,
  pinR,
  Sheet,
  Term,
  Vcc,
  Wires,
  type Chip,
  type Gate2,
} from "../primitives"
import { tag, tagP } from "./helpers"

export function LogicSheetWide({ d }: { d: Design }) {
  const n = d.bits
  const M1: Chip = { x: 980, y: 110, w: 200 }
  const L = (p: number) => pinL(M1, p)
  const R = (p: number) => pinR(M1, p)
  const busY = 84
  const bottom = 470
  const arrowX = 1660

  // input buses: channels a/b on the left, c/d mirrored on the right
  const SEL = 300
  const busA: Record<number, number> = {}
  const busB: Record<number, number> = {}
  const leftX = [
    [90, 140],
    [190, 240],
  ]
  const rightX = [
    [1520, 1470],
    [1620, 1570],
  ]
  bitsDesc(n).forEach((bit, j) => {
    const [ax, bx] = j < 2 ? leftX[j] : rightX[j - 2]
    busA[bit] = ax
    busB[bit] = bx
  })

  const paths: number[][][] = []
  const dots: number[][] = []
  const gates: ReactNode[] = []
  const labels: ReactNode[] = []

  for (const x of [...Object.values(busA), ...Object.values(busB), SEL]) paths.push([[x, busY], [x, bottom]])
  paths.push([[SEL, L(1).y], [L(1).x, L(1).y]])
  dots.push([SEL, L(1).y])

  // one gate per M1 data input
  for (const bit of bitsDesc(n)) {
    const ch = chan157(n, bit)
    for (const [op, pin] of [
      [d.logic.in0, ch.i0],
      [d.logic.in1, ch.i1],
    ] as const) {
      const def = LOGIC_OPS[op]
      const right = pin > 8
      const p = right ? R(pin) : L(pin)
      const y = p.y
      const t = compact(bitExpr(def.out, bit))
      const ax = busA[bit]
      const bx = busB[bit]
      const gx = right ? 1400 : def.src === "AB" ? 616 : 620
      let out: number
      if (def.gate === "BUF") {
        const sx = def.src === "A" ? ax : bx
        paths.push([[sx, y], [p.x, y]])
        dots.push([sx, y])
        out = right ? 1360 : 660
      } else if (def.src !== "AB") {
        const sx = def.src === "A" ? ax : bx
        paths.push([[sx, y], [gx, y]])
        dots.push([sx, y])
        gates.push(<NotG key={`g${pin}`} x={gx} y={y} facing={right ? "l" : "r"} />)
        out = notOut(gx, y, right ? "l" : "r")[0]
        paths.push([[out, y], [p.x, y]])
      } else {
        const g = def.gate as Gate2
        paths.push([[ax, y - 8], [gx, y - 8]], [[bx, y + 8], [gx, y + 8]])
        dots.push([ax, y - 8], [bx, y + 8])
        gates.push(
          right ? (
            <Mirror key={`g${pin}`} x={gx}>
              <BinGate x={gx} y={y} g={g} />
            </Mirror>
          ) : (
            <BinGate key={`g${pin}`} x={gx} y={y} g={g} />
          ),
        )
        out = right ? 2 * gx - binOut(gx, g) : binOut(gx, g)
        paths.push([[out, y], [p.x, y]])
      }
      labels.push(
        right ? (
          <Net key={`n${pin}`} x={out - 8} y={y - 8} t={t} anchor="end" />
        ) : (
          <Net key={`n${pin}`} x={out + (def.src === "AB" ? 66 : 62)} y={y - 8} t={t} />
        ),
      )
    }
  }

  // outputs → M2, each dropped to its own bottom lane (MSB on top)
  const cols = [910, 872, 1288, 1250]
  bitsDesc(n).forEach((bit, j) => {
    const ch = chan157(n, bit)
    const p = j < 2 ? L(ch.y) : R(ch.y)
    const laneY = 500 + 22 * j
    paths.push([[p.x, p.y], [cols[j], p.y], [cols[j], laneY], [arrowX, laneY]])
    labels.push(
      <g key={`o${bit}`}>
        <Arrow x={arrowX} y={laneY} dir="r" />
        <Net x={arrowX - 14} y={laneY - 6} t={`Y${ch.name} → M2 pin ${d.m2.logic[bit]} — logic bit ${bit}${tagP(bit, n)}`} anchor="end" />
      </g>,
    )
  })

  const usedRight = new Set(bitsDesc(n).flatMap((b) => (chan157(n, b).i0 > 8 ? [chan157(n, b).i0, chan157(n, b).i1, chan157(n, b).y] : [])))

  return (
    <Sheet n="① Logic Unit" title={d.titles.logic} note={d.titles.logicNote} vb="0 0 1720 600">
      <Wires paths={paths} />
      {gates}
      {bitsDesc(n).map((bit) => (
        <g key={bit}>
          <Term x={busA[bit]} y={busY} label={`A${sub(bit)}`} dir="u" note={tag(bit, n)} />
          <Term x={busB[bit]} y={busY} label={`B${sub(bit)}`} dir="u" note={tag(bit, n)} />
        </g>
      ))}
      <Term x={SEL} y={busY} label={fmtSel(d.logic.sel)} dir="u" note="select" />
      {dots.map(([x, y]) => (
        <Dot key={`${x},${y}`} x={x} y={y} />
      ))}
      <ChipBody c={M1} name="M1" sub="74157" left={PINS_157.left} right={PINS_157.right} />
      <Vcc x={R(16).x} y={R(16).y} dir="r" />
      <Gnd x={R(15).x} y={R(15).y} dir="r" />
      <Gnd x={L(8).x} y={L(8).y} dir="l" />
      {[9, 10, 11, 12, 13, 14]
        .filter((p) => !usedRight.has(p))
        .map((p) => (
          <NC key={p} c={M1} n={p} />
        ))}
      {labels}
    </Sheet>
  )
}
