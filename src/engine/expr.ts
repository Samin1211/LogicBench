/* ============================================================================
   Operation expressions — what the user types in the function table.

     A + B + 1    A - B - 1    -A    A - 1    A ∪ B    A ∩ B    (A ⊕ B)′
     A AND B      A NOR B      ~A    A'       A plus B'     0     transfer A

   Precedence (low → high):  + −   ·   OR NOR   ·   XOR XNOR   ·   AND NAND
                             ·   unary − ~ ¬   ·   postfix ′
   Values are n-bit unsigned words; arithmetic wraps mod 2ⁿ.
   ========================================================================== */

export type Expr =
  | { k: "var"; v: "A" | "B" }
  | { k: "num"; v: number }
  | { k: "not"; e: Expr }
  | { k: "neg"; e: Expr }
  | { k: "bin"; op: BinOp; l: Expr; r: Expr }

export type BinOp = "+" | "-" | "AND" | "OR" | "XOR" | "NAND" | "NOR" | "XNOR"

export class ExprError extends Error {}

const WORDS: Record<string, string> = {
  AND: "AND", "∧": "AND", "∩": "AND", "&": "AND", "·": "AND", ".": "AND",
  OR: "OR", "∨": "OR", "∪": "OR", "|": "OR",
  XOR: "XOR", "⊕": "XOR", "^": "XOR",
  NAND: "NAND", NOR: "NOR", XNOR: "XNOR", "⊙": "XNOR",
  PLUS: "+", MINUS: "-", "−": "-", "–": "-",
  NOT: "~", "¬": "~", "!": "~",
  "′": "'", "’": "'", "`": "'",
}
// filler words people write in tables ("transfer A", "complement of B")
const FILLER = new Set(["TRANSFER", "OF", "THE", "F", "="])

type Tok = string

function lex(src: string): Tok[] {
  const out: Tok[] = []
  let i = 0
  const s = src.trim()
  while (i < s.length) {
    const c = s[i]
    if (/\s/.test(c)) {
      i++
      continue
    }
    if (/[A-Za-z]/.test(c)) {
      let j = i
      while (j < s.length && /[A-Za-z]/.test(s[j])) j++
      const w = s.slice(i, j).toUpperCase()
      i = j
      if (w === "A" || w === "B") out.push(w)
      else if (w === "COMPLEMENT") out.push("~")
      else if (WORDS[w]) out.push(WORDS[w])
      else if (FILLER.has(w)) continue
      else throw new ExprError(`Unknown word "${s.slice(i - w.length, i)}".`)
      continue
    }
    if (/[0-9]/.test(c)) {
      let j = i
      while (j < s.length && /[0-9]/.test(s[j])) j++
      out.push(s.slice(i, j))
      i = j
      continue
    }
    if ("+-()'~".includes(c)) out.push(c)
    else if (WORDS[c]) out.push(WORDS[c])
    else if (c === "=") {
      /* "F = A + B" */
    } else throw new ExprError(`Unexpected symbol "${c}".`)
    i++
  }
  return out
}

export function parseExpr(src: string): Expr {
  const t = lex(src)
  if (!t.length) throw new ExprError("Empty expression.")
  let p = 0
  const peek = () => t[p]
  const eat = (x?: string) => {
    if (x && t[p] !== x) throw new ExprError(`Expected "${x}".`)
    return t[p++]
  }
  const level = (ops: string[], next: () => Expr) => () => {
    let l = next()
    while (ops.includes(peek())) {
      const op = eat() as BinOp
      l = { k: "bin", op, l, r: next() }
    }
    return l
  }
  const unary = (): Expr => {
    const c = peek()
    if (c === "-") return eat(), { k: "neg", e: unary() }
    if (c === "~") return eat(), { k: "not", e: unary() }
    return postfix()
  }
  const postfix = (): Expr => {
    let e = atom()
    while (peek() === "'") eat(), (e = { k: "not", e })
    return e
  }
  const atom = (): Expr => {
    const c = eat()
    if (c === undefined) throw new ExprError("Expression ends too early.")
    if (c === "A" || c === "B") return { k: "var", v: c }
    if (/^\d+$/.test(c)) return { k: "num", v: +c }
    if (c === "(") {
      const e = sum()
      eat(")")
      return e
    }
    throw new ExprError(`Unexpected "${c}".`)
  }
  const and = level(["AND", "NAND"], unary)
  const xor = level(["XOR", "XNOR"], and)
  const or = level(["OR", "NOR"], xor)
  const sum: () => Expr = level(["+", "-"], or)
  const e = sum()
  if (p < t.length) throw new ExprError(`Unexpected "${t[p]}".`)
  return e
}

export function evalExpr(e: Expr, a: number, b: number, n: number): number {
  const m = (1 << n) - 1
  const go = (e: Expr): number => {
    switch (e.k) {
      case "var":
        return e.v === "A" ? a : b
      case "num":
        return e.v & m
      case "not":
        return ~go(e.e) & m
      case "neg":
        return -go(e.e) & m
      case "bin": {
        const l = go(e.l)
        const r = go(e.r)
        switch (e.op) {
          case "+": return (l + r) & m
          case "-": return (l - r) & m
          case "AND": return l & r
          case "OR": return l | r
          case "XOR": return l ^ r
          case "NAND": return ~(l & r) & m
          case "NOR": return ~(l | r) & m
          case "XNOR": return ~(l ^ r) & m
        }
      }
    }
  }
  return go(e)
}
