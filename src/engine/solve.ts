/* ============================================================================
   General ALU solver.

   Every arithmetic operation is reduced to   F = X + Y + Cin   on one shared
   adder, where X ∈ {A, A′, 0, 1…1}, Y ∈ {B, B′, 0, 1…1}, Cin ∈ {0, 1} and each
   is a function of the select lines only. Every logic operation is a per-bit
   function of (Aᵢ, Bᵢ) built from gates. An output MUX per bit picks the
   result. Every select-controlled choice uses the *fewest* select lines that
   can tell its values apart (unlisted codes are don't-cares), so the classic
   "one line splits arithmetic from logic" design falls out automatically when
   the table allows it.

   The result is a real netlist (chips, pins, nets). `verify` simulates it for
   every listed code and input combination before anything is shown.
   ========================================================================== */

import { ADD83, CH153, CH157, CHIPS, D151, E150, GATE_PINS, HEX_NOT, SEL150, SEL151, type ChipType } from "./chips"
import { evalExpr, ExprError, parseExpr, type Expr } from "./expr"

export type AdderKind = "7483" | "FA"
export type Problem = {
  title: string
  lines: string[] // select lines, MSB first
  bits: number
  adder: AdderKind
  ops: Record<string, string> // code → expression ('' = unused / don't care)
}

export type XV = "A" | "A′" | "0" | "1"
export type YV = "B" | "B′" | "0" | "1"
export type ArithForm = { x: XV; y: YV; c: 0 | 1 }

export type OpInfo = {
  code: string
  src: string
  expr: Expr
  arith?: ArithForm
  logic?: number // 4-bit truth table, index = Aᵢ·2 + Bᵢ
}

export class SolveError extends Error {}

/* ---------------------------------------------------------------- helpers */

export const codesOf = (k: number) => Array.from({ length: 1 << k }, (_, c) => c.toString(2).padStart(k, "0"))
const bitOfCode = (c: number, j: number, k: number) => (c >> (k - 1 - j)) & 1

function testPairs(n: number): [number, number][] {
  const m = 1 << n
  if (n <= 4) {
    const out: [number, number][] = []
    for (let a = 0; a < m; a++) for (let b = 0; b < m; b++) out.push([a, b])
    return out
  }
  const edge = [0, 1, m - 1, m - 2, m >> 1, (m >> 1) - 1]
  const out: [number, number][] = []
  for (const a of edge) for (const b of edge) out.push([a, b])
  let seed = 12345
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % m)
  for (let i = 0; i < 160; i++) out.push([rnd(), rnd()])
  return out
}

const XS: XV[] = ["A", "A′", "0", "1"]
const YS: YV[] = ["B", "B′", "0", "1"]
const xVal = (x: XV, a: number, m: number) => (x === "A" ? a : x === "A′" ? ~a & m : x === "0" ? 0 : m)
const yVal = (y: YV, b: number, m: number) => (y === "B" ? b : y === "B′" ? ~b & m : y === "0" ? 0 : m)

export const TT_NAME: Record<number, string> = {
  0: "0", 15: "1", 12: "A", 10: "B", 3: "A′", 5: "B′", 8: "A·B", 14: "A+B", 6: "A⊕B",
  7: "(A·B)′", 1: "(A+B)′", 9: "(A⊕B)′", 4: "A·B′", 2: "A′·B", 13: "A+B′", 11: "A′+B",
}

export function classify(src: string, code: string, n: number): OpInfo {
  let expr: Expr
  try {
    expr = parseExpr(src)
  } catch (e) {
    if (e instanceof ExprError) throw new SolveError(`Code ${code}: “${src}” — ${e.message}`)
    throw e
  }
  const m = (1 << n) - 1
  const pairs = testPairs(n)
  const f = (a: number, b: number) => evalExpr(expr, a, b, n)
  const info: OpInfo = { code, src, expr }

  search: for (const x of XS)
    for (const y of YS)
      for (const c of [0, 1] as const)
        if (pairs.every(([a, b]) => ((xVal(x, a, m) + yVal(y, b, m) + c) & m) === f(a, b))) {
          info.arith = { x, y, c }
          break search
        }

  let tt = 0
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) if (f(a, b) & 1) tt |= 1 << (a * 2 + b)
  const bitwise = (a: number, b: number) => {
    let r = 0
    for (let i = 0; i < n; i++) if ((tt >> ((((a >> i) & 1) << 1) | ((b >> i) & 1))) & 1) r |= 1 << i
    return r
  }
  if (pairs.every(([a, b]) => bitwise(a, b) === f(a, b))) info.logic = tt

  if (!info.arith && info.logic === undefined)
    throw new SolveError(
      `Code ${code}: “${src}” can't be built from one adder plus gates — it is neither X + Y + Cin ` +
        `(X ∈ A, A′, 0, −1 · Y ∈ B, B′, 0, −1) nor a bit-by-bit logic function of A and B.`,
    )
  return info
}

/** Data value on each MUX input when `sel` lines drive it (undefined = free). */
export function muxInputs<T>(table: (T | undefined)[], sel: number[], k: number): (T | undefined)[] {
  return Array.from({ length: 1 << sel.length }, (_, j) => {
    const c = table.findIndex(
      (v, c) => v !== undefined && sel.every((l, q) => bitOfCode(c, l, k) === ((j >> (sel.length - 1 - q)) & 1)),
    )
    return c < 0 ? undefined : table[c]
  })
}

/** Fewest select lines (indices into `lines`, MSB first) that separate the values. */
function minimalSelect(table: (string | undefined)[], k: number): number[] {
  const subsets: number[][] = []
  for (let mask = 0; mask < 1 << k; mask++) {
    const s: number[] = []
    for (let j = 0; j < k; j++) if (mask & (1 << (k - 1 - j))) s.push(j)
    subsets.push(s)
  }
  subsets.sort((p, q) => p.length - q.length)
  for (const s of subsets) {
    const seen = new Map<string, string>()
    let ok = true
    table.forEach((v, c) => {
      if (!ok || v === undefined) return
      const key = s.map((j) => bitOfCode(c, j, k)).join("")
      const prev = seen.get(key)
      if (prev !== undefined && prev !== v) ok = false
      else seen.set(key, v)
    })
    if (ok) return s
  }
  return [...Array(k).keys()]
}

type Cube = (0 | 1 | null)[] // per select line
/** Minimised sum-of-products for a select-line function with don't-cares. */
function minimiseSOP(table: (0 | 1 | undefined)[], k: number): Cube[] {
  const ones = table.flatMap((v, c) => (v === 1 ? [c] : []))
  const zeros = table.flatMap((v, c) => (v === 0 ? [c] : []))
  const all: Cube[] = []
  for (let t = 0; t < 3 ** k; t++) {
    const cube: Cube = []
    let r = t
    for (let j = 0; j < k; j++) cube.push(([0, 1, null] as const)[r % 3]), (r = Math.floor(r / 3))
    all.push(cube)
  }
  const covers = (cube: Cube, c: number) => cube.every((v, j) => v === null || v === bitOfCode(c, j, k))
  const valid = all.filter((cu) => !zeros.some((z) => covers(cu, z)) && ones.some((o) => covers(cu, o)))
  const contains = (big: Cube, small: Cube) => big.every((v, j) => v === null || v === small[j])
  const primes = valid.filter((p) => !valid.some((q) => q !== p && contains(q, p) && q.some((v, j) => v !== p[j])))
  const lits = (c: Cube) => c.filter((v) => v !== null).length
  // smallest cover by brute force (primes are few for ≤ 4 lines)
  for (let size = 1; size <= primes.length; size++) {
    let best: Cube[] | null = null
    const pick = (start: number, chosen: Cube[]) => {
      if (chosen.length === size) {
        if (ones.every((o) => chosen.some((cu) => covers(cu, o)))) {
          const cost = chosen.reduce((s, c) => s + lits(c), 0)
          if (!best || cost < best.reduce((s, c) => s + lits(c), 0)) best = [...chosen]
        }
        return
      }
      for (let i = start; i < primes.length; i++) pick(i + 1, [...chosen, primes[i]])
    }
    pick(0, [])
    if (best) return best
  }
  return []
}

/* ---------------------------------------------------------------- netlist */

export type Part = {
  id: string
  type: ChipType
  role: string
  pins: Record<string, string> // pin → net
  used: number
}

class Builder {
  parts: Part[] = []
  private counters: Record<string, number> = {}
  private pools = new Map<string, Part>()
  private cache = new Map<string, string>()
  constructor(public p: Problem) {}

  add(type: ChipType, prefix: string, role: string): Part {
    this.counters[prefix] = (this.counters[prefix] ?? 0) + 1
    const part: Part = { id: `${prefix}${this.counters[prefix]}`, type, role, pins: {}, used: 0 }
    const def = CHIPS[type]
    if (def.vcc) part.pins[def.vcc] = "VCC"
    if (def.gnd) part.pins[def.gnd] = "GND"
    this.parts.push(part)
    return part
  }

  private pooled(key: string, cap: number, make: () => Part): [Part, number] {
    let p = this.pools.get(key)
    if (!p || p.used >= cap) {
      p = make()
      this.pools.set(key, p)
    }
    return [p, p.used++]
  }

  not(net: string, name = `${net}′`): string {
    if (net === "VCC") return "GND"
    if (net === "GND") return "VCC"
    const key = `NOT|${net}`
    const hit = this.cache.get(key)
    if (hit) return hit
    const [part, i] = this.pooled("7404", 6, () => this.add("7404", "U", "inverters"))
    const [a, y] = HEX_NOT[i]
    part.pins[a] = net
    part.pins[y] = name
    this.cache.set(key, name)
    return name
  }

  gate(kind: "AND" | "OR" | "XOR" | "NAND" | "NOR", x: string, y: string): string {
    const key = `${kind}|${x}|${y}`
    const hit = this.cache.get(key)
    if (hit) return hit
    const type: ChipType = ({ AND: "7408", OR: "7432", XOR: "7486", NAND: "7400", NOR: "7402" } as const)[kind]
    const wrap = (s: string) => (s.length > 2 && /[+⊕·]/.test(s) ? `(${s})` : s)
    const sym = { AND: "·", OR: "+", XOR: "⊕", NAND: "·", NOR: "+" }[kind]
    let name = `${wrap(x)}${sym}${wrap(y)}`
    if (kind === "NAND" || kind === "NOR") name = `(${name})′`
    const [part, i] = this.pooled(type, 4, () => this.add(type, "U", `${kind} gates`))
    const [a, b, o] = GATE_PINS[type][i]
    part.pins[a] = x
    part.pins[b] = y
    part.pins[o] = name
    this.cache.set(key, name)
    return name
  }

  tree(kind: "AND" | "OR", nets: string[]): string {
    let cur = [...nets]
    while (cur.length > 1) {
      const next: string[] = []
      for (let i = 0; i < cur.length; i += 2) next.push(i + 1 < cur.length ? this.gate(kind, cur[i], cur[i + 1]) : cur[i])
      cur = next
    }
    return cur[0]
  }

  logic(tt: number, i: number): string {
    const A = `A${i}`
    const B = `B${i}`
    switch (tt) {
      case 0: return "GND"
      case 15: return "VCC"
      case 12: return A
      case 10: return B
      case 3: return this.not(A)
      case 5: return this.not(B)
      case 8: return this.gate("AND", A, B)
      case 14: return this.gate("OR", A, B)
      case 6: return this.gate("XOR", A, B)
      case 7: return this.gate("NAND", A, B)
      case 1: return this.gate("NOR", A, B)
      case 9: return this.not(this.gate("XOR", A, B))
      case 4: return this.gate("AND", A, this.not(B))
      case 2: return this.gate("AND", this.not(A), B)
      case 13: return this.gate("OR", A, this.not(B))
      case 11: return this.gate("OR", this.not(A), B)
    }
    throw new Error("bad truth table")
  }

  /** One MUX channel per bit choosing between values by the select lines. */
  choose(
    name: string,
    role: string,
    table: (string | undefined)[],
    resolve: (v: string, bit: number) => string,
  ): { nets: string[]; sel: number[] } {
    const { lines, bits } = this.p
    const k = lines.length
    const sel = minimalSelect(table, k)
    const nets: string[] = []
    const first = table.find((v) => v !== undefined)
    for (let i = 0; i < bits; i++) {
      if (sel.length === 0) {
        nets.push(first === undefined ? "GND" : resolve(first, i))
        continue
      }
      const valueAt = (j: number) => {
        // any code whose selected lines spell j (MSB first)
        const c = table.findIndex(
          (v, c) => v !== undefined && sel.every((l, q) => bitOfCode(c, l, k) === ((j >> (sel.length - 1 - q)) & 1)),
        )
        return c < 0 ? "GND" : resolve(table[c]!, i)
      }
      const out = `${name}${i}`
      const selNets = sel.map((j) => lines[j])
      const key = `${sel.length}|${role}|${selNets.join(",")}`
      if (sel.length === 1) {
        const [part, ch] = this.pooled(key, 4, () => {
          const p = this.add("74157", "M", role)
          p.pins["1"] = selNets[0]
          p.pins["15"] = "GND"
          return p
        })
        const [i0, i1, y] = CH157[ch]
        part.pins[i0] = valueAt(0)
        part.pins[i1] = valueAt(1)
        part.pins[y] = out
      } else if (sel.length === 2) {
        const [part, ch] = this.pooled(key, 2, () => {
          const p = this.add("74153", "M", role)
          p.pins["2"] = selNets[0]
          p.pins["14"] = selNets[1]
          p.pins["1"] = "GND"
          p.pins["15"] = "GND"
          return p
        })
        CH153[ch].d.forEach((pin, j) => (part.pins[pin] = valueAt(j)))
        part.pins[CH153[ch].y] = out
      } else if (sel.length === 3) {
        const p = this.add("74151", "M", role)
        SEL151.forEach((pin, q) => (p.pins[pin] = selNets[q]))
        p.pins["7"] = "GND"
        D151.forEach((pin, j) => (p.pins[pin] = valueAt(j)))
        p.pins["5"] = out
      } else {
        const p = this.add("74150", "M", role)
        SEL150.forEach((pin, q) => (p.pins[pin] = selNets[q]))
        p.pins["9"] = "GND"
        E150.forEach((pin, j) => (p.pins[pin] = valueAt(j)))
        p.pins["10"] = `${out}′`
        this.not(`${out}′`, out)
      }
      nets.push(out)
    }
    return { nets, sel }
  }

  sop(cubes: Cube[]): string {
    const { lines } = this.p
    const terms = cubes.map((cu) =>
      this.tree(
        "AND",
        cu.flatMap((v, j) => (v === null ? [] : [v ? lines[j] : this.not(lines[j])])),
      ),
    )
    return terms.length ? this.tree("OR", terms) : "GND"
  }

  adder(x: string[], y: string[], cin: string): string[] {
    const n = this.p.bits
    const sum: string[] = []
    if (this.p.adder === "FA") {
      let c = cin
      for (let i = 0; i < n; i++) {
        const fa = this.add("FA", "FA", `full adder, bit ${i}`)
        fa.id = `FA${i}`
        fa.pins.A = x[i]
        fa.pins.B = y[i]
        fa.pins.Cin = c
        fa.pins.S = `Σ${i}`
        c = i === n - 1 ? "Cout" : `C${i + 1}`
        fa.pins.Cout = c
        sum.push(`Σ${i}`)
      }
      return sum
    }
    let c = cin
    for (let chip = 0; chip * 4 < n; chip++) {
      const z = this.add("7483", "Z", `adder, bits ${chip * 4}–${Math.min(n, chip * 4 + 4) - 1}`)
      z.pins[ADD83.c0] = c
      for (let q = 0; q < 4; q++) {
        const i = chip * 4 + q
        if (i < n) {
          z.pins[ADD83.a[q]] = x[i]
          z.pins[ADD83.b[q]] = y[i]
          z.pins[ADD83.s[q]] = `Σ${i}`
          sum.push(`Σ${i}`)
        } else {
          z.pins[ADD83.a[q]] = "GND"
          z.pins[ADD83.b[q]] = "GND"
        }
      }
      c = (chip + 1) * 4 < n ? `C${(chip + 1) * 4}` : "Cout"
      z.pins[ADD83.c4] = c
    }
    return sum
  }
}

/* ---------------------------------------------------------------- design */

export type Design = {
  problem: Problem
  ops: (OpInfo & { role: "arith" | "logic" })[]
  parts: Part[]
  outputs: string[] // net per bit
  arith?: { x: (XV | undefined)[]; y: (YV | undefined)[]; cin: (0 | 1 | undefined)[]; cinText: string; xSel: number[]; ySel: number[] }
  outSel: number[]
  outTable: (string | undefined)[] // per code: "SUM" | "LU" | "T<tt>"
  logicSel?: number[]
  logicTable?: (string | undefined)[] // per code: "T<tt>" (two-level only)
  twoLevel: boolean
  notes: string[]
}

function build(p: Problem, ops: (OpInfo & { role: "arith" | "logic" })[], twoLevel: boolean): Design {
  const k = p.lines.length
  const N = 1 << k
  const at = <T,>(f: (o: (typeof ops)[number]) => T | undefined) => {
    const t: (T | undefined)[] = Array(N).fill(undefined)
    for (const o of ops) t[parseInt(o.code, 2)] = f(o)
    return t
  }
  const b = new Builder(p)
  const notes: string[] = []
  const arithOps = ops.filter((o) => o.role === "arith")
  const logicOps = ops.filter((o) => o.role === "logic")
  const fmtLines = (s: number[]) => s.map((j) => p.lines[j]).join(", ")
  const muxName = (s: number[]) => ["wire", "2:1 MUX (74157)", "4:1 MUX (74153)", "8:1 MUX (74151)", "16:1 MUX (74150)"][s.length]

  let sum: string[] = []
  let arith: Design["arith"]
  if (arithOps.length) {
    const x = at((o) => (o.role === "arith" ? o.arith!.x : undefined))
    const y = at((o) => (o.role === "arith" ? o.arith!.y : undefined))
    const cin = at((o) => (o.role === "arith" ? o.arith!.c : undefined))
    const res = (v: string, i: number) =>
      v === "A" ? `A${i}` : v === "B" ? `B${i}` : v === "A′" ? b.not(`A${i}`) : v === "B′" ? b.not(`B${i}`) : v === "0" ? "GND" : "VCC"
    const X = b.choose("X", "adder X-input MUX", x, res)
    const Y = b.choose("Y", "adder Y-input MUX", y, res)
    const cubes = minimiseSOP(cin, k)
    const cinNet = cin.some((v) => v === 1) ? (cin.some((v) => v === 0) ? b.sop(cubes) : "VCC") : "GND"
    const cinText =
      cinNet === "VCC" ? "1" : cinNet === "GND" ? "0"
      : cubes.map((cu) => cu.flatMap((v, j) => (v === null ? [] : [`${p.lines[j]}${v ? "" : "′"}`])).join("·")).join(" + ")
    sum = b.adder(X.nets, Y.nets, cinNet)
    arith = { x, y, cin, cinText, xSel: X.sel, ySel: Y.sel }
    notes.push(
      `Adder inputs: X ${X.sel.length ? `via ${muxName(X.sel)} on ${fmtLines(X.sel)}` : `= ${x.find(Boolean)} (fixed)`}, ` +
        `Y ${Y.sel.length ? `via ${muxName(Y.sel)} on ${fmtLines(Y.sel)}` : `= ${y.find(Boolean)} (fixed)`}, Cin = ${cinText}.`,
    )
  }

  let logicSel: number[] | undefined
  let logicTable: (string | undefined)[] | undefined
  let lu: string[] = []
  const distinctTT = [...new Set(logicOps.map((o) => o.logic!))]
  if (twoLevel) {
    logicTable = at((o) => (o.role === "logic" ? `T${o.logic}` : undefined))
    const L = b.choose("L", "logic-unit MUX", logicTable, (v, i) =>
      b.logic(+v.slice(1), i),
    )
    lu = L.nets
    logicSel = L.sel
    notes.push(`Logic unit: ${distinctTT.length} gate functions picked by a ${muxName(L.sel)} on ${fmtLines(L.sel)}.`)
  }
  const outTable = at((o) => (o.role === "arith" ? "SUM" : twoLevel ? "LU" : `T${o.logic}`))
  const out = b.choose("F", "output MUX", outTable, (v, i) => (v === "SUM" ? sum[i] : v === "LU" ? lu[i] : b.logic(+v.slice(1), i)))
  notes.push(
    out.sel.length
      ? `Output: ${muxName(out.sel)} per bit on ${fmtLines(out.sel)}${out.sel.length === 1 && arithOps.length && logicOps.length ? ` — ${p.lines[out.sel[0]]} alone separates arithmetic from logic` : ""}.`
      : "Output: a single unit drives F directly.",
  )
  return { problem: p, ops, parts: b.parts, outputs: out.nets, arith, outSel: out.sel, outTable, logicSel, logicTable, twoLevel, notes }
}

export function solve(p: Problem): Design {
  const k = p.lines.length
  if (k < 1 || k > 4) throw new SolveError("Use between 1 and 4 select lines.")
  if (new Set(p.lines).size !== k) throw new SolveError("Select line names must be different.")
  if (p.bits < 1 || p.bits > 8) throw new SolveError("Word width must be 1–8 bits.")
  const infos = codesOf(k)
    .filter((c) => (p.ops[c] ?? "").trim())
    .map((c) => classify(p.ops[c].trim(), c, p.bits))
  if (!infos.length) throw new SolveError("Enter at least one operation in the function table.")

  // ops that work either way (e.g. “A”, “0”) are tried in both units
  const both = infos.filter((o) => o.arith && o.logic !== undefined)
  const flex = both.length <= 6 ? both : []
  let best: Design | null = null
  for (let mask = 0; mask < 1 << flex.length; mask++) {
    const ops = infos.map((o) => {
      const fi = flex.indexOf(o)
      const role: "arith" | "logic" = fi >= 0 ? ((mask >> fi) & 1 ? "arith" : "logic") : o.logic !== undefined ? "logic" : "arith"
      return { ...o, role }
    })
    const nLogic = new Set(ops.filter((o) => o.role === "logic").map((o) => o.logic)).size
    for (const two of nLogic > 1 && ops.some((o) => o.role === "arith") ? [false, true] : [false]) {
      const d = build(p, ops, two)
      if (!best || d.parts.length < best.parts.length) best = d
    }
  }
  return best!
}

/* ---------------------------------------------------------------- simulate */

export function simulate(parts: Part[], inputs: Record<string, number>): Map<string, number> {
  const val = new Map<string, number>(Object.entries(inputs))
  val.set("VCC", 1)
  val.set("GND", 0)
  for (let pass = 0; pass < parts.length + 8; pass++) {
    let changed = false
    for (const part of parts) {
      const outs = CHIPS[part.type].model((pin) => val.get(part.pins[pin]) ?? 0)
      for (const [pin, v] of Object.entries(outs)) {
        const net = part.pins[pin]
        if (!net) continue
        if (val.get(net) !== v) (val.set(net, v), (changed = true))
      }
    }
    if (!changed) break
  }
  return val
}

export type Verification = { ok: true; checks: number } | { ok: false; code: string; a: number; b: number; want: number; got: number }

export function verify(d: Design): Verification {
  const { lines, bits: n } = d.problem
  const k = lines.length
  const pairs = testPairs(n)
  let checks = 0
  for (const o of d.ops) {
    const c = parseInt(o.code, 2)
    for (const [a, b] of pairs) {
      const inputs: Record<string, number> = {}
      lines.forEach((l, j) => (inputs[l] = bitOfCode(c, j, k)))
      for (let i = 0; i < n; i++) (inputs[`A${i}`] = (a >> i) & 1), (inputs[`B${i}`] = (b >> i) & 1)
      const v = simulate(d.parts, inputs)
      const got = d.outputs.reduce((s, net, i) => s | ((v.get(net) ?? 0) << i), 0)
      const want = evalExpr(o.expr, a, b, n)
      checks++
      if (got !== want) return { ok: false, code: o.code, a, b, want, got }
    }
  }
  return { ok: true, checks }
}

/* ---------------------------------------------------------------- reports */

export function describeOp(o: OpInfo & { role: "arith" | "logic" }): string {
  if (o.role === "arith") {
    const { x, y, c } = o.arith!
    return `X = ${x}, Y = ${y}, Cin = ${c}`
  }
  return `gate: ${TT_NAME[o.logic!]}`
}

export type PinRow = { pin: string; name: string; net: string; to: string[] }
export function partRows(d: Design, part: Part): PinRow[] {
  const def = CHIPS[part.type]
  const pinList = def.pins ? Array.from({ length: def.pins }, (_, i) => String(i + 1)) : Object.keys(def.pinNames)
  const where = new Map<string, string[]>()
  for (const p of d.parts)
    for (const [pin, net] of Object.entries(p.pins)) where.set(net, [...(where.get(net) ?? []), `${p.id}.${pin}`])
  return pinList.map((pin) => {
    const net = part.pins[pin]
    const name = pin === String(def.vcc) ? "VCC" : pin === String(def.gnd) ? "GND" : (def.pinNames[pin] ?? "")
    return {
      pin,
      name,
      net: net ?? "N/C",
      to: net && net !== "VCC" && net !== "GND" ? (where.get(net) ?? []).filter((s) => s !== `${part.id}.${pin}`) : [],
    }
  })
}

/** Size gate for detailed drawings: only enormous designs get the netlist only. */
export function sizeOf(d: Design) {
  const chips = d.parts.length
  const tooLarge = chips > 60
  return { chips, tooLarge }
}
