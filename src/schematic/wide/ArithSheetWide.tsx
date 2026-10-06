// ArithSheetWide renderer for 3- and 4-bit reference schematics.

import type { ReactNode } from "react"
import { ADDER, bitsDesc, cmOf, fmtSel, MUX153, sub, type Design, type Lit } from "../../alu/derive"
import {
  AndG,
  andOut,
  Arrow,
  ChipBody,
  Dot,
  Gnd,
  INK,
  NC,
  Net,
  NotG,
  notOut,
  PINS_153,
  PINS_7483,
  pinAt,
  pinL,
  pinR,
  Sheet,
  Term,
  Vcc,
  Wires,
  type Chip,
} from "../primitives"
import { tag, tagP } from "./helpers"

export function ArithSheetWide({ d }: { d: Design }) {
  const n = d.bits
  const CMs: Chip[] = [
    { x: 470, y: 130, w: 210 },
    { x: 470, y: 610, w: 210 },
  ]
  const AD: Chip = { x: 1250, y: 350, w: 210 }
  const A = (p: number) => pinAt(AD, p)
  const busY = 84
  const topRail = 104
  const s0drop = 740
  const notL = 350 // B′ inverter for channel a (faces right)
  const notR = 830 // B′ inverter for channel b (faces left)
  const arrowX = 1720
  const andY = 1070
  const gx = 760
  const cinRiser = 1640

  // far-left: channel-a B buses (CM1, CM2), then HI / LO select buses
  const HI = 200
  const LO = 250
  const busA = [100, 150]
  const railB = [870, 910]

  const paths: number[][][] = []
  const dots: number[][] = []
  const gates: ReactNode[] = []
  const labels: ReactNode[] = []
  const power: ReactNode[] = []
  const terms: ReactNode[] = []

  const bitOf = (chip: number, ch: number) => bitsDesc(n).find((b) => cmOf(n, b).chip === chip && cmOf(n, b).ch === ch)

  // ---- carry-in source decides where HI / LO buses end -------------------
  const cin = d.cin
  let hiIn: number | null = null
  let loIn: number | null = null
  if (cin.kind === "lit") {
    if (cin.lit.line === d.hi) hiIn = andY
    else loIn = andY
  } else if (cin.kind === "and" || cin.kind === "sop") {
    hiIn = andY - 8
    loIn = andY + 8
  }
  const cm2p2 = pinL(CMs[1], 2).y
  paths.push([[HI, busY], [HI, hiIn ?? cm2p2]])
  paths.push([[LO, busY], [LO, loIn ?? topRail]])
  terms.push(<Term key="hi" x={HI} y={busY} label={fmtSel(d.hi)} dir="u" note="B sel" />)
  terms.push(<Term key="lo" x={LO} y={busY} label={fmtSel(d.lo)} dir="u" note="A sel" />)

  // LO over the top to pin 14 of both 74153s
  paths.push([[LO, topRail], [s0drop, topRail], [s0drop, pinR(CMs[1], 14).y], [pinR(CMs[1], 14).x, pinR(CMs[1], 14).y]])
  paths.push([[s0drop, pinR(CMs[0], 14).y], [pinR(CMs[0], 14).x, pinR(CMs[0], 14).y]])
  dots.push([s0drop, pinR(CMs[0], 14).y])
  if (loIn) dots.push([LO, topRail])
  labels.push(<Net key="s0" x={s0drop + 8} y={topRail - 6} t={fmtSel(d.lo)} anchor="start" />)

  // ---- both 74153s --------------------------------------------------------
  CMs.forEach((c, chip) => {
    const p2 = pinL(c, 2)
    paths.push([[HI, p2.y], [p2.x, p2.y]])
    if ((hiIn ?? cm2p2) > p2.y) dots.push([HI, p2.y])
    power.push(
      <g key={`pw${chip}`}>
        <Gnd x={pinL(c, 1).x} y={pinL(c, 1).y} dir="l" />
        <Gnd x={pinL(c, 8).x} y={pinL(c, 8).y} dir="l" />
        <Vcc x={pinR(c, 16).x} y={pinR(c, 16).y} dir="r" />
        <Gnd x={pinR(c, 15).x} y={pinR(c, 15).y} dir="r" />
      </g>,
    )

    MUX153.forEach((ch, ci) => {
      const bit = bitOf(chip, ci)
      const left = ci === 0
      const pin = (p: number) => (left ? pinL(c, p) : pinR(c, p))
      if (bit === undefined) {
        // unused channel (3-bit ALU, CM2 b): tie data low, output open
        ch.d.forEach((p) => power.push(<Gnd key={`u${chip}${p}`} x={pin(p).x} y={pin(p).y} dir={left ? "l" : "r"} />))
        power.push(<NC key={`unc${chip}`} c={c} n={ch.y} />)
        return
      }
      const src = left ? busA[chip] : railB[chip]
      const ys: number[] = []
      ch.d.forEach((p, i) => {
        const b = d.cm1[i]
        const { x, y } = pin(p)
        if (b === "0") power.push(<Gnd key={`d${chip}${p}`} x={x} y={y} dir={left ? "l" : "r"} />)
        else if (b === "1") power.push(<Vcc key={`d${chip}${p}`} x={x} y={y} dir={left ? "l" : "r"} />)
        else {
          ys.push(y)
          dots.push([src, y])
          if (b === "B") paths.push([[src, y], [x, y]])
          else {
            const nx = left ? notL : notR
            paths.push([[src, y], [nx, y]], [[notOut(nx, y, left ? "r" : "l")[0], y], [x, y]])
            gates.push(<NotG key={`n${chip}${p}`} x={nx} y={y} facing={left ? "r" : "l"} />)
            labels.push(
              <Net key={`nl${chip}${p}`} x={left ? x - 8 : x + 6} y={y - 8} t={`B${sub(bit)}′`} anchor={left ? "end" : "start"} />,
            )
          }
        }
      })
      if (ys.length) {
        paths.push([[src, busY], [src, Math.max(...ys)]])
        // the lowest tap is the bus end (a corner), not a junction
        const end = Math.max(...ys)
        const k = dots.findIndex(([x, y]) => x === src && y === end)
        if (k >= 0) dots.splice(k, 1)
      }
      terms.push(<Term key={`b${bit}`} x={src} y={busY} label={`B${sub(bit)}`} dir="u" note={tag(bit, n)} />)
    })
  })

  // ---- MUX outputs → adder B inputs ----------------------------------------
  type Route = { bit: number; left: boolean; sx: number; sy: number; destLeft: boolean; dy: number }
  const routes: Route[] = bitsDesc(n).map((bit) => {
    const { chip, ch } = cmOf(n, bit)
    const left = ch === 0
    const s = left ? pinL(CMs[chip], 7) : pinR(CMs[chip], 9)
    const dp = A(ADDER.b[bit])
    return { bit, left, sx: s.x, sy: s.y, destLeft: ADDER.b[bit] <= 8, dy: dp.y }
  })
  const gapX = new Map<number, number>()
  routes
    .filter((r) => r.destLeft)
    .sort((a, b) => a.dy - b.dy)
    .forEach((r, i) => gapX.set(r.bit, [960, 990][i]))
  const rightX = new Map<number, number>()
  routes
    .filter((r) => !r.destLeft)
    .sort((a, b) => +a.left - +b.left)
    .forEach((r, i) => rightX.set(r.bit, [1560, 1600][i]))
  const drop = new Map<number, [number, number]>()
  routes
    .filter((r) => r.left)
    .sort((a, b) => b.sy - a.sy)
    .forEach((r, i) => drop.set(r.bit, ([[310, 980], [280, 1010]] as [number, number][])[i]))

  for (const r of routes) {
    const rx = r.destLeft ? gapX.get(r.bit)! : rightX.get(r.bit)!
    const end = r.destLeft ? A(ADDER.b[r.bit]).x : A(ADDER.b[r.bit]).x
    const { chip, ch } = cmOf(n, r.bit)
    const yName = `Y${sub(r.bit)}`
    const full = `${yName} (CM${chip + 1} pin ${MUX153[ch].y} → adder pin ${ADDER.b[r.bit]})`
    if (r.left) {
      const [dx, ly] = drop.get(r.bit)!
      paths.push([[r.sx, r.sy], [dx, r.sy], [dx, ly], [rx, ly], [rx, r.dy], [end, r.dy]])
      labels.push(<Net key={`y${r.bit}`} x={dx + 20} y={ly - 7} t={full} anchor="start" />)
    } else {
      paths.push([[r.sx, r.sy], [rx, r.sy], [rx, r.dy], [end, r.dy]])
      labels.push(<Net key={`y${r.bit}`} x={r.sx + 22} y={r.sy - 8} t={yName} anchor="start" />)
    }
  }

  // ---- A inputs ------------------------------------------------------------
  const aRails = [1030, 1075, 1120]
  bitsDesc(n)
    .filter((b) => b > 0)
    .forEach((bit, i) => {
      const p = A(ADDER.a[bit])
      paths.push([[aRails[i], busY], [aRails[i], p.y], [p.x, p.y]])
      terms.push(<Term key={`a${bit}`} x={aRails[i]} y={busY} label={`A${sub(bit)}`} dir="u" note={tag(bit, n)} />)
    })
  const a0 = A(ADDER.a[0])
  paths.push([[a0.x, a0.y], [arrowX, a0.y]])
  terms.push(<Term key="a0" x={arrowX} y={a0.y} label="A₀ (LSB)" dir="r" />)

  // ---- Σ outputs → M2 ------------------------------------------------------
  const sumLeft = bitsDesc(n)
    .filter((b) => ADDER.s[b] <= 8)
    .sort((a, b) => A(ADDER.s[a]).y - A(ADDER.s[b]).y)
  sumLeft.forEach((bit, i) => {
    const p = A(ADDER.s[bit])
    const rx = [1170, 1188][i]
    const ly = [112, 124][i]
    paths.push([[p.x, p.y], [rx, p.y], [rx, ly], [arrowX, ly]])
    labels.push(
      <g key={`s${bit}`}>
        <Arrow x={arrowX} y={ly} dir="r" />
        <Net
          x={arrowX}
          y={i === 0 ? ly - 8 : ly + 20}
          t={`Σ${bit + 1} → M2 pin ${d.m2.arith[bit]} — arith bit ${bit}${tagP(bit, n)}`}
          anchor="end"
        />
      </g>,
    )
  })
  bitsDesc(n)
    .filter((b) => ADDER.s[b] > 8)
    .forEach((bit) => {
      const p = A(ADDER.s[bit])
      paths.push([[p.x, p.y], [arrowX, p.y]])
      labels.push(
        <g key={`s${bit}`}>
          <Arrow x={arrowX} y={p.y} dir="r" />
          <Net x={arrowX} y={p.y + 22} t={`Σ${bit + 1} → M2 pin ${d.m2.arith[bit]} — arith bit ${bit}${tagP(bit, n)}`} anchor="end" />
        </g>,
      )
    })

  // ---- adder unused bits + power ---------------------------------------------
  for (let b = n; b < 4; b++) {
    const pa = A(ADDER.a[b])
    const pb = A(ADDER.b[b])
    power.push(<Gnd key={`ga${b}`} x={pa.x} y={pa.y} dir={ADDER.a[b] <= 8 ? "l" : "r"} />)
    power.push(<Gnd key={`gb${b}`} x={pb.x} y={pb.y} dir={ADDER.b[b] <= 8 ? "l" : "r"} />)
    power.push(<NC key={`ns${b}`} c={AD} n={ADDER.s[b]} text={`N/C (Σ${b + 1})`} />)
  }
  power.push(
    <g key="adp">
      <Vcc x={A(5).x} y={A(5).y} dir="l" />
      <Gnd x={A(12).x} y={A(12).y} dir="r" />
      <NC c={AD} n={14} text="N/C (Cout)" />
    </g>,
  )

  // ---- carry-in --------------------------------------------------------------
  const busX = (l: Lit["line"]) => (l === d.hi ? HI : LO)
  const andPos = cin.kind === "and" && !cin.a.neg && !cin.b.neg
  const c13 = A(13)
  if (cin.kind === "const")
    power.push(cin.value ? <Vcc key="cin" x={c13.x} y={c13.y} dir="r" /> : <Gnd key="cin" x={c13.x} y={c13.y} dir="r" />)
  else {
    let out: number
    if (cin.kind === "lit" && !cin.lit.neg) out = busX(cin.lit.line)
    else if (cin.kind === "lit") {
      paths.push([[busX(cin.lit.line), andY], [gx, andY]])
      gates.push(<NotG key="cinn" x={gx} y={andY} />)
      out = notOut(gx, andY)[0]
    } else {
      paths.push([[HI, andY - 8], [gx, andY - 8]], [[LO, andY + 8], [gx, andY + 8]])
      labels.push(
        <g key="cinl">
          <text x={gx - 14} y={andY - 12} className="hand" fontSize={13} fill={INK} textAnchor="end">
            {fmtSel(d.hi)}
          </text>
          <text x={gx - 14} y={andY + 18} className="hand" fontSize={13} fill={INK} textAnchor="end">
            {fmtSel(d.lo)}
          </text>
        </g>,
      )
      if (andPos) {
        gates.push(<AndG key="cing" x={gx} y={andY} />)
        out = andOut(gx, andY)[0]
      } else {
        gates.push(
          <g key="cing">
            <rect x={gx} y={andY - 22} width={110} height={44} rx={4} fill="#fff" stroke={INK} strokeWidth={2} />
            <text x={gx + 55} y={andY + 5} className="hand" fontSize={14} fill={INK} textAnchor="middle">
              {d.cinText}
            </text>
          </g>,
        )
        out = gx + 110
      }
    }
    paths.push([[out, andY], [cinRiser, andY], [cinRiser, c13.y], [c13.x, c13.y]])
    labels.push(<Net key="cint" x={Math.max(out, gx + 32) + 10} y={andY - 8} t={`Cin = ${d.cinText}`} anchor="start" />)
  }

  return (
    <Sheet n="② Arithmetic Unit" title={d.titles.arith} note={d.titles.arithNote} vb="0 0 1820 1130">
      <Wires paths={paths} />
      {gates}
      {dots.map(([x, y]) => (
        <Dot key={`${x},${y}`} x={x} y={y} />
      ))}
      {CMs.map((c, i) => (
        <ChipBody
          key={i}
          c={c}
          name={`CM${i + 1}`}
          sub={`74153 · bit ${bitsDesc(n)
            .filter((b) => cmOf(n, b).chip === i)
            .join("–")}`}
          left={PINS_153.left}
          right={PINS_153.right}
        />
      ))}
      <ChipBody c={AD} name="Z" sub="7483 adder" left={PINS_7483.left} right={PINS_7483.right} />
      {power}
      {terms}
      {labels}
    </Sheet>
  )
}
