import type { ReactNode } from "react"

/* Shared schematic primitives — ink, DIP-16 geometry, wires, gates, chips. */

export const INK = "#18181b"
export const RED = "#4f46e5"

// ---- DIP-16 pin geometry (shared by every 16-pin chip) --------------------
export const TP = 40 // top pad to first pin
export const SP = (340 - 2 * 40) / 7 // spacing between pins
export const CH = 340 // chip body height
export const STUB = 46 // length of pin stub outside the body

export type Chip = { x: number; y: number; w: number }
export const yL = (n: number) => TP + (n - 1) * SP // left pins 1..8, top→bottom
export const yR = (n: number) => TP + (16 - n) * SP // right pins 16..9, top→bottom
export const pinL = (c: Chip, n: number) => ({
  ex: c.x,
  x: c.x - STUB,
  y: c.y + yL(n),
})
export const pinR = (c: Chip, n: number) => ({
  ex: c.x + c.w,
  x: c.x + c.w + STUB,
  y: c.y + yR(n),
})

// ---- primitives -----------------------------------------------------------
export function W({ pts, w = 2 }: { pts: number[][]; w?: number }) {
  return (
    <polyline
      points={pts.map((p) => p.join(",")).join(" ")}
      fill="none"
      stroke={INK}
      strokeWidth={w}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  )
}
export function Dot({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r={4} fill={INK} />
}
export function Arrow({
  x,
  y,
  dir,
}: {
  x: number
  y: number
  dir: "r" | "l" | "d" | "u"
}) {
  const m: Record<string, string> = {
    r: `${x},${y} ${x - 10},${y - 5} ${x - 10},${y + 5}`,
    l: `${x},${y} ${x + 10},${y - 5} ${x + 10},${y + 5}`,
    d: `${x},${y} ${x - 5},${y - 10} ${x + 5},${y - 10}`,
    u: `${x},${y} ${x - 5},${y + 10} ${x + 5},${y + 10}`,
  }
  return <polygon points={m[dir]} fill={INK} />
}

// Ground symbol. dir = side the wire comes from.
export function Gnd({
  x,
  y,
  dir = "r",
}: {
  x: number
  y: number
  dir?: "r" | "l" | "d"
}) {
  if (dir === "d") {
    return (
      <g stroke={INK} strokeWidth={2}>
        <line x1={x} y1={y} x2={x} y2={y + 16} />
        <line x1={x - 12} y1={y + 16} x2={x + 12} y2={y + 16} />
        <line x1={x - 8} y1={y + 21} x2={x + 8} y2={y + 21} />
        <line x1={x - 4} y1={y + 26} x2={x + 4} y2={y + 26} />
      </g>
    )
  }
  const s = dir === "r" ? 1 : -1
  const bx = x + s * 18
  return (
    <g stroke={INK} strokeWidth={2}>
      <line x1={x} y1={y} x2={bx} y2={y} />
      <line x1={bx} y1={y - 12} x2={bx} y2={y + 12} />
      <line x1={bx + s * 5} y1={y - 8} x2={bx + s * 5} y2={y + 8} />
      <line x1={bx + s * 10} y1={y - 4} x2={bx + s * 10} y2={y + 4} />
    </g>
  )
}

// Vcc / +5V symbol.
export function Vcc({ x, y, dir = "r" }: { x: number; y: number; dir?: "r" | "l" }) {
  const s = dir === "r" ? 1 : -1
  const bx = x + s * 16
  return (
    <g>
      <line x1={x} y1={y} x2={bx} y2={y} stroke={INK} strokeWidth={2} />
      <line
        x1={bx}
        y1={y - 11}
        x2={bx}
        y2={y + 11}
        stroke={INK}
        strokeWidth={2}
      />
      <text
        x={bx + s * 8}
        y={y + 5}
        className="hand"
        fontSize={16}
        fill={RED}
        textAnchor={dir === "r" ? "start" : "end"}
      >
        Vcc
      </text>
    </g>
  )
}

// Labelled input terminal (a switch feeding the circuit).
export function Term({
  x,
  y,
  label,
  dir = "l",
  note,
}: {
  x: number
  y: number
  label: string
  dir?: "l" | "r" | "u"
  /** small MSB / LSB tag (used with dir="u") */
  note?: string
}) {
  if (dir === "u")
    return (
      <g>
        <circle cx={x} cy={y} r={5} fill="#fff" stroke={INK} strokeWidth={2} />
        <text x={x} y={y - 13} className="hand" fontSize={17} fontWeight={700} fill={INK} textAnchor="middle">
          {label}
        </text>
        {note && (
          <text x={x} y={y - 34} className="hand" fontSize={12} fill={RED} textAnchor="middle">
            {note}
          </text>
        )}
      </g>
    )
  const s = dir === "l" ? -1 : 1
  return (
    <g>
      <circle cx={x} cy={y} r={5} fill="#fff" stroke={INK} strokeWidth={2} />
      <text
        x={x + s * 12}
        y={y + 6}
        className="hand"
        fontSize={17}
        fontWeight={700}
        fill={INK}
        textAnchor={dir === "l" ? "end" : "start"}
      >
        {label}
      </text>
    </g>
  )
}

// A net / signal label floating on a wire.
export function Net({
  x,
  y,
  t,
  anchor = "middle",
}: {
  x: number
  y: number
  t: string
  anchor?: "start" | "middle" | "end"
}) {
  return (
    <text
      x={x}
      y={y}
      className="hand"
      fontSize={15}
      fill={RED}
      textAnchor={anchor}
    >
      {t}
    </text>
  )
}

// ---- hop-aware wires ------------------------------------------------------
// Horizontal wire from x1→x2 at height y, arching (") over each x in `cross`.
export function HW({
  x1,
  x2,
  y,
  cross = [],
  w = 2,
}: {
  x1: number
  x2: number
  y: number
  cross?: number[]
  w?: number
}) {
  const lo = Math.min(x1, x2)
  const hi = Math.max(x1, x2)
  const r = 6
  const hops = cross
    .filter((c) => c > lo + 7 && c < hi - 7)
    .sort((a, b) => a - b)
  const els: ReactNode[] = []
  let cur = lo
  hops.forEach((c, i) => {
    els.push(
      <line
        key={`l${i}`}
        x1={cur}
        y1={y}
        x2={c - r}
        y2={y}
        stroke={INK}
        strokeWidth={w}
        strokeLinecap="round"
      />,
    )
    els.push(
      <path
        key={`a${i}`}
        d={`M ${c - r} ${y} A ${r} ${r} 0 0 0 ${c + r} ${y}`}
        fill="none"
        stroke={INK}
        strokeWidth={w}
      />,
    )
    cur = c + r
  })
  els.push(
    <line
      key="e"
      x1={cur}
      y1={y}
      x2={hi}
      y2={y}
      stroke={INK}
      strokeWidth={w}
      strokeLinecap="round"
    />,
  )
  return <g>{els}</g>
}
// Vertical wire from y1→y2 at x, arching over each y in `cross`.
export function VW({
  y1,
  y2,
  x,
  cross = [],
  w = 2,
}: {
  y1: number
  y2: number
  x: number
  cross?: number[]
  w?: number
}) {
  const lo = Math.min(y1, y2)
  const hi = Math.max(y1, y2)
  const r = 6
  const hops = cross
    .filter((c) => c > lo + 7 && c < hi - 7)
    .sort((a, b) => a - b)
  const els: ReactNode[] = []
  let cur = lo
  hops.forEach((c, i) => {
    els.push(
      <line
        key={`l${i}`}
        x1={x}
        y1={cur}
        x2={x}
        y2={c - r}
        stroke={INK}
        strokeWidth={w}
        strokeLinecap="round"
      />,
    )
    els.push(
      <path
        key={`a${i}`}
        d={`M ${x} ${c - r} A ${r} ${r} 0 0 1 ${x} ${c + r}`}
        fill="none"
        stroke={INK}
        strokeWidth={w}
      />,
    )
    cur = c + r
  })
  els.push(
    <line
      key="e"
      x1={x}
      y1={cur}
      x2={x}
      y2={hi}
      stroke={INK}
      strokeWidth={w}
      strokeLinecap="round"
    />,
  )
  return <g>{els}</g>
}

// ---- gates ----------------------------------------------------------------
// NOT gate. facing 'r' output on right, 'l' output on left.
export function NotG({
  x,
  y,
  facing = "r",
}: {
  x: number
  y: number
  facing?: "r" | "l"
}) {
  const s = facing === "r" ? 1 : -1
  return (
    <g stroke={INK} strokeWidth={2} fill="#fff">
      <polygon points={`${x},${y - 15} ${x},${y + 15} ${x + s * 30},${y}`} />
      <circle cx={x + s * 35} cy={y} r={5} />
    </g>
  )
}
export const notIn = (x: number, y: number) => [x, y]
export const notOut = (x: number, y: number, facing: "r" | "l" = "r") => [
  x + (facing === "r" ? 40 : -40),
  y,
]

// OR gate, output on right.
export function OrG({ x, y }: { x: number; y: number }) {
  return (
    <path
      d={`M ${x} ${y - 16} Q ${x + 22} ${y - 16} ${x + 46} ${y} Q ${x + 22} ${y + 16} ${x} ${y + 16} Q ${x + 13} ${y} ${x} ${y - 16} Z`}
      fill="#fff"
      stroke={INK}
      strokeWidth={2}
    />
  )
}
export const orInTop = (x: number, y: number) => [x + 6, y - 8]
export const orInBot = (x: number, y: number) => [x + 6, y + 8]
export const orOut = (x: number, y: number) => [x + 46, y]

// AND gate, output on right.
export function AndG({ x, y }: { x: number; y: number }) {
  return (
    <path
      d={`M ${x} ${y - 16} L ${x + 16} ${y - 16} A 16 16 0 0 1 ${x + 16} ${y + 16} L ${x} ${y + 16} Z`}
      fill="#fff"
      stroke={INK}
      strokeWidth={2}
    />
  )
}
export const andInTop = (x: number, y: number) => [x, y - 8]
export const andInBot = (x: number, y: number) => [x, y + 8]
export const andOut = (x: number, y: number) => [x + 32, y]

// Generic 2-input gate (OR / AND families, optional XOR curve + output bubble).
export type Gate2 = "OR" | "AND" | "XOR" | "NAND" | "NOR" | "XNOR"
export const isOrBody = (g: Gate2) =>
  g === "OR" || g === "NOR" || g === "XOR" || g === "XNOR"
export const hasBubble = (g: Gate2) => g === "NAND" || g === "NOR" || g === "XNOR"
export const binOut = (x: number, g: Gate2) =>
  x + (isOrBody(g) ? 46 : 32) + (hasBubble(g) ? 10 : 0)
export function BinGate({ x, y, g }: { x: number; y: number; g: Gate2 }) {
  const body = isOrBody(g) ? 46 : 32
  return (
    <g>
      {isOrBody(g) ? <OrG x={x} y={y} /> : <AndG x={x} y={y} />}
      {(g === "XOR" || g === "XNOR") && (
        <path
          d={`M ${x - 7} ${y - 16} Q ${x + 6} ${y} ${x - 7} ${y + 16}`}
          fill="none"
          stroke={INK}
          strokeWidth={2}
        />
      )}
      {hasBubble(g) && (
        <circle
          cx={x + body + 5}
          cy={y}
          r={5}
          fill="#fff"
          stroke={INK}
          strokeWidth={2}
        />
      )}
    </g>
  )
}

// ---- chip body ------------------------------------------------------------
export type Pin = { n: number; fn: string }
export function ChipBody({
  c,
  name,
  sub,
  left,
  right,
}: {
  c: Chip
  name: string
  sub: string
  left: Pin[]
  right: Pin[]
}) {
  const numBox = (px: number, py: number, n: number) => (
    <g key={`b${n}`}>
      <rect
        x={px - 12}
        y={py - 11}
        width={24}
        height={22}
        rx={3}
        fill="#fff"
        stroke={INK}
        strokeWidth={1.6}
      />
      <text
        x={px}
        y={py + 1}
        className="num"
        fontSize={13}
        fill={INK}
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {n}
      </text>
    </g>
  )
  return (
    <g>
      <rect
        x={c.x}
        y={c.y}
        width={c.w}
        height={CH}
        rx={6}
        fill="#fff"
        stroke={INK}
        strokeWidth={2.4}
      />
      {/* notch */}
      <path
        d={`M ${c.x + c.w / 2 - 12} ${c.y} a 12 12 0 0 0 24 0`}
        fill="none"
        stroke={INK}
        strokeWidth={2}
      />
      <text
        x={c.x + c.w / 2}
        y={c.y + CH / 2 - 8}
        className="title"
        fontSize={30}
        fill={INK}
        textAnchor="middle"
      >
        {name}
      </text>
      <text
        x={c.x + c.w / 2}
        y={c.y + CH / 2 + 18}
        className="hand"
        fontSize={15}
        fill="#71717a"
        textAnchor="middle"
      >
        {sub}
      </text>
      {left.map((p) => {
        const y = c.y + yL(p.n)
        return (
          <g key={`l${p.n}`}>
            <line
              x1={c.x}
              y1={y}
              x2={c.x - STUB}
              y2={y}
              stroke={INK}
              strokeWidth={2}
            />
            {numBox(c.x - STUB + 14, y, p.n)}
            <text
              x={c.x + 9}
              y={y + 5}
              className="hand"
              fontSize={14}
              fill={INK}
              textAnchor="start"
            >
              {p.fn}
            </text>
          </g>
        )
      })}
      {right.map((p) => {
        const y = c.y + yR(p.n)
        return (
          <g key={`r${p.n}`}>
            <line
              x1={c.x + c.w}
              y1={y}
              x2={c.x + c.w + STUB}
              y2={y}
              stroke={INK}
              strokeWidth={2}
            />
            {numBox(c.x + c.w + STUB - 14, y, p.n)}
            <text
              x={c.x + c.w - 9}
              y={y + 5}
              className="hand"
              fontSize={14}
              fill={INK}
              textAnchor="end"
            >
              {p.fn}
            </text>
          </g>
        )
      })}
    </g>
  )
}

export function Sheet({
  n,
  title,
  note,
  children,
  vb,
}: {
  n: string
  title: string
  note: string
  children: ReactNode
  vb: string
}) {
  return (
    <section className="sheet mx-auto my-10 max-w-[1360px] bg-white rounded-2xl border border-[#e4e4e7] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="flex items-baseline justify-between border-b border-[#e4e4e7] px-8 pt-5 pb-4">
        <h2 className="title text-xl" style={{ color: INK }}>
          <span style={{ color: RED }}>{n}</span> &nbsp;{title}
        </h2>
        <p className="text-sm text-[#71717a]">{note}</p>
      </div>
      <svg viewBox={vb} className="block w-full">
        {children}
      </svg>
    </section>
  )
}


// ---- auto-hop router ------------------------------------------------------
// Draws orthogonal polylines; every horizontal segment arcs (⌒) over any
// vertical segment it crosses mid-span. T-junctions (an endpoint touching a
// wire) are not hopped — mark those with <Dot />.
export function Wires({ paths }: { paths: number[][][] }) {
  type Seg = { h: boolean; c: number; a: number; b: number }
  const segs: Seg[] = []
  for (const pts of paths)
    for (let i = 1; i < pts.length; i++) {
      const [x1, y1] = pts[i - 1]
      const [x2, y2] = pts[i]
      if (y1 === y2) segs.push({ h: true, c: y1, a: Math.min(x1, x2), b: Math.max(x1, x2) })
      else segs.push({ h: false, c: x1, a: Math.min(y1, y2), b: Math.max(y1, y2) })
    }
  const vs = segs.filter((s) => !s.h)
  return (
    <g>
      {segs.map((s, i) =>
        s.h ? (
          <HW key={i} x1={s.a} x2={s.b} y={s.c} cross={vs.filter((v) => v.a < s.c - 7 && v.b > s.c + 7).map((v) => v.c)} />
        ) : (
          <VW key={i} x={s.c} y1={s.a} y2={s.b} />
        ),
      )}
    </g>
  )
}

/** A gate drawn facing left (output on the left), mirrored about its input edge x. */
export function Mirror({ x, children }: { x: number; children: ReactNode }) {
  return <g transform={`translate(${2 * x} 0) scale(-1 1)`}>{children}</g>
}

// ---- standard pin tables ----------------------------------------------------
export const PINS_157: { left: Pin[]; right: Pin[] } = {
  left: [
    { n: 1, fn: "S̄ (sel)" },
    { n: 2, fn: "I0a" },
    { n: 3, fn: "I1a" },
    { n: 4, fn: "Ya" },
    { n: 5, fn: "I0b" },
    { n: 6, fn: "I1b" },
    { n: 7, fn: "Yb" },
    { n: 8, fn: "GND" },
  ],
  right: [
    { n: 16, fn: "Vcc" },
    { n: 15, fn: "Ē (en)" },
    { n: 14, fn: "I0d" },
    { n: 13, fn: "I1d" },
    { n: 12, fn: "Yd" },
    { n: 11, fn: "I0c" },
    { n: 10, fn: "I1c" },
    { n: 9, fn: "Yc" },
  ],
}
export const PINS_153: { left: Pin[]; right: Pin[] } = {
  left: [
    { n: 1, fn: "Ēa" },
    { n: 2, fn: "B  sel" },
    { n: 3, fn: "I3a" },
    { n: 4, fn: "I2a" },
    { n: 5, fn: "I1a" },
    { n: 6, fn: "I0a" },
    { n: 7, fn: "Ya" },
    { n: 8, fn: "GND" },
  ],
  right: [
    { n: 16, fn: "Vcc" },
    { n: 15, fn: "Ēb" },
    { n: 14, fn: "A  sel" },
    { n: 13, fn: "I3b" },
    { n: 12, fn: "I2b" },
    { n: 11, fn: "I1b" },
    { n: 10, fn: "I0b" },
    { n: 9, fn: "Yb" },
  ],
}
export const PINS_7483: { left: Pin[]; right: Pin[] } = {
  left: [
    { n: 1, fn: "A4" },
    { n: 2, fn: "Σ3" },
    { n: 3, fn: "A3" },
    { n: 4, fn: "B3" },
    { n: 5, fn: "Vcc" },
    { n: 6, fn: "Σ2" },
    { n: 7, fn: "B2" },
    { n: 8, fn: "A2" },
  ],
  right: [
    { n: 16, fn: "B4" },
    { n: 15, fn: "Σ4" },
    { n: 14, fn: "C4 out" },
    { n: 13, fn: "C0 in" },
    { n: 12, fn: "GND" },
    { n: 11, fn: "B1" },
    { n: 10, fn: "A1" },
    { n: 9, fn: "Σ1" },
  ],
}

/** Pin position on either side of a DIP-16 (pins 1–8 left, 9–16 right). */
export const pinAt = (c: Chip, n: number) => (n <= 8 ? pinL(c, n) : pinR(c, n))
export function NC({ c, n, text = "N/C" }: { c: Chip; n: number; text?: string }) {
  const p = pinAt(c, n)
  const left = n <= 8
  return (
    <text x={p.x + (left ? -8 : 8)} y={p.y + 5} className="hand" fontSize={13} fill="#a1a1aa" textAnchor={left ? "end" : "start"}>
      {text}
    </text>
  )
}
