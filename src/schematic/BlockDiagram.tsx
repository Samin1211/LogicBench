/* ============================================================================
   Block-diagram view of a solved design — any size.

   Sheet 1: the whole adder as one "Binary Adder" block (x/y buses in on top,
   C₀ on the right, carry out on the left, Σ out below).
   Sheet 2: one row per bit (MSB on top), one column per stage:
     X/Y MUX → logic gates → (logic MUX) → output MUX → Fᵢ
   Blocks show function names only (I₀…, S…, Y — no pin numbers). Signals
   between blocks are joined by matching labels on short stubs, as in
   textbook block diagrams. Above 4 bits sheet 2 shows one generic bit slice.
   ========================================================================== */

import type { ReactNode } from "react"
import { muxInputs, TT_NAME, type Design } from "../engine/solve"
import { INK, RED, Sheet } from "./primitives"

const SUBS = "₀₁₂₃₄₅₆₇₈₉"
const subOf = (s: string) => s.replace(/\d/g, (d) => SUBS[+d])
const lineName = (l: string) => l.replace(/^([A-Za-z]+)(\d+)$/, (_, a, d) => a + subOf(d))

const PITCH = 24
const MUX_W = 120
const GATE_W = 96
const GATE_H = 46
const STUB = 30
const SEL_SPACE = 36
const DIM = "#71717a"

const muxH = (m: number) => Math.max(84, m * PITCH + 46)
const muxName = (m: number) => `${m}×1 MUX`

function Label({ x, y, t, anchor = "end", bold, color = INK }: { x: number; y: number; t: string; anchor?: "start" | "end" | "middle"; bold?: boolean; color?: string }) {
  return (
    <text x={x} y={y} className="hand" fontSize={14} fontWeight={bold ? 600 : 500} fill={color} textAnchor={anchor} dominantBaseline="middle">
      {t}
    </text>
  )
}

const line = (x1: number, y1: number, x2: number, y2: number, k: string) => (
  <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth={1.6} />
)

function Box({ x, y, w, h, title, sub }: { x: number; y: number; w: number; h: number; title: string; sub?: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={12} fill="#fff" stroke={INK} strokeWidth={1.8} />
      <text x={x + w / 2} y={y + h / 2 - (sub ? 8 : 0)} className="hand" fontSize={15} fontWeight={600} fill={RED} textAnchor="middle" dominantBaseline="middle">
        {title}
      </text>
      {sub && (
        <text x={x + w / 2} y={y + h / 2 + 12} className="hand" fontSize={11.5} fill={DIM} textAnchor="middle" dominantBaseline="middle">
          {sub}
        </text>
      )}
    </g>
  )
}

/** A MUX block with labelled data stubs on the left and select stubs below. */
function Mux({ x, y, inputs, sel, out, outStub = true }: { x: number; y: number; inputs: string[]; sel: string[]; out: string; outStub?: boolean }) {
  const h = muxH(inputs.length)
  const cx = x + MUX_W / 2
  return (
    <g>
      <Box x={x} y={y} w={MUX_W} h={h} title={muxName(inputs.length)} />
      {inputs.map((t, j) => {
        const yy = y + 22 + j * PITCH
        return (
          <g key={j}>
            {line(x - STUB, yy, x, yy, "s")}
            <Label x={x + 6} y={yy} t={`I${subOf(String(j))}`} anchor="start" color={DIM} />
            <Label x={x - STUB - 5} y={yy} t={t} />
          </g>
        )
      })}
      {sel.map((s, q) => {
        const sx = cx + (q - (sel.length - 1) / 2) * 28
        return (
          <g key={s}>
            {line(sx, y + h, sx, y + h + 20, "s")}
            <Label x={sx} y={y + h - 12} t={lineName(s)} anchor="middle" color={DIM} />
          </g>
        )
      })}
      <Label x={x + MUX_W - 8} y={y + h / 2} t="Y" anchor="end" color={DIM} />
      {outStub && (
        <>
          {line(x + MUX_W, y + h / 2, x + MUX_W + STUB, y + h / 2, "o")}
          <Label x={x + MUX_W + STUB + 5} y={y + h / 2} t={out} anchor="start" bold />
        </>
      )}
    </g>
  )
}

type Ctx = { d: Design; k: number; generic: boolean }

/** Label for bit `i` (or generic ᵢ). */
const bitSub = (ctx: Ctx, i: number) => (ctx.generic ? "ᵢ" : subOf(String(i)))
const ttLabel = (tt: number, s: string) => TT_NAME[tt].replace(/A/g, `A${s}`).replace(/B/g, `B${s}`)
function valueLabel(v: string | undefined, s: string): string {
  if (v === undefined) return "0"
  if (v === "SUM") return `Σ${s}`
  if (v === "LU") return `L${s}`
  if (v.startsWith("T")) return ttLabel(+v.slice(1), s)
  if (v === "A" || v === "B") return v + s
  if (v === "A′" || v === "B′") return v[0] + s + "′"
  return v // 0 / 1
}

const GATE_TITLE: Record<number, string> = { 8: "AND", 14: "OR", 6: "XOR", 7: "NAND", 1: "NOR", 9: "XNOR", 3: "NOT", 5: "NOT" }
const needsGate = (tt: number) => ![0, 15, 12, 10].includes(tt)

/** Geometry shared by every bit row. */
function plan(d: Design) {
  const a = d.arith
  const logicTTs = [...new Set(d.ops.filter((o) => o.role === "logic").map((o) => o.logic!))].filter(needsGate)
  const xm = a && a.xSel.length ? 1 << a.xSel.length : 0
  const ym = a && a.ySel.length ? 1 << a.ySel.length : 0
  const lm = d.twoLevel && d.logicSel ? 1 << d.logicSel.length : 0
  const om = d.outSel.length ? 1 << d.outSel.length : 0

  const cols: Record<string, number> = {}
  let x = 0
  if (xm || ym) (x += 120), (cols.xy = x), (x += MUX_W + 80)
  if (logicTTs.length) (x += 70), (cols.g = x), (x += GATE_W + 130)
  if (lm) (x += 130), (cols.lm = x), (x += MUX_W + 80)
  if (om) (x += 130), (cols.out = x), (x += MUX_W + 70)
  else x += 130
  const xyH = (xm ? muxH(xm) + SEL_SPACE : 0) + (ym ? muxH(ym) + SEL_SPACE : 0) + (xm && ym ? 18 : 0)
  const rowH =
    Math.max(
      xyH,
      logicTTs.length * (GATE_H + 16),
      lm ? muxH(lm) + SEL_SPACE : 0,
      om ? muxH(om) + SEL_SPACE : 0,
    ) + 44
  return { cols, width: x + 40, rowH, xm, ym, lm, om, logicTTs, xyH }
}

function BitRow({ ctx, i, y0, P }: { ctx: Ctx; i: number; y0: number; P: ReturnType<typeof plan> }) {
  const { d, k, generic } = ctx
  const s = bitSub(ctx, i)
  const a = d.arith
  const n = d.problem.bits
  const el: ReactNode[] = []
  const mid = y0 + P.rowH / 2

  el.push(
    <Label key="row" x={8} y={y0 + 14} t={generic ? "Bit slice i" : `Bit ${i}${i === n - 1 ? " (MSB)" : i === 0 ? " (LSB)" : ""}`} anchor="start" color={DIM} />,
  )

  // ---- adder input MUXes (outputs Xᵢ / Yᵢ go to the binary adder) ----
  if (a && (P.xm || P.ym)) {
    const xyTop = mid - P.xyH / 2
    const feed = (which: "x" | "y", top: number) => {
      const sel = which === "x" ? a.xSel : a.ySel
      if (!sel.length) return
      const table = which === "x" ? a.x : a.y
      const inputs = muxInputs(table as (string | undefined)[], sel, k).map((v) => valueLabel(v, s))
      el.push(<Mux key={which} x={P.cols.xy} y={top} inputs={inputs} sel={sel.map((j) => d.problem.lines[j])} out={`${which.toUpperCase()}${s}`} />)
    }
    feed("x", xyTop)
    feed("y", xyTop + (P.xm ? muxH(P.xm) + SEL_SPACE + 18 : 0))
  }

  // ---- logic gates ----
  if (P.logicTTs.length) {
    const gx = P.cols.g
    const top = mid - (P.logicTTs.length * (GATE_H + 16) - 16) / 2
    P.logicTTs.forEach((tt, q) => {
      const gy = top + q * (GATE_H + 16)
      const usesA = ((tt >> 2) & 3) !== (tt & 3)
      const usesB = ((tt >> 1) & 5) !== (tt & 5)
      const ins = [usesA && `A${s}`, usesB && `B${s}`].filter(Boolean) as string[]
      el.push(<Box key={`g${tt}`} x={gx} y={gy} w={GATE_W} h={GATE_H} title={GATE_TITLE[tt] ?? "LOGIC"} />)
      ins.forEach((t, j) => {
        const yy = ins.length === 1 ? gy + GATE_H / 2 : gy + 14 + j * 18
        el.push(line(gx - STUB, yy, gx, yy, `gi${tt}${j}`), <Label key={`gl${tt}${j}`} x={gx - STUB - 5} y={yy} t={t} />)
      })
      el.push(
        line(gx + GATE_W, gy + GATE_H / 2, gx + GATE_W + STUB, gy + GATE_H / 2, `go${tt}`),
        <Label key={`gn${tt}`} x={gx + GATE_W + STUB + 5} y={gy + GATE_H / 2} t={ttLabel(tt, s)} anchor="start" bold />,
      )
    })
  }

  // ---- logic MUX ----
  if (P.lm && d.logicTable && d.logicSel) {
    const inputs = muxInputs(d.logicTable, d.logicSel, k).map((v) => valueLabel(v, s))
    el.push(<Mux key="lm" x={P.cols.lm} y={mid - (muxH(P.lm) + SEL_SPACE) / 2} inputs={inputs} sel={d.logicSel.map((j) => d.problem.lines[j])} out={`L${s}`} />)
  }

  // ---- output ----
  if (P.om) {
    const inputs = muxInputs(d.outTable, d.outSel, k).map((v) => valueLabel(v, s))
    el.push(<Mux key="om" x={P.cols.out} y={mid - (muxH(P.om) + SEL_SPACE) / 2} inputs={inputs} sel={d.outSel.map((j) => d.problem.lines[j])} out={`F${s}`} />)
  } else {
    const v = d.outTable.find((t) => t !== undefined)
    el.push(<Label key="f" x={P.width - 40} y={mid} t={`F${s} = ${valueLabel(v, s)}`} bold />)
  }
  return <g>{el}</g>
}

/** The whole adder as one block: x/y buses on top, C₀ in on the right, carry out on the left, S below. */
function AdderSheet({ d }: { d: Design }) {
  const a = d.arith!
  const n = d.problem.bits
  const AP = 30 // arrow pitch
  const busW = n * AP
  const W = Math.max(380, 2 * busW + 120)
  const H = 110
  const x0 = 200
  const y0 = 110
  const width = x0 + W + 340
  const height = y0 + H + 120
  const bits = Array.from({ length: n }, (_, q) => n - 1 - q) // MSB first, left → right
  const src = (which: "x" | "y", i: number) => {
    const sel = which === "x" ? a.xSel : a.ySel
    if (sel.length) return `${which.toUpperCase()}${subOf(String(i))}`
    return valueLabel((which === "x" ? a.x : a.y).find((t) => t !== undefined), subOf(String(i)))
  }
  const cin = a.cinText.replace(/[A-Za-z]+\d+/g, lineName)
  const el: ReactNode[] = []
  const arrow = (x1: number, y1: number, x2: number, y2: number, k: string, color = INK) => (
    <g key={k}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={1.6} />
      <path
        d={
          y1 === y2
            ? `M${x2},${y2} l${x2 > x1 ? -8 : 8},-4 v8 z`
            : `M${x2},${y2} l-4,${y2 > y1 ? -8 : 8} h8 z`
        }
        fill={color}
      />
    </g>
  )
  const groupX = { x: x0 + W / 4 - busW / 2 + AP / 2, y: x0 + (3 * W) / 4 - busW / 2 + AP / 2 }
  for (const which of ["x", "y"] as const)
    bits.forEach((i, q) => {
      const x = groupX[which] + q * AP
      el.push(arrow(x, y0 - 44, x, y0, `${which}${i}`), <Label key={`${which}l${i}`} x={x} y={y0 - 58} t={src(which, i)} anchor="middle" />)
    })
  el.push(
    <Label key="xg" x={groupX.x + (busW - AP) / 2} y={y0 - 84} t="X input" anchor="middle" color={DIM} />,
    <Label key="yg" x={groupX.y + (busW - AP) / 2} y={y0 - 84} t="Y input" anchor="middle" color={DIM} />,
  )
  const sx = x0 + W / 2 - busW / 2 + AP / 2
  bits.forEach((i, q) => {
    const x = sx + q * AP
    el.push(arrow(x, y0 + H, x, y0 + H + 44, `s${i}`), <Label key={`sl${i}`} x={x} y={y0 + H + 58} t={`Σ${subOf(String(i))}`} anchor="middle" bold />)
  })
  el.push(
    arrow(x0 + W + 60, y0 + H / 2, x0 + W, y0 + H / 2, "cin", RED),
    <Label key="cinl" x={x0 + W + 68} y={y0 + H / 2} t={`C₀ = ${cin}`} anchor="start" />,
    arrow(x0, y0 + H / 2, x0 - 60, y0 + H / 2, "cout", RED),
    <Label key="coutl" x={x0 - 68} y={y0 + H / 2} t={`C${subOf(String(n))} (Cout)`} />,
  )
  return (
    <Sheet
      n="Block diagram 1"
      title={`${n}-bit binary adder`}
      note={`Σ = X + Y + C₀ · ${d.problem.adder === "7483" ? `${Math.ceil(n / 4)}× 7483` : `${n} full adders, rippled`} · Σᵢ feeds the output MUXes`}
      vb={`0 0 ${width} ${height}`}
    >
      <rect x={x0} y={y0} width={W} height={H} rx={14} fill="#fff" stroke={INK} strokeWidth={1.8} />
      <text x={x0 + W / 2} y={y0 + H / 2} className="hand" fontSize={22} fontWeight={600} fill={RED} textAnchor="middle" dominantBaseline="middle">
        Binary Adder
      </text>
      {el}
    </Sheet>
  )
}

export function BlockDiagram({ d }: { d: Design }) {
  const n = d.problem.bits
  const k = d.problem.lines.length
  const P = plan(d)
  const generic = n > 4
  const ctx: Ctx = { d, k, generic }
  const rows = generic ? [0] : Array.from({ length: n }, (_, r) => n - 1 - r)
  const top = 20
  const height = top + rows.length * P.rowH + 20

  return (
    <>
      {d.arith && <AdderSheet d={d} />}
      <Sheet
        n={d.arith ? "Block diagram 2" : "Block diagram"}
        title={generic ? "Bit slice i (repeat for i = 0 … " + (n - 1) + ")" : `${n}-bit ALU`}
        note="matching labels are connected · select lines go to every MUX"
        vb={`0 0 ${P.width} ${height}`}
      >
        {rows.map((bit, r) => (
          <g key={bit}>
            {r > 0 && <line x1={0} x2={P.width} y1={top + r * P.rowH} y2={top + r * P.rowH} stroke="#e4e4e7" strokeDasharray="4 6" />}
            <BitRow ctx={ctx} i={bit} y0={top + r * P.rowH} P={P} />
          </g>
        ))}
      </Sheet>
    </>
  )
}
