/* ============================================================================
   Home screen — describe any ALU problem. Each select code takes a typed
   expression; the row shows live how the solver reads it. "Next" solves and
   verifies; if the design is too wide to draw, the user is told up front
   that they will get the netlist only, and must confirm.
   ========================================================================== */

import { useMemo, useState, type ReactNode } from "react"
import { toLegacy } from "../engine/legacy"
import { classify, codesOf, sizeOf, solve, SolveError, verify, type AdderKind, type Design, type Problem, TT_NAME } from "../engine/solve"

export type DiagramStyle = "block" | "detailed"
export type Solved = { problem: Problem; design: Design; legacy: ReturnType<typeof toLegacy>; style: DiagramStyle }

export const EXAMPLES: { name: string; p: Problem }[] = [
  {
    name: "Example Inputs 1",
    p: {
      title: "2-bit ALU",
      lines: ["S2", "S1", "S0"],
      bits: 2,
      adder: "7483",
      ops: { "000": "A'", "001": "A'", "010": "A", "011": "A + B", "100": "A OR B", "101": "A OR B", "110": "A - 1", "111": "A - B" },
    },
  },
  {
    name: "Example Inputs 2",
    p: {
      title: "4-bit ALU",
      lines: ["S2", "S1", "S0"],
      bits: 4,
      adder: "7483",
      ops: { "001": "A OR B", "011": "A - B", "100": "A AND B", "111": "A XOR B" },
    },
  },
  {
    name: "Example Inputs 3",
    p: {
      title: "2-bit ALU (full adders)",
      lines: ["S3", "S2", "S1"],
      bits: 2,
      adder: "FA",
      ops: { "000": "A + B + 1", "010": "-A", "011": "A ∪ B", "100": "-B", "101": "A - B - 1", "110": "A - 1", "111": "A ∩ B" },
    },
  },
]

const field =
  "w-full rounded-lg border border-[#e4e4e7] bg-white px-3 py-2 text-sm text-[#18181b] outline-none transition focus:border-[#a5b4fc] focus:ring-4 focus:ring-[#eef2ff]"

function Step({ n, title, hint, children }: { n: string; title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-4 border-t border-[#f4f4f5] py-7 md:grid-cols-[220px_1fr]">
      <div>
        <h3 className="title text-lg leading-tight">
          <span className="num mr-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#eef2ff] align-middle text-xs text-[#4f46e5]">
            {n}
          </span>
          {title}
        </h3>
        {hint && <p className="mt-2 text-sm leading-snug text-[#71717a]">{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  )
}

function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg bg-[#f4f4f5] p-1">
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          onClick={() => onChange(o.v)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            o.v === value ? "bg-white text-[#18181b] shadow-sm" : "text-[#71717a] hover:text-[#18181b]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function rowStatus(src: string, code: string, bits: number): { tone: "idle" | "ok" | "err"; text: string } {
  if (!src.trim()) return { tone: "idle", text: "unused · don't care" }
  try {
    const o = classify(src, code, bits)
    const parts: string[] = []
    if (o.arith) parts.push(`adder: ${o.arith.x} + ${o.arith.y} + ${o.arith.c}`)
    if (o.logic !== undefined) parts.push(`gates: ${TT_NAME[o.logic]}`)
    return { tone: "ok", text: parts.join("  ·  ") }
  } catch (e) {
    if (e instanceof SolveError) return { tone: "err", text: e.message.replace(/^Code \d+: “.*?” — /, "") }
    throw e
  }
}

const parseLines = (s: string) => s.split(/[\s,]+/).filter(Boolean)

export function ProblemSetup({ initial, onNext }: { initial: Problem; onNext: (s: Solved) => void }) {
  const [p, setP] = useState<Problem>(initial)
  const [linesText, setLinesText] = useState(initial.lines.join(" "))
  const [errors, setErrors] = useState<string[]>([])
  const [pending, setPending] = useState<Solved | null>(null)
  const [style, setStyle] = useState<DiagramStyle>("block")

  const update = (np: Problem) => {
    setP(np)
    setErrors([])
    setPending(null)
  }
  const load = (np: Problem) => {
    update(np)
    setLinesText(np.lines.join(" "))
  }
  const setLines = (text: string) => {
    setLinesText(text)
    const lines = parseLines(text)
    if (lines.length >= 1 && lines.length <= 4) {
      const ops = lines.length === p.lines.length ? p.ops : {}
      update({ ...p, lines, ops })
    }
  }

  const k = p.lines.length
  const codes = codesOf(k)
  const used = codes.filter((c) => (p.ops[c] ?? "").trim()).length
  const status = useMemo(() => Object.fromEntries(codes.map((c) => [c, rowStatus(p.ops[c] ?? "", c, p.bits)])), [p, codes])

  const next = () => {
    const errs: string[] = []
    const lines = parseLines(linesText)
    if (!p.title.trim()) errs.push("Give the problem a title.")
    if (lines.length < 1 || lines.length > 4) errs.push("Use between 1 and 4 select lines.")
    if (errs.length) return setErrors(errs)
    let design: Design
    try {
      design = solve({ ...p, title: p.title.trim() })
    } catch (e) {
      if (e instanceof SolveError) return setErrors([e.message])
      throw e
    }
    const v = verify(design)
    if (!v.ok)
      return setErrors([
        `Internal check failed at code ${v.code} (A=${v.a}, B=${v.b}: expected ${v.want}, circuit gives ${v.got}). Please report this problem.`,
      ])
    const solved: Solved = { problem: design.problem, design, legacy: toLegacy(design), style }
    if (style === "block" || solved.legacy || !sizeOf(design).tooLarge) return onNext(solved)
    setPending(solved) // needs the netlist-only confirmation
  }

  const size = pending ? sizeOf(pending.design) : null

  return (
    <section className="sheet mx-auto my-10 max-w-[1100px] overflow-hidden rounded-2xl border border-[#e4e4e7] bg-white px-10 pb-10 pt-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-4 pb-6">
        <div>
          <h1 className="title text-3xl leading-tight">ALU Problem Setup</h1>
          <p className="mt-2 max-w-xl text-sm text-[#71717a]">
            Type each operation the way it's written in your question. The solver picks the multiplexers, gates and
            adder, then checks the circuit by simulating every case.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((e) => (
            <button
              key={e.name}
              type="button"
              onClick={() => load(e.p)}
              className="rounded-lg border border-[#e4e4e7] px-3 py-1.5 text-xs font-medium text-[#3f3f46] hover:bg-[#f4f4f5]"
            >
              {e.name}
            </button>
          ))}
        </div>
      </div>

      <Step n="1" title="Basics" hint="Printed in the header of the result.">
        <label className="block max-w-md">
          <span className="mb-1 block text-sm text-[#71717a]">Title *</span>
          <input className={field} value={p.title} onChange={(e) => update({ ...p, title: e.target.value })} />
        </label>
        <div className="mt-5 flex flex-wrap gap-x-10 gap-y-5">
          <div>
            <span className="mb-1 block text-sm text-[#71717a]">Word width (A, B, F)</span>
            <Segmented value={p.bits} options={[1, 2, 3, 4, 5, 6, 7, 8].map((b) => ({ v: b, label: `${b}` }))} onChange={(bits) => update({ ...p, bits })} />
          </div>
          <div>
            <span className="mb-1 block text-sm text-[#71717a]">Adder</span>
            <Segmented<AdderKind>
              value={p.adder}
              options={[
                { v: "7483", label: "7483 IC" },
                { v: "FA", label: "Full adders" },
              ]}
              onChange={(adder) => update({ ...p, adder })}
            />
          </div>
          <div>
            <span className="mb-1 block text-sm text-[#71717a]">Diagram style</span>
            <Segmented<DiagramStyle>
              value={style}
              options={[
                { v: "block", label: "Block diagram" },
                { v: "detailed", label: "Detailed schematic" },
              ]}
              onChange={(v) => {
                setStyle(v)
                setPending(null)
              }}
            />
            <span className="mt-1 block text-xs text-[#a1a1aa]">
              {style === "block" ? "MUX / adder / gate blocks — works for any size." : "Pin-level wiring for small ALUs; netlist only for large ones."}
            </span>
          </div>
        </div>
      </Step>

      <Step n="2" title="Select lines" hint="Names as in your question, most significant first. 1–4 lines.">
        <input className={`${field} num max-w-xs`} value={linesText} onChange={(e) => setLines(e.target.value)} placeholder="S2 S1 S0" />
        {(parseLines(linesText).length < 1 || parseLines(linesText).length > 4) && (
          <p className="mt-2 text-sm text-[#b91c1c]">Enter 1 to 4 names separated by spaces.</p>
        )}
      </Step>

      <Step
        n="3"
        title="Function table"
        hint="Leave a row empty if the code is unused. Accepts + − ′ ~ AND OR XOR NAND NOR XNOR ∧ ∨ ∪ ∩ ⊕ and numbers."
      >
        <div className="overflow-hidden rounded-xl border border-[#e4e4e7]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#fafafa] text-left text-xs uppercase tracking-wide text-[#71717a]">
                {p.lines.map((l) => (
                  <th key={l} className="num w-12 px-3 py-2 text-center font-semibold normal-case">
                    {l}
                  </th>
                ))}
                <th className="px-3 py-2 font-medium">Operation</th>
                <th className="px-3 py-2 font-medium">Solver reads it as</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => {
                const s = status[c]
                return (
                  <tr key={c} className="border-t border-[#f4f4f5]">
                    {[...c].map((b, j) => (
                      <td key={j} className="num px-3 py-1.5 text-center text-[#3f3f46]">
                        {b}
                      </td>
                    ))}
                    <td className="px-2 py-1.5">
                      <input
                        className={`${field} num py-1.5 ${s.tone === "err" ? "border-[#fecaca]" : ""}`}
                        value={p.ops[c] ?? ""}
                        placeholder="—"
                        onChange={(e) => update({ ...p, ops: { ...p.ops, [c]: e.target.value } })}
                      />
                    </td>
                    <td
                      className={`px-3 py-1.5 text-xs ${
                        s.tone === "err" ? "text-[#b91c1c]" : s.tone === "ok" ? "num text-[#4f46e5]" : "text-[#a1a1aa]"
                      }`}
                    >
                      {s.text}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-[#71717a]">
          {used} of {codes.length} codes used. Negative numbers are two's complement (−A = A′ + 1).
        </p>
      </Step>

      <div className="border-t border-[#f4f4f5] pt-7">
        {errors.length > 0 && (
          <div role="alert" className="mb-6 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-5 py-4">
            <p className="text-sm font-semibold text-[#b91c1c]">Can't build this yet</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#3f3f46]">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {pending && size && (
          <div role="status" className="mb-6 rounded-lg border border-[#fde68a] bg-[#fffbeb] px-5 py-4">
            <p className="text-sm font-semibold text-[#92400e]">
              {size.tooLarge ? "This ALU is too large to draw — you'll get the netlist only" : "Diagram not available for this architecture — you'll get the netlist only"}
            </p>
            <p className="mt-1.5 text-sm text-[#3f3f46]">
              {size.tooLarge
                ? `The solved design needs ${size.chips} ICs (${p.bits}-bit, ${k} select lines). Schematics are drawn for up to 4 bits, 3 select lines and 14 ICs.`
                : "It doesn't fit the classic logic-unit / arithmetic-unit sheet layout, and automatic drawing for other layouts isn't built yet."}{" "}
              The netlist is complete and has been verified by simulating every listed code.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => onNext(pending)}
                className="rounded-lg bg-[#18181b] px-4 py-2 text-sm font-medium text-white hover:bg-[#3f3f46]"
              >
                Continue with netlist only
              </button>
              <button
                type="button"
                onClick={() => setPending(null)}
                className="rounded-lg border border-[#e4e4e7] px-4 py-2 text-sm font-medium text-[#3f3f46] hover:bg-[#f4f4f5]"
              >
                Edit problem
              </button>
            </div>
          </div>
        )}

        {!pending && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={next}
              className="rounded-lg bg-[#18181b] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#3f3f46]"
            >
              Next — solve &amp; draw →
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
