// CombinedSheet for the 2-bit reference schematic.

import { fmtSel, type Design } from "../../alu/derive"
import {
  Arrow,
  ChipBody,
  Gnd,
  HW,
  INK,
  Net,
  pinL,
  pinR,
  Sheet,
  Term,
  Vcc,
  VW,
  W,
  type Chip,
} from "../primitives"

export function CombinedSheet({ d }: { d: Design }) {
  const M2: Chip = { x: 620, y: 130, w: 210 }
  const L = (n: number) => pinL(M2, n)
  const R = (n: number) => pinR(M2, n)

  // top block feeds I0 (pins 2/5), bottom block feeds I1 (pins 3/6)
  const topBox = { x: 70, y: 175, w: 200, h: 150 }
  const botBox = { x: 70, y: 355, w: 200, h: 120 }
  const logic = { t: "① LOGIC UNIT", s: "(M1 · 74157)", b1: "Ya", b0: "Yb" }
  const arith = {
    t: "② ARITHMETIC UNIT",
    s: "(CM1 + 7483)",
    b1: "Σ2",
    b0: "Σ1",
  }
  const [top, bot] = d.arithWhen ? [logic, arith] : [arith, logic]

  return (
    <Sheet
      n="③ Combined ALU"
      title={`Merge Logic + Arithmetic  (select = ${fmtSel(d.unitLine)})`}
      note={d.titles.combinedNote}
      vb="0 0 1360 560"
    >
      {/* source blocks */}
      {[
        { b: topBox, ...top },
        { b: botBox, ...bot },
      ].map(({ b, t, s }) => (
        <g key={t}>
          <rect
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx={6}
            fill="#fff"
            stroke={INK}
            strokeWidth={2.4}
            strokeDasharray="7 5"
          />
          <text
            x={b.x + b.w / 2}
            y={b.y + b.h / 2 - 8}
            className="title"
            fontSize={24}
            fill={INK}
            textAnchor="middle"
          >
            {t}
          </text>
          <text
            x={b.x + b.w / 2}
            y={b.y + b.h / 2 + 18}
            className="hand"
            fontSize={15}
            fill="#71717a"
            textAnchor="middle"
          >
            {s}
          </text>
        </g>
      ))}

      {/* top block -> M2 I0a(2) / I0b(5) — straight lanes */}
      <HW x1={topBox.x + topBox.w} x2={L(2).ex} y={L(2).y} />
      <Net
        x={topBox.x + topBox.w + 12}
        y={L(2).y - 8}
        t={`${top.b1} → pin 2 (bit 1, MSB)`}
        anchor="start"
      />
      <HW x1={topBox.x + topBox.w} x2={L(5).ex} y={L(5).y} />
      <Net
        x={topBox.x + topBox.w + 12}
        y={L(5).y - 8}
        t={`${top.b0} → pin 5 (bit 0, LSB)`}
        anchor="start"
      />

      {/* bottom block -> M2 I1a(3) / I1b(6) */}
      <HW x1={botBox.x + botBox.w} x2={500} y={385} />
      <VW x={500} y1={385} y2={L(3).y} cross={[L(5).y]} />
      <HW x1={500} x2={L(3).ex} y={L(3).y} />
      <Net
        x={botBox.x + botBox.w + 12}
        y={385 - 8}
        t={`${bot.b1} → pin 3 (bit 1, MSB)`}
        anchor="start"
      />
      <HW x1={botBox.x + botBox.w} x2={540} y={425} />
      <VW x={540} y1={425} y2={L(6).y} />
      <HW x1={540} x2={L(6).ex} y={L(6).y} />
      <Net
        x={botBox.x + botBox.w + 12}
        y={425 + 16}
        t={`${bot.b0} → pin 6 (bit 0, LSB)`}
        anchor="start"
      />

      {/* unit select -> pin1 */}
      <Term
        x={470}
        y={L(1).y}
        label={`${fmtSel(d.unitLine)} (unit select)`}
        dir="l"
      />
      <HW x1={470} x2={L(1).ex} y={L(1).y} />

      {/* M2 chip */}
      <ChipBody
        c={M2}
        name="M2"
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

      {/* final outputs F1(pin4) / F0(pin7) */}
      <W
        pts={[
          [L(4).x, L(4).y],
          [550, L(4).y],
        ]}
      />
      <VW x={550} y1={L(4).y} y2={500} cross={[L(5).y, L(6).y]} />
      <HW x1={550} x2={1300} y={500} />
      <Arrow x={1300} y={500} dir="r" />
      <Net
        x={1290}
        y={492}
        t="F₁ = ALU output bit 1 (MSB) — pin 4"
        anchor="end"
      />
      <W
        pts={[
          [L(7).x, L(7).y],
          [528, L(7).y],
        ]}
      />
      <VW x={528} y1={L(7).y} y2={522} />
      <HW x1={528} x2={1300} y={522} />
      <Arrow x={1300} y={522} dir="r" />
      <Net
        x={1290}
        y={514}
        t="F₀ = ALU output bit 0 (LSB) — pin 7"
        anchor="end"
      />
    </Sheet>
  )
}
