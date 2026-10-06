import { useState } from "react"
import { EXAMPLES, ProblemSetup, type Solved } from "./ui/ProblemSetup"
import { AutoSchematic } from "./schematic/AutoSchematic"
import { BlockDiagram } from "./schematic/BlockDiagram"
import { DesignSummary, NetlistTables } from "./ui/NetlistView"
import { sizeOf, type Problem } from "./engine/solve"
import { INK } from "./schematic/primitives"
import { ClassicSchematic } from "./schematic/classic/ClassicSchematic"

export default function App() {
  const [problem, setProblem] = useState<Problem>(EXAMPLES[0].p)
  const [solved, setSolved] = useState<Solved | null>(null)

  if (!solved)
    return (
      <div className="min-h-screen pb-16" style={{ color: INK }}>
        <ProblemSetup
          initial={problem}
          onNext={(s) => {
            setProblem(s.problem)
            setSolved(s)
            window.scrollTo(0, 0)
          }}
        />
      </div>
    )
  return <Result s={solved} onBack={() => setSolved(null)} />
}

function Result({ s, onBack }: { s: Solved; onBack: () => void }) {
  if (s.style === "detailed" && s.legacy) return <ClassicSchematic spec={s.legacy} onBack={onBack} />
  const size = sizeOf(s.design)
  return (
    <div className="min-h-screen pb-16" style={{ color: INK }}>
      <header className="sheet mx-auto mb-2 mt-10 max-w-[1360px] overflow-hidden rounded-2xl border border-[#e4e4e7] bg-white px-8 py-7 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="title text-3xl leading-tight">{s.problem.title}</h1>
            <p className="mt-1 text-sm text-[#71717a]">
              {s.problem.bits}-bit · select lines {s.problem.lines.join(" ")} · {size.chips} ICs
            </p>
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
              className="rounded-lg bg-[#18181b] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#3f3f46]"
            >
              Print / Save PDF
            </button>
          </div>
        </div>
        {s.style === "detailed" && size.tooLarge && (
          <p className="mt-4 rounded-lg border border-[#fde68a] bg-[#fffbeb] px-4 py-2.5 text-sm text-[#92400e]">
            Netlist only: this ALU is too large to draw (detailed sheets cover up to 60 ICs).
          </p>
        )}
      </header>
      {s.style === "block" && <BlockDiagram d={s.design} />}
      {s.style === "detailed" && !size.tooLarge && <AutoSchematic d={s.design} />}
      <DesignSummary d={s.design} />
      <NetlistTables d={s.design} />
    </div>
  )
}
