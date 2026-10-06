// Hand-tuned reference schematic for problems that match the classic ALU.

import { useMemo } from "react"
import type { AluSpec } from "../../alu/spec"
import { deriveDesign, SpecError } from "../../alu/derive"
import { ClassicNetlist } from "../../ui/ClassicNetlist"
import { INK } from "../primitives"
import { ArithSheetWide, CombinedSheetWide, LogicSheetWide } from "../WideSheets"
import { ArithSheet } from "./ArithSheet"
import { CombinedSheet } from "./CombinedSheet"
import { LogicSheet } from "./LogicSheet"

export function ClassicSchematic({ spec, onBack }: { spec: AluSpec; onBack: () => void }) {
  const result = useMemo(() => {
    try {
      return { design: deriveDesign(spec) }
    } catch (e) {
      if (e instanceof SpecError) return { error: e.message }
      throw e
    }
  }, [spec])

  const gates = result.design?.gateIcs ?? []

  return (
    <div className="min-h-screen pb-16" style={{ color: INK }}>
      <header className="sheet mx-auto mb-2 mt-10 max-w-[1360px] bg-white px-8 py-7 shadow-[0_2px_18px_rgba(0,0,0,0.14)] ring-1 ring-black/10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="title text-3xl leading-tight" style={{ color: INK }}>
              {spec.title}
            </h1>
            {spec.subtitle && <p className="hand mt-2 text-lg text-[#71717a]">{spec.subtitle}</p>}
          </div>
          <div className="no-print flex gap-2">
            <button
              onClick={onBack}
              className="rounded-lg border border-[#e4e4e7] bg-white px-4 py-2 text-sm font-medium text-[#18181b] transition-colors hover:bg-[#f4f4f5]"
            >
              ← Edit problem
            </button>
            <button
              onClick={() => window.print()}
              className="no-print rounded-lg bg-[#18181b] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#3f3f46]"
            >
              Print / Save PDF
            </button>
          </div>
        </div>
        <p className="hand mt-4 max-w-3xl text-[15px] leading-relaxed text-[#3f3f46]">
          Built from your written solution. ICs: <b>2 × 74157</b> quad 2:1 MUX
          (M1, M2), <b>{(result.design?.bits ?? 2) > 2 ? "2 × 74153" : "1 × 74153"}</b> dual 4:1 MUX ({(result.design?.bits ?? 2) > 2 ? "CM1, CM2" : "CM1"}), <b>1 × 7483</b> 4-bit
          adder
          {gates.length > 0 && ", plus "}
          {gates.map((g, i) => {
            const [ic, kind] = g.split(" ")
            return (
              <span key={g}>
                {i > 0 && (i === gates.length - 1 ? " and " : ", ")}
                <b>{ic}</b> {kind}
              </span>
            )
          })}
          {gates.length > 0 && " gates"}. Pin numbers are boxed at every pin;
          red labels name the signal on each wire.
        </p>
      </header>

      {result.design ? (
        <>
          {result.design.bits === 2 ? (
            <>
              <LogicSheet d={result.design} />
              <ArithSheet d={result.design} />
              <CombinedSheet d={result.design} />
            </>
          ) : (
            <>
              <LogicSheetWide d={result.design} />
              <ArithSheetWide d={result.design} />
              <CombinedSheetWide d={result.design} />
            </>
          )}
          <ClassicNetlist d={result.design} />
        </>
      ) : (
        <section className="sheet mx-auto my-10 max-w-[1360px] rounded-2xl border border-[#fecaca] bg-white px-8 py-6">
          <h2 className="title text-lg" style={{ color: "#b91c1c" }}>
            This ALU can't be built with the current template
          </h2>
          <p className="hand mt-2 text-lg">{result.error}</p>
        </section>
      )}
    </div>
  )
}
