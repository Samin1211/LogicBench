import {
  ARITH_OPS,
  GATE_ICS,
  LOGIC_OPS,
  SELECT_LINES,
  type AluSpec,
  type ArithOpKey,
  type BInput,
  type GateKind,
  type LogicOpKey,
  type SelectLine,
} from "./spec"

/* ============================================================================
   Solver: AluSpec → Design (everything the sheets need to draw).
   Template: M1 (74157) logic unit · CM1 (74153) + 7483 arithmetic unit ·
   M2 (74157) merge on `unitSelect`.
   ========================================================================== */

const SUBS = "₀₁₂₃₄₅₆₇₈₉"
export const sub = (n: number) => String(n).replace(/\d/g, (d) => SUBS[+d])
export const fmtSel = (s: SelectLine) => "S" + sub(+s.slice(1))
export const bitExpr = (expr: string, bit: number) =>
  expr.replace(/ᵢ/g, sub(bit))
export const compact = (expr: string) => expr.replace(/ /g, "")

export class SpecError extends Error {}

// ---- 74-series pin maps ----------------------------------------------------
/** 74157 quad 2:1 MUX channels a..d. Channel j carries bit (n-1-j) — MSB on a. */
export const MUX157 = [
  { name: "a", i0: 2, i1: 3, y: 4 },
  { name: "b", i0: 5, i1: 6, y: 7 },
  { name: "c", i0: 11, i1: 10, y: 9 },
  { name: "d", i0: 14, i1: 13, y: 12 },
]
export const chan157 = (n: number, bit: number) => MUX157[n - 1 - bit]
/** 74153 dual 4:1 MUX channels: data pins I0..I3, output, enable. */
export const MUX153 = [
  { name: "a", d: [6, 5, 4, 3], y: 7, en: 1 },
  { name: "b", d: [10, 11, 12, 13], y: 9, en: 15 },
]
/** Which 74153 (0 = CM1, 1 = CM2) and which channel serves a bit. */
export const cmOf = (n: number, bit: number) => ({ chip: (n - 1 - bit) >> 1, ch: (n - 1 - bit) & 1 })
/** 7483 pins per bit 0..3. */
export const ADDER = { a: [10, 8, 3, 1], b: [11, 7, 4, 16], s: [9, 6, 2, 15] }
/** Bit indices MSB → LSB. */
export const bitsDesc = (n: number) => Array.from({ length: n }, (_, i) => n - 1 - i)
const ranges = (ps: number[]) => {
  const out: string[] = []
  for (let i = 0; i < ps.length; ) {
    let j = i
    while (j + 1 < ps.length && ps[j + 1] === ps[j] + 1) j++
    out.push(j - i >= 2 ? `${ps[i]}–${ps[j]}` : ps.slice(i, j + 1).join(","))
    i = j + 1
  }
  return out.join(",")
}

export type Lit = { line: SelectLine; neg: boolean }
export type CinExpr = { kind: "const"; value: 0 | 1 } | {
  kind: "lit"
  lit: Lit
} | { kind: "and"; a: Lit; b: Lit } | { kind: "sop"; terms: Lit[][] }

export type NetRow = { pin: string; sig: string }

export type Design = {
  spec: AluSpec
  unitLine: SelectLine
  arithWhen: 0 | 1
  /** CM1 select lines: hi → pin 2 (B sel), lo → pin 14 (A sel). */
  hi: SelectLine
  lo: SelectLine
  /** Arithmetic op per CM1 data index (hi·2 + lo), null = unused. */
  arithSlots: (ArithOpKey | null)[]
  /** CM1 data input per index I0..I3. */
  cm1: BInput[]
  cin: CinExpr
  cinText: string
  logic: { sel: SelectLine; in0: LogicOpKey; in1: LogicOpKey }
  bits: number
  /** M2 data pin carrying each bit (index = bit) of each unit. */
  m2: { logic: number[]; arith: number[] }
  table: {
    bits: string[]
    out: string
    label: string
    unit: "Arithmetic" | "Logic"
  }[]
  gateIcs: string[]
  titles: {
    logic: string
    logicNote: string
    arith: string
    arithNote: string
    combinedNote: string
  }
  netlist: { ic: string; rows: NetRow[] }[]
}

const litText = (l: Lit) => fmtSel(l.line) + (l.neg ? "′" : "")

function expand(code: string): string[] {
  const i = code.indexOf("X")
  if (i < 0) return [code]
  return ["0", "1"].flatMap((b) =>
    expand(code.slice(0, i) + b + code.slice(i + 1)),
  )
}

// Two-variable minimiser over (hi, lo) with don't-cares.
function minimise(
  ones: number[],
  zeros: number[],
  hi: SelectLine,
  lo: SelectLine,
): CinExpr {
  if (!ones.length) return { kind: "const", value: 0 }
  if (!zeros.length) return { kind: "const", value: 1 }
  const val = (l: Lit, m: number) => {
    const b = l.line === hi ? (m >> 1) & 1 : m & 1
    return l.neg ? 1 - b : b
  }
  const covers = (t: Lit[], m: number) => t.every((l) => val(l, m) === 1)
  const singles: Lit[][] = [hi, lo].flatMap((line) =>
    [false, true].map((neg) => [{ line, neg }]),
  )
  const pairs: Lit[][] = [false, true].flatMap((nh) =>
    [false, true].map((nl) => [
      { line: hi, neg: nh },
      { line: lo, neg: nl },
    ]),
  )
  const valid = [...singles, ...pairs].filter((t) =>
    zeros.every((z) => !covers(t, z)),
  )
  const one = valid.find((t) => ones.every((m) => covers(t, m)))
  if (one)
    return one.length === 1
      ? { kind: "lit", lit: one[0] }
      : { kind: "and", a: one[0], b: one[1] }
  for (let i = 0; i < valid.length; i++)
    for (let j = i + 1; j < valid.length; j++)
      if (ones.every((m) => covers(valid[i], m) || covers(valid[j], m)))
        return { kind: "sop", terms: [valid[i], valid[j]] }
  throw new SpecError("Could not minimise the carry-in expression.")
}

export function cinToText(c: CinExpr) {
  if (c.kind === "const") return String(c.value)
  if (c.kind === "lit") return litText(c.lit)
  if (c.kind === "and") return `${litText(c.a)}·${litText(c.b)}`
  return c.terms.map((t) => t.map(litText).join("·")).join(" + ")
}

const BIN_LABEL: Record<BInput, (bit: number) => string> = {
  "0": () => "GND = 0",
  "1": () => "Vcc = 1",
  B: (bit) => `B${sub(bit)}`,
  "B'": (bit) => `B${sub(bit)}′`,
}

export function deriveDesign(spec: AluSpec): Design {
  const unitLine = spec.unitSelect
  const arithWhen = spec.arithWhen
  const [hi, lo] = SELECT_LINES.filter((s) => s !== unitLine)
  const at = (code: string, line: SelectLine) =>
    code[SELECT_LINES.indexOf(line)]
  const idx = (code: string) => +at(code, hi) * 2 + +at(code, lo)

  const arithSlots: (ArithOpKey | null)[] = [null, null, null, null]
  const logicMap = new Map<number, LogicOpKey>()

  for (const { code, op } of spec.operations) {
    if (!/^[01X]{3}$/.test(code))
      throw new SpecError(
        `Select code "${code}" must be 3 characters of 0, 1 or X.`,
      )
    const u = at(code, unitLine)
    if (u === "X")
      throw new SpecError(
        `Code ${code}: the unit select line ${fmtSel(unitLine)} cannot be a don't-care.`,
      )
    const isArith = +u === arithWhen
    if (isArith && !(op in ARITH_OPS))
      throw new SpecError(
        `Code ${code}: "${op}" is not an arithmetic operation.`,
      )
    if (!isArith && !(op in LOGIC_OPS))
      throw new SpecError(`Code ${code}: "${op}" is not a logic operation.`)
    for (const c of expand(code)) {
      const i = idx(c)
      const prev = isArith ? arithSlots[i] : logicMap.get(i)
      if (prev && prev !== op)
        throw new SpecError(`Code ${c} is assigned to both ${prev} and ${op}.`)
      if (isArith) arithSlots[i] = (op as ArithOpKey)
      else logicMap.set(i, op as LogicOpKey)
    }
  }
  if (arithSlots.every((s) => !s))
    throw new SpecError("Add at least one arithmetic operation.")
  if (!logicMap.size) throw new SpecError("Add at least one logic operation.")

  // ---- arithmetic unit: CM1 data inputs + carry-in -----------------------
  const cm1 = arithSlots.map((s) => (s ? ARITH_OPS[s].b : "0"))
  const ones = arithSlots.flatMap((s, i) => (s && ARITH_OPS[s].cin ? [i] : []))
  const zeros = arithSlots.flatMap((s, i) =>
    s && !ARITH_OPS[s].cin ? [i] : [],
  )
  const cin = minimise(ones, zeros, hi, lo)

  // ---- logic unit: a single 74157, so ops may depend on one line only -----
  const entries = [...logicMap.entries()]
  const dependsOnlyOn = (line: SelectLine) => {
    const bitOf = (i: number) => (line === hi ? (i >> 1) & 1 : i & 1)
    return entries.every(([i, a]) =>
      entries.every(([j, b]) => bitOf(i) !== bitOf(j) || a === b),
    )
  }
  const sel = dependsOnlyOn(hi) ? hi : dependsOnlyOn(lo) ? lo : null
  if (!sel)
    throw new SpecError(
      `The logic unit uses one 74157 (2 inputs per bit), so its operations must be chosen by a single select line — ${fmtSel(hi)} or ${fmtSel(lo)}.`,
    )
  const pick = (v: number) =>
    entries.find(([i]) => (sel === hi ? (i >> 1) & 1 : i & 1) === v)?.[1]
  const in0 = pick(0) ?? pick(1)!
  const in1 = pick(1) ?? in0
  const logic = { sel, in0, in1 }

  const n = spec.bits
  if (![2, 3, 4].includes(n)) throw new SpecError("Bit width must be 2, 3 or 4.")
  const bits = bitsDesc(n)
  const m2 = { logic: [] as number[], arith: [] as number[] }
  for (let b = 0; b < n; b++) {
    const ch = chan157(n, b)
    m2.logic[b] = arithWhen ? ch.i0 : ch.i1
    m2.arith[b] = arithWhen ? ch.i1 : ch.i0
  }

  // ---- presentation data -------------------------------------------------
  const table = spec.operations.map(({ code, op }) => {
    const isArith = +at(code, unitLine) === arithWhen
    const def = isArith
      ? ARITH_OPS[(op as ArithOpKey)]
      : LOGIC_OPS[(op as LogicOpKey)]
    return {
      bits: code.split(""),
      out: def.out,
      label: def.label,
      unit: isArith ? "Arithmetic" as const : "Logic" as const,
    }
  })

  const gates = new Set<GateKind>()
  for (const k of new Set([in0, in1])) gates.add(LOGIC_OPS[k].gate)
  if (cm1.includes("B'")) gates.add("NOT")
  if (cin.kind === "and") gates.add("AND")
  if (cin.kind === "lit" && cin.lit.neg) gates.add("NOT")
  const gateOrder: GateKind[] = [
    "NOT",
    "OR",
    "AND",
    "XOR",
    "NAND",
    "NOR",
    "XNOR",
  ]
  const gateIcs = gateOrder
    .filter((g) => gates.has(g))
    .map((g) => `${GATE_ICS[g]} ${g}`)

  const usedArith = (Object.keys(ARITH_OPS) as ArithOpKey[]).filter((k) =>
    arithSlots.includes(k),
  )
  const cinText = cinToText(cin)
  const l0 = LOGIC_OPS[in0]
  const l1 = LOGIC_OPS[in1]
  const cap = (s: string) => s[0].toUpperCase() + s.slice(1)
  const S = fmtSel
  const titles = {
    logic: `${
      in0 === in1 ? cap(l0.tag) : `${cap(l1.tag)} & ${cap(l0.tag)}`
    }  (select = ${S(sel)})`,
    logicNote: `M1 = 74157 quad 2:1 MUX · ${S(sel)}=0 → ${compact(l0.out)} (${l0.tag}) · ${S(sel)}=1 → ${compact(l1.out)} (${l1.tag})`,
    arith: usedArith.map((k) => ARITH_OPS[k].short).join(" / "),
    arithNote: `${n > 2 ? "CM1, CM2 = 2 × 74153" : "CM1 = 74153"} dual 4:1 MUX (B-input logic) · Adder = 7483 · Cin = ${cinText}`,
    combinedNote: `M2 = 74157 quad 2:1 MUX · ${S(unitLine)}=0 → ${
      arithWhen ? "logic" : "arithmetic"
    } unit · ${S(unitLine)}=1 → ${arithWhen ? "arithmetic" : "logic"} unit`,
  }

  const from = (k: LogicOpKey) => (LOGIC_OPS[k].gate === "BUF" ? "(direct)" : `(from ${LOGIC_OPS[k].gate})`)
  const cinSig =
    cin.kind === "const" ? (cin.value ? "Vcc" : "GND") : cin.kind === "and" ? `AND(${litText(cin.a)},${litText(cin.b)})` : cinText
  const slotNote = (i: number) => {
    const s = arithSlots[i]
    return s ? ` (${ARITH_OPS[s].short.toLowerCase()})` : " (unused)"
  }
  type Row = NetRow & { n: number }
  // used pins ascending, then one N/C row for the rest
  const sorted = (rows: Row[]) => {
    const used = new Set(rows.map((r) => r.n))
    const nc = Array.from({ length: 16 }, (_, i) => i + 1).filter((p) => !used.has(p))
    const out: NetRow[] = rows.sort((x, y) => x.n - y.n).map(({ pin, sig }) => ({ pin, sig }))
    if (nc.length) out.push({ pin: ranges(nc), sig: "N/C" })
    return out
  }

  // 74157 (M1 / M2): per-bit I0 / I1 / Y rows + power
  const mux157 = (selSig: string, i0: (b: number) => string, i1: (b: number) => string, y: (b: number) => string) => {
    const rows: Row[] = [
      { n: 1, pin: "1 S̄", sig: `${selSig} (select)` },
      { n: 8, pin: "8 GND", sig: "GND" },
      { n: 15, pin: "15 Ē", sig: "GND (enable)" },
      { n: 16, pin: "16 Vcc", sig: "Vcc" },
    ]
    for (let b = 0; b < n; b++) {
      const c = chan157(n, b)
      rows.push({ n: c.i0, pin: `${c.i0} I0${c.name}`, sig: i0(b) })
      rows.push({ n: c.i1, pin: `${c.i1} I1${c.name}`, sig: i1(b) })
      rows.push({ n: c.y, pin: `${c.y} Y${c.name}`, sig: y(b) })
    }
    return sorted(rows)
  }

  const m1Rows = mux157(
    S(sel),
    (b) => `${bitExpr(l0.out, b)} ${from(in0)}`,
    (b) => `${bitExpr(l1.out, b)} ${from(in1)}`,
    (b) => `→ M2 pin ${m2.logic[b]} (logic bit${b})`,
  )

  // 74153 (CM1, CM2)
  const cms = Array.from({ length: Math.ceil(n / 2) }, (_, chip) => {
    const rows: Row[] = [
      { n: 2, pin: "2 B sel", sig: S(hi) },
      { n: 8, pin: "8 GND", sig: "GND" },
      { n: 14, pin: "14 A sel", sig: S(lo) },
      { n: 16, pin: "16 Vcc", sig: "Vcc" },
    ]
    MUX153.forEach((ch, ci) => {
      const bit = bits.find((b) => cmOf(n, b).chip === chip && cmOf(n, b).ch === ci)
      rows.push({ n: ch.en, pin: `${ch.en} Ē${ch.name}`, sig: "GND" })
      ch.d.forEach((p, i) => {
        const sig = bit === undefined ? "GND (unused)" : BIN_LABEL[cm1[i]](bit) + (ci === 0 ? slotNote(i) : "")
        rows.push({ n: p, pin: `${p} I${i}${ch.name}`, sig })
      })
      rows.push({
        n: ch.y,
        pin: `${ch.y} Y${ch.name}`,
        sig: bit === undefined ? "N/C" : `Y${sub(bit)} → adder pin ${ADDER.b[bit]}`,
      })
    })
    const own = bits.filter((b) => cmOf(n, b).chip === chip)
    return {
      ic: `CM${chip + 1} · 74153 (B-logic${n > 2 ? `, bit ${own.join("–")}` : ""})`,
      rows: sorted(rows),
    }
  })

  // 7483 adder: unused high bits, power, A, B, Cin, Σ, N/C
  const adderRows: NetRow[] = []
  const gndPins: Row[] = []
  for (let b = n; b < 4; b++) {
    gndPins.push({ n: ADDER.a[b], pin: `${ADDER.a[b]} A${b + 1}`, sig: "GND" })
    gndPins.push({ n: ADDER.b[b], pin: `${ADDER.b[b]} B${b + 1}`, sig: "GND" })
  }
  gndPins.sort((x, y) => (x.n === 16 ? 99 : x.n) - (y.n === 16 ? 99 : y.n))
  adderRows.push(...gndPins.map(({ pin, sig }) => ({ pin, sig })))
  adderRows.push({ pin: "5 Vcc", sig: "Vcc" }, { pin: "12 GND", sig: "GND" })
  for (const b of bits) adderRows.push({ pin: `${ADDER.a[b]} A${b + 1}`, sig: `A${sub(b)} switch (a${sub(b)})` })
  for (const b of bits) {
    const { chip, ch } = cmOf(n, b)
    adderRows.push({ pin: `${ADDER.b[b]} B${b + 1}`, sig: `Y${sub(b)} ← CM${chip + 1} pin ${MUX153[ch].y}` })
  }
  adderRows.push({ pin: "13 C0(in)", sig: cinSig })
  for (const b of bits) adderRows.push({ pin: `${ADDER.s[b]} Σ${b + 1}`, sig: `→ M2 pin ${m2.arith[b]} (arith bit${b})` })
  const ncAdder = [
    ...[1, 2, 3].filter((b) => b >= n).map((b) => ({ p: ADDER.s[b], t: `Σ${b + 1}` })),
    { p: 14, t: "Cout" },
  ].sort((x, y) => x.p - y.p)
  adderRows.push({ pin: `${ncAdder.map((v) => v.p).join(",")} ${ncAdder.map((v) => v.t).join("/")}`, sig: "N/C" })

  const logicSrc = (b: number) => `M1 pin ${chan157(n, b).y} (logic bit${b})`
  const arithSrc = (b: number) => `adder Σ${b + 1} (arith bit${b})`
  const m2Rows = mux157(
    S(unitLine),
    (b) => (arithWhen ? logicSrc(b) : arithSrc(b)),
    (b) => (arithWhen ? arithSrc(b) : logicSrc(b)),
    (b) => `F${sub(b)} = ALU out bit${b}`,
  )

  const netlist = [
    { ic: "M1 · 74157 (Logic)", rows: m1Rows },
    ...cms,
    { ic: "Z · 7483 (Adder)", rows: adderRows },
    { ic: "M2 · 74157 (Merge)", rows: m2Rows },
  ]

  return {
    spec,
    unitLine,
    arithWhen,
    hi,
    lo,
    arithSlots,
    cm1,
    cin,
    cinText,
    logic,
    bits: n,
    m2,
    table,
    gateIcs,
    titles,
    netlist,
  }
}
