/* ============================================================================
   Bridge to the hand-drawn sheets: if a solved problem fits the classic
   template (S2 S1 S0 · 2–4 bits · 7483 · one line splits the units · X = A),
   express it as an AluSpec so the existing schematic sheets can draw it.
   ========================================================================== */

import { deriveDesign, SpecError } from "../alu/derive"
import { ARITH_OPS, LOGIC_OPS, SELECT_LINES, type AluOperation, type AluSpec } from "../alu/spec"
import type { Design } from "./solve"

const TT_OF: Record<string, number> = {
  "BUF|A": 12, "BUF|B": 10, "NOT|A": 3, "NOT|B": 5, "AND|AB": 8, "OR|AB": 14,
  "XOR|AB": 6, "NAND|AB": 7, "NOR|AB": 1, "XNOR|AB": 9,
}

export function toLegacy(d: Design): AluSpec | null {
  const p = d.problem
  if (p.adder !== "7483" || p.bits < 2 || p.bits > 4) return null
  if (p.lines.join() !== SELECT_LINES.join()) return null

  for (let L = 0; L < 3; L++)
    for (const v of [1, 0] as const) {
      const operations: AluOperation[] = []
      let ok = true
      for (const o of d.ops) {
        if (+o.code[L] === v) {
          const a = o.arith
          const key = a && a.x === "A" && Object.entries(ARITH_OPS).find(([, def]) => def.b === a.y.replace("′", "'") && def.cin === a.c)?.[0]
          if (!key) ok = false
          else operations.push({ code: o.code, op: key as AluOperation["op"] })
        } else {
          const key = o.logic !== undefined && Object.entries(LOGIC_OPS).find(([, def]) => TT_OF[`${def.gate}|${def.src}`] === o.logic)?.[0]
          if (!key) ok = false
          else operations.push({ code: o.code, op: key as AluOperation["op"] })
        }
        if (!ok) break
      }
      if (!ok) continue
      const spec: AluSpec = {
        title: p.title,
        subtitle: "",
        bits: p.bits as 2 | 3 | 4,
        unitSelect: SELECT_LINES[L],
        arithWhen: v,
        operations,
      }
      try {
        deriveDesign(spec)
        return spec
      } catch (e) {
        if (!(e instanceof SpecError)) throw e
      }
    }
  return null
}
