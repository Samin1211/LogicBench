/* ============================================================================
   Generic result page for any solved design: architecture summary, function
   table, parts list and a full pin-by-pin netlist.
   ========================================================================== */

import { CHIPS } from "../engine/chips"
import { describeOp, partRows, verify, type Design } from "../engine/solve"

const card = "sheet mx-auto my-8 max-w-[1360px] overflow-hidden rounded-2xl border border-[#e4e4e7] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
const th = "border-b border-[#e4e4e7] bg-[#fafafa] px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-[#71717a]"
const td = "border-b border-[#f4f4f5] px-3 py-1.5 align-top"

export function DesignSummary({ d }: { d: Design }) {
  const p = d.problem
  const v = verify(d)
  const counts = new Map<string, number>()
  for (const part of d.parts) counts.set(part.type, (counts.get(part.type) ?? 0) + 1)
  return (
    <section className={card}>
      <div className="border-b border-[#e4e4e7] px-8 pb-4 pt-5">
        <h2 className="title text-xl">Solution</h2>
        <p className="text-sm text-[#71717a]">How the solver built this ALU.</p>
      </div>
      <div className="grid gap-8 px-8 py-6 lg:grid-cols-[1fr_320px]">
        <div>
          <ul className="space-y-1.5 text-sm text-[#3f3f46]">
            {d.notes.map((n) => (
              <li key={n} className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#4f46e5]" />
                {n}
              </li>
            ))}
          </ul>
          <table className="mt-6 w-full border-collapse text-sm">
            <thead>
              <tr>
                {p.lines.map((l) => (
                  <th key={l} className={`${th} num w-12 text-center normal-case`}>
                    {l}
                  </th>
                ))}
                <th className={th}>Operation</th>
                <th className={th}>Unit</th>
                <th className={th}>Implementation</th>
              </tr>
            </thead>
            <tbody>
              {d.ops.map((o) => (
                <tr key={o.code}>
                  {[...o.code].map((b, j) => (
                    <td key={j} className={`${td} num text-center`}>
                      {b}
                    </td>
                  ))}
                  <td className={`${td} num`}>{o.src}</td>
                  <td className={td}>{o.role === "arith" ? "Arithmetic" : "Logic"}</td>
                  <td className={`${td} num text-[#4f46e5]`}>{describeOp(o)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-[#71717a]">Codes not listed are don't-cares.</p>
        </div>
        <div>
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              v.ok ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]" : "border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]"
            }`}
          >
            {v.ok ? (
              <>
                <b>Verified.</b> The netlist was simulated for {v.checks.toLocaleString()} input cases and gave the right result every time.
              </>
            ) : (
              <>
                <b>Check failed</b> at code {v.code}: A={v.a}, B={v.b} → expected {v.want}, got {v.got}.
              </>
            )}
          </div>
          <h3 className="mt-6 text-xs font-medium uppercase tracking-wide text-[#71717a]">Parts</h3>
          <ul className="mt-2 divide-y divide-[#f4f4f5] text-sm">
            {[...counts].map(([type, n]) => (
              <li key={type} className="flex justify-between py-1.5">
                <span>
                  <b className="num">{CHIPS[type as keyof typeof CHIPS].name}</b>{" "}
                  <span className="text-[#71717a]">{CHIPS[type as keyof typeof CHIPS].desc}</span>
                </span>
                <span className="num">× {n}</span>
              </li>
            ))}
          </ul>
          <h3 className="mt-6 text-xs font-medium uppercase tracking-wide text-[#71717a]">Outputs</h3>
          <p className="num mt-2 text-sm">
            {d.outputs
              .map((net, i) => `F${i} = ${net}`)
              .reverse()
              .join(" · ")}
          </p>
        </div>
      </div>
    </section>
  )
}

export function NetlistTables({ d }: { d: Design }) {
  return (
    <section className={card}>
      <div className="border-b border-[#e4e4e7] px-8 pb-4 pt-5">
        <h2 className="title text-xl">Netlist</h2>
        <p className="text-sm text-[#71717a]">Every pin of every part. “Goes to” lists the other pins on the same wire.</p>
      </div>
      <div className="grid grid-cols-1 gap-6 px-8 py-6 md:grid-cols-2 xl:grid-cols-3">
        {d.parts.map((part) => (
          <div key={part.id} className="self-start overflow-hidden rounded-xl border border-[#e4e4e7]">
            <div className="flex items-baseline justify-between bg-[#18181b] px-3 py-2 text-white">
              <span className="text-sm font-semibold">
                {part.id} <span className="num font-normal text-[#a1a1aa]">{CHIPS[part.type].name}</span>
              </span>
              <span className="text-xs text-[#a1a1aa]">{part.role}</span>
            </div>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className={th}>Pin</th>
                  <th className={th}>Net</th>
                  <th className={th}>Goes to</th>
                </tr>
              </thead>
              <tbody>
                {partRows(d, part).map((r) => (
                  <tr key={r.pin}>
                    <td className={`${td} num whitespace-nowrap`}>
                      {r.pin}
                      {r.name && r.name !== r.pin && <span className="ml-1 font-normal text-[#a1a1aa]">{r.name}</span>}
                    </td>
                    <td className={`${td} num ${r.net === "N/C" ? "text-[#a1a1aa]" : ""}`}>{r.net}</td>
                    <td className={`${td} text-[#71717a]`}>{r.to.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </section>
  )
}
