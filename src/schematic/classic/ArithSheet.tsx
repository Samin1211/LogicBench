// ArithSheet for the 2-bit reference schematic.

import { fmtSel, type Design, type Lit } from "../../alu/derive"
import {
  AndG,
  andOut,
  Arrow,
  ChipBody,
  Dot,
  Gnd,
  HW,
  INK,
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
} from "../primitives"

export function ArithSheet({ d }: { d: Design }) {
  const CM1: Chip = { x: 430, y: 110, w: 210 }
  const AD: Chip = { x: 1090, y: 110, w: 210 }
  const C = (n: number) => pinL(CM1, n)
  const CR = (n: number) => pinR(CM1, n)
  const A = (n: number) => pinL(AD, n)
  const AR = (n: number) => pinR(AD, n)

  // far-left select / data buses (HI → CM1 pin 2, LO → CM1 pin 14)
  const B1 = 100,
    HI = 180,
    LO = 250
  const busY = 64
  // gap vertical rails (between CM1 right edge 686 and adder left edge 1044)
  const topRail = 88 // LO over-the-top run to CM1 pin 14
  const s0drop = 700 // drop into pin 14
  const notX = 830 // B0' inverter (faces left → I3b side)
  const b0x = 890 // B0 input rail
  const a1x = 960 // A1 input rail
  const y1riser = 1000 // Y1 up into adder pin 7
  const s2drop = 1010 // Σ2 up-and-over exit
  // bottom lanes / far-right risers
  const lane1 = 620,
    lane0 = 660,
    andY = 760,
    gx = 760
  const y0riser = 1400,
    cinRiser = 1450,
    outX = 1490

  // CM1 data pins for I0..I3: channel a (bit 1) left, channel b (bit 0) right
  const leftPins = [6, 5, 4, 3]
  const rightPins = [10, 11, 12, 13]
  const usesB = (i: number) => d.cm1[i] === "B" || d.cm1[i] === "B'"
  const b1Ys = leftPins.filter((_, i) => usesB(i)).map((p) => C(p).y)
  const b0Ys = rightPins.filter((_, i) => usesB(i)).map((p) => CR(p).y)

  // Cin source → where each select bus terminates
  const cin = d.cin
  const busX = (l: Lit["line"]) => (l === d.hi ? HI : LO)
  let hiIn: number | null = null
  let loIn: number | null = null
  if (cin.kind === "lit") {
    if (cin.lit.line === d.hi) hiIn = andY
    else loIn = andY
  } else if (cin.kind === "and" || cin.kind === "sop") {
    hiIn = andY - 8
    loIn = andY + 8
  }
  const hiEnd = hiIn ?? C(2).y
  const loEnd = loIn ?? topRail
  const crossAt = (y: number, fromX: number) =>
    [HI, LO].filter((x) => x > fromX && (x === HI ? hiEnd : loEnd) > y + 7)
  const risers = cin.kind === "const" ? [y0riser] : [y0riser, cinRiser]

  // Cin gate (2-input AND only when both literals are true-form)
  const andPos = cin.kind === "and" && !cin.a.neg && !cin.b.neg
  const cinOut =
    cin.kind === "lit"
      ? cin.lit.neg
        ? notOut(gx, andY)[0]
        : busX(cin.lit.line)
      : andPos
        ? andOut(gx, andY)[0]
        : gx + 110

  return (
    <Sheet
      n="② Arithmetic Unit"
      title={d.titles.arith}
      note={d.titles.arithNote}
      vb="0 0 1660 840"
    >
      {/* ---- far-left buses ---- */}
      <Term x={B1} y={busY} label="B₁ (MSB)" dir="l" />
      {b1Ys.length > 0 && <VW x={B1} y1={busY} y2={Math.max(...b1Ys)} />}
      <Term x={HI} y={busY} label={fmtSel(d.hi)} dir="l" />
      <VW x={HI} y1={busY} y2={hiEnd} />
      <Term x={LO} y={busY} label={fmtSel(d.lo)} dir="l" />
      <VW x={LO} y1={busY} y2={loEnd} />

      {/* ============ CM1 : dual 4:1 MUX ============ */}
      <ChipBody
        c={CM1}
        name="CM1"
        sub="74153"
        left={[
          { n: 1, fn: "Ēa" },
          { n: 2, fn: "B  sel" },
          { n: 3, fn: "I3a" },
          { n: 4, fn: "I2a" },
          { n: 5, fn: "I1a" },
          { n: 6, fn: "I0a" },
          { n: 7, fn: "Ya" },
          { n: 8, fn: "GND" },
        ]}
        right={[
          { n: 16, fn: "Vcc" },
          { n: 15, fn: "Ēb" },
          { n: 14, fn: "A  sel" },
          { n: 13, fn: "I3b" },
          { n: 12, fn: "I2b" },
          { n: 11, fn: "I1b" },
          { n: 10, fn: "I0b" },
          { n: 9, fn: "Yb" },
        ]}
      />

      {/* --- channel a (bit 1 / MSB), CM1 left --- */}
      <Gnd x={C(1).x} y={C(1).y} dir="l" />
      <Gnd x={C(8).x} y={C(8).y} dir="l" />
      {/* pin2 select = HI */}
      <HW x1={HI} x2={C(2).x} y={C(2).y} cross={crossAt(C(2).y, HI)} />
      {hiEnd > C(2).y && <Dot x={HI} y={C(2).y} />}
      {/* data inputs I0a..I3a */}
      {d.cm1.map((b, i) => {
        const p = leftPins[i]
        const y = C(p).y
        if (b === "0") return <Gnd key={p} x={C(p).x} y={y} dir="l" />
        if (b === "1") return <Vcc key={p} x={C(p).x} y={y} dir="l" />
        if (b === "B")
          return (
            <g key={p}>
              <HW x1={B1} x2={C(p).x} y={y} cross={crossAt(y, B1)} />
              <Dot x={B1} y={y} />
            </g>
          )
        return (
          <g key={p}>
            <NotG x={310} y={y} facing="r" />
            <HW x1={B1} x2={310} y={y} cross={crossAt(y, B1)} />
            <Dot x={B1} y={y} />
            <W pts={[notOut(310, y) as number[], [C(p).x, y]]} />
            <Net x={C(p).x - 8} y={y - 8} t="B₁′" anchor="end" />
          </g>
        )
      })}

      {/* pin14 A-sel = LO, routed cleanly over the top into the gap */}
      {loEnd > topRail && <Dot x={LO} y={topRail} />}
      <HW x1={LO} x2={s0drop} y={topRail} />
      <VW x={s0drop} y1={topRail} y2={CR(14).y} />
      <HW x1={s0drop} x2={CR(14).x} y={CR(14).y} />
      <Net x={s0drop + 8} y={topRail - 8} t={fmtSel(d.lo)} anchor="start" />

      {/* --- channel b (bit 0 / LSB), CM1 right — power + gap-fed inputs --- */}
      <Vcc x={CR(16).x} y={CR(16).y} dir="r" />
      <Gnd x={CR(15).x} y={CR(15).y} dir="r" />
      <Term x={b0x} y={busY} label="B₀ (LSB)" dir="l" />
      {b0Ys.length > 0 && <VW x={b0x} y1={busY} y2={Math.max(...b0Ys)} />}
      {d.cm1.map((b, i) => {
        const p = rightPins[i]
        const y = CR(p).y
        if (b === "0") return <Gnd key={p} x={CR(p).x} y={y} dir="r" />
        if (b === "1") return <Vcc key={p} x={CR(p).x} y={y} dir="r" />
        if (b === "B")
          return (
            <g key={p}>
              <HW x1={CR(p).x} x2={b0x} y={y} />
              <Dot x={b0x} y={y} />
            </g>
          )
        return (
          <g key={p}>
            <NotG x={notX} y={y} facing="l" />
            <HW x1={notX} x2={b0x} y={y} />
            <Dot x={b0x} y={y} />
            <W pts={[notOut(notX, y, "l") as number[], [CR(p).x, y]]} />
            <Net x={CR(p).x + 6} y={y - 8} t="B₀′" anchor="start" />
          </g>
        )
      })}

      {/* ============ Adder : 7483 ============ */}
      <ChipBody
        c={AD}
        name="Z"
        sub="7483 adder"
        left={[
          { n: 1, fn: "A4" },
          { n: 2, fn: "Σ3" },
          { n: 3, fn: "A3" },
          { n: 4, fn: "B3" },
          { n: 5, fn: "Vcc" },
          { n: 6, fn: "Σ2" },
          { n: 7, fn: "B2" },
          { n: 8, fn: "A2" },
        ]}
        right={[
          { n: 16, fn: "B4" },
          { n: 15, fn: "Σ4" },
          { n: 14, fn: "C4 out" },
          { n: 13, fn: "C0 in" },
          { n: 12, fn: "GND" },
          { n: 11, fn: "B1" },
          { n: 10, fn: "A1" },
          { n: 9, fn: "Σ1" },
        ]}
      />

      {/* adder unused high bits + power */}
      <Gnd x={A(1).x} y={A(1).y} dir="l" />
      <Gnd x={A(3).x} y={A(3).y} dir="l" />
      <Gnd x={A(4).x} y={A(4).y} dir="l" />
      <Vcc x={A(5).x} y={A(5).y} dir="l" />
      <Gnd x={AR(16).x} y={AR(16).y} dir="r" />
      <Gnd x={AR(12).x} y={AR(12).y} dir="r" />
      <text
        x={A(2).x - 8}
        y={A(2).y + 5}
        className="hand"
        fontSize={13}
        fill="#a1a1aa"
        textAnchor="end"
      >
        N/C
      </text>
      <text
        x={AR(15).x + 8}
        y={AR(15).y + 5}
        className="hand"
        fontSize={13}
        fill="#a1a1aa"
      >
        N/C (Σ4)
      </text>
      <text
        x={AR(14).x + 8}
        y={AR(14).y + 5}
        className="hand"
        fontSize={13}
        fill="#a1a1aa"
      >
        N/C (Cout)
      </text>

      {/* A1 input rail -> adder pin 8 (A2, bit 1 / MSB) */}
      <Term x={a1x} y={busY} label="A₁ (a₁, MSB)" dir="r" />
      <VW x={a1x} y1={busY} y2={A(8).y} />
      <HW x1={A(8).x} x2={a1x} y={A(8).y} cross={[y1riser]} />
      {/* A0 switch -> adder pin 10 (A1, bit 0 / LSB), far right */}
      <Term x={outX} y={AR(10).y} label="A₀ (a₀, LSB)" dir="r" />
      <HW x1={AR(10).x} x2={outX} y={AR(10).y} cross={risers} />

      {/* Y1 : CM1 pin7 (Ya) -> adder pin7 (B2) — both left, bottom lane */}
      <W
        pts={[
          [C(7).x, C(7).y],
          [340, C(7).y],
        ]}
      />
      <VW x={340} y1={C(7).y} y2={lane1} />
      <HW x1={340} x2={y1riser} y={lane1} />
      <VW x={y1riser} y1={lane1} y2={A(7).y} />
      <HW x1={y1riser} x2={A(7).x} y={A(7).y} />
      <Net
        x={360}
        y={lane1 - 8}
        t="Y₁ (CM1 pin 7 → adder pin 7)"
        anchor="start"
      />

      {/* Y0 : CM1 pin9 (Yb) -> adder pin11 (B1) — right, bottom lane */}
      <W
        pts={[
          [CR(9).x, CR(9).y],
          [CR(9).x, lane0],
        ]}
      />
      <HW x1={CR(9).x} x2={y0riser} y={lane0} />
      <VW x={y0riser} y1={lane0} y2={AR(11).y} />
      <HW x1={y0riser} x2={AR(11).x} y={AR(11).y} />
      <Net
        x={CR(9).x + 20}
        y={lane0 - 8}
        t="Y₀ (CM1 pin 9 → adder pin 11)"
        anchor="start"
      />

      {/* Carry-in logic -> adder pin 13 */}
      {cin.kind === "const" &&
        (cin.value ? (
          <Vcc x={AR(13).x} y={AR(13).y} dir="r" />
        ) : (
          <Gnd x={AR(13).x} y={AR(13).y} dir="r" />
        ))}
      {cin.kind === "lit" && cin.lit.neg && (
        <g>
          <HW
            x1={busX(cin.lit.line)}
            x2={gx}
            y={andY}
            cross={crossAt(andY, busX(cin.lit.line))}
          />
          <NotG x={gx} y={andY} />
        </g>
      )}
      {(cin.kind === "and" || cin.kind === "sop") && (
        <g>
          <HW x1={HI} x2={gx} y={andY - 8} cross={[LO]} />
          <HW x1={LO} x2={gx} y={andY + 8} />
          <text
            x={gx - 14}
            y={andY - 12}
            className="hand"
            fontSize={13}
            fill={INK}
            textAnchor="end"
          >
            {fmtSel(d.hi)}
          </text>
          <text
            x={gx - 14}
            y={andY + 18}
            className="hand"
            fontSize={13}
            fill={INK}
            textAnchor="end"
          >
            {fmtSel(d.lo)}
          </text>
          {andPos ? (
            <AndG x={gx} y={andY} />
          ) : (
            <g>
              <rect
                x={gx}
                y={andY - 22}
                width={110}
                height={44}
                rx={4}
                fill="#fff"
                stroke={INK}
                strokeWidth={2}
              />
              <text
                x={gx + 55}
                y={andY + 5}
                className="hand"
                fontSize={14}
                fill={INK}
                textAnchor="middle"
              >
                {d.cinText}
              </text>
            </g>
          )}
        </g>
      )}
      {cin.kind !== "const" && (
        <g>
          <HW
            x1={cinOut}
            x2={cinRiser}
            y={andY}
            cross={
              cin.kind === "lit" && !cin.lit.neg ? crossAt(andY, cinOut) : []
            }
          />
          <VW x={cinRiser} y1={andY} y2={AR(13).y} />
          <HW x1={cinRiser} x2={AR(13).x} y={AR(13).y} />
          <Net
            x={Math.max(cinOut, gx + 32) + 10}
            y={andY - 8}
            t={`Cin = ${d.cinText}`}
            anchor="start"
          />
        </g>
      )}

      {/* Σ2 -> M2, routed up and over the top-right */}
      <W
        pts={[
          [A(6).x, A(6).y],
          [s2drop, A(6).y],
        ]}
      />
      <VW x={s2drop} y1={A(6).y} y2={topRail + 4} />
      <HW x1={s2drop} x2={outX} y={topRail + 4} />
      <Arrow x={outX} y={topRail + 4} dir="r" />
      <Net
        x={outX}
        y={topRail - 6}
        t={`Σ2 → M2 pin ${d.m2.arith[1]} — arith bit 1 (MSB)`}
        anchor="end"
      />

      {/* Σ1 -> M2, straight out to the right */}
      <HW x1={AR(9).x} x2={outX} y={AR(9).y} cross={risers} />
      <Arrow x={outX} y={AR(9).y} dir="r" />
      <Net
        x={outX}
        y={AR(9).y + 22}
        t={`Σ1 → M2 pin ${d.m2.arith[0]} — arith bit 0 (LSB)`}
        anchor="end"
      />
    </Sheet>
  )
}
