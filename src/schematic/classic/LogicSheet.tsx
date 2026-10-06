// LogicSheet for the 2-bit reference schematic.

import { LOGIC_OPS } from "../../alu/spec"
import { bitExpr, compact, fmtSel, type Design } from "../../alu/derive"
import {
  Arrow,
  BinGate,
  binOut,
  ChipBody,
  Dot,
  Gnd,
  HW,
  Net,
  NotG,
  notOut,
  pinL,
  pinR,
  Sheet,
  Term,
  Vcc,
  VW,
  W,
  type Chip,
  type Gate2,
} from "../primitives"

export function LogicSheet({ d }: { d: Design }) {
  const M1: Chip = { x: 980, y: 110, w: 200 }
  const L = (n: number) => pinL(M1, n)
  const R = (n: number) => pinR(M1, n)

  // far-left vertical buses
  const A1 = 90,
    B1 = 140,
    A0 = 190,
    B0 = 240,
    S2 = 300
  const buses = [A1, B1, A0, B0, S2]
  const rightOf = (x: number) => buses.filter((b) => b > x)
  const busY = 64
  const bottom = 470

  // M1 data slots: [I0, I1] per bit, aligned to M1 pin heights
  const slots = [
    { op: d.logic.in0, bit: 1, pin: 2 },
    { op: d.logic.in1, bit: 1, pin: 3 },
    { op: d.logic.in0, bit: 0, pin: 5 },
    { op: d.logic.in1, bit: 0, pin: 6 },
  ]
  const notX = 620,
    gateX = 616

  return (
    <Sheet
      n="① Logic Unit"
      title={d.titles.logic}
      note={d.titles.logicNote}
      vb="0 0 1360 560"
    >
      {/* input terminals + vertical buses */}
      {[
        [A1, "A₁"],
        [B1, "B₁"],
        [A0, "A₀"],
        [B0, "B₀"],
        [S2, fmtSel(d.logic.sel)],
      ].map(([bx, lb]) => (
        <g key={lb as string}>
          <Term x={bx as number} y={busY} label={lb as string} dir="r" />
          <VW x={bx as number} y1={busY} y2={bottom} />
        </g>
      ))}

      {/* one gate per M1 data input — bit 1 (MSB) on pins 2/3, bit 0 (LSB) on 5/6 */}
      {slots.map(({ op, bit, pin }) => {
        const def = LOGIC_OPS[op]
        const y = L(pin).y
        const ax = bit ? A1 : A0
        const bx = bit ? B1 : B0
        const t = compact(bitExpr(def.out, bit))
        if (def.src !== "AB") {
          const sx = def.src === "A" ? ax : bx
          if (def.gate === "BUF")
            return (
              <g key={pin}>
                <HW x1={sx} x2={L(pin).x} y={y} cross={rightOf(sx)} />
                <Dot x={sx} y={y} />
                <Net x={notX + 102} y={y - 8} t={t} />
              </g>
            )
          return (
            <g key={pin}>
              <HW x1={sx} x2={notX} y={y} cross={rightOf(sx)} />
              <Dot x={sx} y={y} />
              <NotG x={notX} y={y} />
              <W pts={[notOut(notX, y) as number[], [L(pin).x, L(pin).y]]} />
              <Net x={notOut(notX, y)[0] + 62} y={y - 8} t={t} />
            </g>
          )
        }
        const g = def.gate as Gate2
        return (
          <g key={pin}>
            <HW x1={ax} x2={gateX} y={y - 8} cross={rightOf(ax)} />
            <Dot x={ax} y={y - 8} />
            <HW x1={bx} x2={gateX} y={y + 8} cross={rightOf(bx)} />
            <Dot x={bx} y={y + 8} />
            <BinGate x={gateX} y={y} g={g} />
            <W
              pts={[
                [binOut(gateX, g), y],
                [L(pin).x, L(pin).y],
              ]}
            />
            <Net x={binOut(gateX, g) + 66} y={y - 8} t={t} />
          </g>
        )
      })}

      {/* select -> M1 pin1 */}
      <VW x={S2} y1={busY} y2={L(1).y} />
      <HW x1={S2} x2={L(1).x} y={L(1).y} />
      <Dot x={S2} y={L(1).y} />

      {/* M1 chip */}
      <ChipBody
        c={M1}
        name="M1"
        sub="74157"
        left={[
          { n: 1, fn: "S̄ (sel)" },
          { n: 2, fn: "I0a" },
          { n: 3, fn: "I1a" },
          { n: 4, fn: "Ya" },
          { n: 5, fn: "I0b" },
          { n: 6, fn: "I1b" },
          { n: 7, fn: "Yb" },
          { n: 8, fn: "GND" },
        ]}
        right={[
          { n: 16, fn: "Vcc" },
          { n: 15, fn: "Ē (en)" },
          { n: 14, fn: "I0d" },
          { n: 13, fn: "I1d" },
          { n: 12, fn: "Yd" },
          { n: 11, fn: "I0c" },
          { n: 10, fn: "I1c" },
          { n: 9, fn: "Yc" },
        ]}
      />

      {/* power */}
      <Vcc x={R(16).x} y={R(16).y} dir="r" />
      <Gnd x={R(15).x} y={R(15).y} dir="r" />
      <Gnd x={L(8).x} y={L(8).y} dir="l" />
      {[9, 10, 11, 12, 13, 14].map((n) => (
        <text
          key={n}
          x={R(n).x + 8}
          y={R(n).y + 5}
          className="hand"
          fontSize={13}
          fill="#a1a1aa"
        >
          N/C
        </text>
      ))}

      {/* outputs Ya(pin4) and Yb(pin7) -> M2, dropped to a clean bottom lane */}
      <W
        pts={[
          [L(4).x, L(4).y],
          [910, L(4).y],
        ]}
      />
      <VW x={910} y1={L(4).y} y2={500} cross={[L(5).y, L(6).y, L(7).y]} />
      <HW x1={910} x2={1300} y={500} />
      <Arrow x={1300} y={500} dir="r" />
      <Net
        x={1150}
        y={492}
        t={`Ya → M2 pin ${d.m2.logic[1]} — logic bit 1 (MSB)`}
        anchor="end"
      />

      <W
        pts={[
          [L(7).x, L(7).y],
          [872, L(7).y],
        ]}
      />
      <VW x={872} y1={L(7).y} y2={522} />
      <HW x1={872} x2={1300} y={522} />
      <Arrow x={1300} y={522} dir="r" />
      <Net
        x={1150}
        y={514}
        t={`Yb → M2 pin ${d.m2.logic[0]} — logic bit 0 (LSB)`}
        anchor="end"
      />
    </Sheet>
  )
}
