/* ============================================================================
   ALU problem spec — the only thing a user should need to describe.
   Everything on the sheets (MUX data inputs, Cin logic, netlist, function
   table) is derived from this by `derive.ts`.
   ========================================================================== */

export const SELECT_LINES = ["S2", "S1", "S0"] as const
export type SelectLine = typeof SELECT_LINES[number]

/** What the arithmetic unit feeds into the adder's B input for one op. */
export type BInput = "0" | "1" | "B" | "B'"

export type ArithOpDef = {
  label: string
  short: string
  out: string // per-bit expression, ᵢ is replaced by the bit index
  b: BInput
  cin: 0 | 1
}

// Catalogue order is also the order ops are listed in sheet titles.
export const ARITH_OPS = {
  TRANSFER_A: {
    label: "Transfer A",
    short: "Transfer",
    out: "Aᵢ",
    b: "0",
    cin: 0,
  },
  ADD: { label: "Add", short: "Add", out: "Aᵢ + Bᵢ", b: "B", cin: 0 },
  SUBTRACT: {
    label: "Subtract",
    short: "Subtract",
    out: "Aᵢ − Bᵢ",
    b: "B'",
    cin: 1,
  },
  DECREMENT_A: {
    label: "Decrement A",
    short: "Decrement",
    out: "Aᵢ − 1",
    b: "1",
    cin: 0,
  },
  INCREMENT_A: {
    label: "Increment A",
    short: "Increment",
    out: "Aᵢ + 1",
    b: "0",
    cin: 1,
  },
  ADD_WITH_CARRY: {
    label: "Add with carry",
    short: "Add + 1",
    out: "Aᵢ + Bᵢ + 1",
    b: "B",
    cin: 1,
  },
  ADD_B_COMPLEMENT: {
    label: "A plus B′",
    short: "A + B′",
    out: "Aᵢ + Bᵢ′",
    b: "B'",
    cin: 0,
  },
} satisfies Record<string, ArithOpDef>
export type ArithOpKey = keyof typeof ARITH_OPS

export type GateKind = "NOT" | "BUF" | "OR" | "AND" | "XOR" | "NAND" | "NOR" | "XNOR"
export type LogicOpDef = {
  label: string
  tag: string
  out: string
  gate: GateKind
  src: "A" | "B" | "AB"
}

export const LOGIC_OPS = {
  COMPLEMENT_A: {
    label: "Complement A",
    tag: "complement",
    out: "Aᵢ′",
    gate: "NOT",
    src: "A",
  },
  COMPLEMENT_B: {
    label: "Complement B",
    tag: "complement B",
    out: "Bᵢ′",
    gate: "NOT",
    src: "B",
  },
  TRANSFER_A: {
    label: "Transfer A",
    tag: "transfer",
    out: "Aᵢ",
    gate: "BUF",
    src: "A",
  },
  TRANSFER_B: {
    label: "Transfer B",
    tag: "transfer B",
    out: "Bᵢ",
    gate: "BUF",
    src: "B",
  },
  AND: { label: "AND", tag: "AND", out: "Aᵢ ∧ Bᵢ", gate: "AND", src: "AB" },
  OR: { label: "OR", tag: "OR", out: "Aᵢ ∨ Bᵢ", gate: "OR", src: "AB" },
  XOR: { label: "XOR", tag: "XOR", out: "Aᵢ ⊕ Bᵢ", gate: "XOR", src: "AB" },
  NAND: {
    label: "NAND",
    tag: "NAND",
    out: "(Aᵢ ∧ Bᵢ)′",
    gate: "NAND",
    src: "AB",
  },
  NOR: { label: "NOR", tag: "NOR", out: "(Aᵢ ∨ Bᵢ)′", gate: "NOR", src: "AB" },
  XNOR: {
    label: "XNOR",
    tag: "XNOR",
    out: "(Aᵢ ⊕ Bᵢ)′",
    gate: "XNOR",
    src: "AB",
  },
} satisfies Record<string, LogicOpDef>
export type LogicOpKey = keyof typeof LOGIC_OPS

export const GATE_ICS: Partial<Record<GateKind, string>> = {
  NOT: "7404",
  OR: "7432",
  AND: "7408",
  XOR: "7486",
  NAND: "7400",
  NOR: "7402",
  XNOR: "74266",
}

export type AluOperation = {
  /** Select code in S2 S1 S0 order, e.g. '110'. 'X' = don't care. */
  code: string
  op: ArithOpKey | LogicOpKey
}

export type AluSpec = {
  title: string
  subtitle: string
  bits: 2 | 3 | 4
  /** Line that picks between the logic and arithmetic unit (drives M2). */
  unitSelect: SelectLine
  /** Value of `unitSelect` that selects the arithmetic unit. */
  arithWhen: 0 | 1
  operations: AluOperation[]
}
