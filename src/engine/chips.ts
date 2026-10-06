/* ============================================================================
   TTL parts used by the solver: pinout + a functional model for simulation.
   ========================================================================== */

export type ChipType =
  | "7400" | "7402" | "7404" | "7408" | "7432" | "7486"
  | "74157" | "74153" | "74151" | "74150" | "7483" | "FA"

export type ChipDef = {
  name: string
  desc: string
  pins: number // 0 = abstract block (named pins only)
  vcc?: number
  gnd?: number
  pinNames: Record<string, string> // pin → name
  /** Given input-pin values, return output-pin values. */
  model: (v: (pin: string) => number) => Record<string, number>
}

type Gate2 = [string, string, string] // in, in, out
const QUAD: Gate2[] = [["1", "2", "3"], ["4", "5", "6"], ["9", "10", "8"], ["12", "13", "11"]]
const QUAD_NOR: Gate2[] = [["2", "3", "1"], ["5", "6", "4"], ["8", "9", "10"], ["11", "12", "13"]]
export const HEX_NOT: [string, string][] = [["1", "2"], ["3", "4"], ["5", "6"], ["9", "8"], ["11", "10"], ["13", "12"]]

const quad = (name: string, desc: string, g: Gate2[], f: (a: number, b: number) => number): ChipDef => ({
  name,
  desc,
  pins: 14,
  vcc: 14,
  gnd: 7,
  pinNames: Object.fromEntries(
    g.flatMap(([a, b, y], i) => [
      [a, `${i + 1}A`],
      [b, `${i + 1}B`],
      [y, `${i + 1}Y`],
    ]),
  ),
  model: (v) => Object.fromEntries(g.map(([a, b, y]) => [y, f(v(a), v(b))])),
})

export const GATE_PINS: Record<string, Gate2[]> = {
  "7400": QUAD, "7408": QUAD, "7432": QUAD, "7486": QUAD, "7402": QUAD_NOR,
}

// 74157: channel → [I0, I1, Y]
export const CH157: Gate2[] = [["2", "3", "4"], ["5", "6", "7"], ["11", "10", "9"], ["14", "13", "12"]]
// 74153: channel → data pins C0..C3, Y
export const CH153: { d: string[]; y: string; g: string }[] = [
  { d: ["6", "5", "4", "3"], y: "7", g: "1" },
  { d: ["10", "11", "12", "13"], y: "9", g: "15" },
]
export const D151 = ["4", "3", "2", "1", "15", "14", "13", "12"]
export const SEL151 = ["9", "10", "11"] // C (MSB), B, A
export const E150 = ["8", "7", "6", "5", "4", "3", "2", "1", "23", "22", "21", "20", "19", "18", "17", "16"]
export const SEL150 = ["11", "13", "14", "15"] // D (MSB), C, B, A
export const ADD83 = { a: ["10", "8", "3", "1"], b: ["11", "7", "4", "16"], s: ["9", "6", "2", "15"], c0: "13", c4: "14" }

export const CHIPS: Record<ChipType, ChipDef> = {
  "7400": quad("7400", "quad 2-input NAND", QUAD, (a, b) => 1 - (a & b)),
  "7402": quad("7402", "quad 2-input NOR", QUAD_NOR, (a, b) => 1 - (a | b)),
  "7408": quad("7408", "quad 2-input AND", QUAD, (a, b) => a & b),
  "7432": quad("7432", "quad 2-input OR", QUAD, (a, b) => a | b),
  "7486": quad("7486", "quad 2-input XOR", QUAD, (a, b) => a ^ b),
  "7404": {
    name: "7404",
    desc: "hex inverter",
    pins: 14,
    vcc: 14,
    gnd: 7,
    pinNames: Object.fromEntries(HEX_NOT.flatMap(([a, y], i) => [[a, `${i + 1}A`], [y, `${i + 1}Y`]])),
    model: (v) => Object.fromEntries(HEX_NOT.map(([a, y]) => [y, 1 - v(a)])),
  },
  "74157": {
    name: "74157",
    desc: "quad 2:1 MUX",
    pins: 16,
    vcc: 16,
    gnd: 8,
    pinNames: {
      "1": "S", "15": "G′",
      ...Object.fromEntries(CH157.flatMap(([a, b, y], i) => [[a, `${"abcd"[i]}I0`], [b, `${"abcd"[i]}I1`], [y, `${"abcd"[i]}Y`]])),
    },
    model: (v) => {
      const s = v("1")
      const en = 1 - v("15")
      return Object.fromEntries(CH157.map(([a, b, y]) => [y, en & (s ? v(b) : v(a))]))
    },
  },
  "74153": {
    name: "74153",
    desc: "dual 4:1 MUX",
    pins: 16,
    vcc: 16,
    gnd: 8,
    pinNames: {
      "14": "A (S LSB)", "2": "B (S MSB)", "1": "1G′", "15": "2G′", "7": "1Y", "9": "2Y",
      ...Object.fromEntries(CH153.flatMap((c, i) => c.d.map((p, j) => [p, `${i + 1}C${j}`]))),
    },
    model: (v) => {
      const s = v("2") * 2 + v("14")
      return Object.fromEntries(CH153.map((c) => [c.y, (1 - v(c.g)) & v(c.d[s])]))
    },
  },
  "74151": {
    name: "74151",
    desc: "8:1 MUX",
    pins: 16,
    vcc: 16,
    gnd: 8,
    pinNames: {
      "11": "A (S LSB)", "10": "B", "9": "C (S MSB)", "7": "G′", "5": "Y", "6": "W (Y′)",
      ...Object.fromEntries(D151.map((p, j) => [p, `D${j}`])),
    },
    model: (v) => {
      const s = v("9") * 4 + v("10") * 2 + v("11")
      const y = (1 - v("7")) & v(D151[s])
      return { "5": y, "6": 1 - y }
    },
  },
  "74150": {
    name: "74150",
    desc: "16:1 MUX (inverted output)",
    pins: 24,
    vcc: 24,
    gnd: 12,
    pinNames: {
      "15": "A (S LSB)", "14": "B", "13": "C", "11": "D (S MSB)", "9": "G′", "10": "W (Y′)",
      ...Object.fromEntries(E150.map((p, j) => [p, `E${j}`])),
    },
    model: (v) => {
      const s = v("11") * 8 + v("13") * 4 + v("14") * 2 + v("15")
      return { "10": 1 - ((1 - v("9")) & v(E150[s])) }
    },
  },
  "7483": {
    name: "7483",
    desc: "4-bit binary adder",
    pins: 16,
    vcc: 5,
    gnd: 12,
    pinNames: {
      ...Object.fromEntries(ADD83.a.map((p, i) => [p, `A${i + 1}`])),
      ...Object.fromEntries(ADD83.b.map((p, i) => [p, `B${i + 1}`])),
      ...Object.fromEntries(ADD83.s.map((p, i) => [p, `Σ${i + 1}`])),
      "13": "C0", "14": "C4",
    },
    model: (v) => {
      let c = v(ADD83.c0)
      const out: Record<string, number> = {}
      for (let i = 0; i < 4; i++) {
        const t = v(ADD83.a[i]) + v(ADD83.b[i]) + c
        out[ADD83.s[i]] = t & 1
        c = t >> 1
      }
      out[ADD83.c4] = c
      return out
    },
  },
  FA: {
    name: "Full adder",
    desc: "1-bit full adder",
    pins: 0,
    pinNames: { A: "A", B: "B", Cin: "Cin", S: "S", Cout: "Cout" },
    model: (v) => {
      const t = v("A") + v("B") + v("Cin")
      return { S: t & 1, Cout: t >> 1 }
    },
  },
}
