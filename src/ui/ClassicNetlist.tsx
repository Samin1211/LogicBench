// Pin-by-pin netlist for the classic reference schematic.

import type { Design } from "../alu/derive"
import { INK, RED } from "../schematic/primitives"

export function ClassicNetlist({ d }: { d: Design }) {
  const cell = "border border-[#e4e4e7] px-3 py-1.5 align-top"
  const head =
    "border border-[#18181b] bg-[#18181b] px-3 py-1.5 text-left text-white"

  return (
    <section className="sheet mx-auto my-10 max-w-[1360px] bg-white p-8 shadow-[0_2px_18px_rgba(0,0,0,0.14)] ring-1 ring-black/10">
      <h2 className="title mb-1 text-xl" style={{ color: INK }}>
        <span style={{ color: RED }}>④</span> &nbsp;Complete Netlist &amp;
        Function Table
      </h2>
      <p className="hand mb-6 text-base text-[#71717a]">
        Every pin, every connection — read straight down each column.
      </p>

      {/* function table */}
      <table className="hand mb-8 w-full border-collapse text-[15px]">
        <thead>
          <tr>
            {["S₂", "S₁", "S₀", "Output", "Function", "Unit"].map((h) => (
              <th key={h} className={head}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {d.table.map((r, i) => (
            <tr key={i} className={i % 2 ? "bg-[#fafafa]" : ""}>
              {[...r.bits, r.out, r.label, r.unit].map((c, j) => (
                <td
                  key={j}
                  className={cell + (j < 3 ? " text-center font-bold" : "")}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* netlists */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {d.netlist.map((grp) => (
          <table
            key={grp.ic}
            className="hand w-full border-collapse self-start text-[13.5px]"
          >
            <thead>
              <tr>
                <th className={head} colSpan={2}>
                  {grp.ic}
                </th>
              </tr>
              <tr>
                <th className="border border-[#18181b] bg-[#f4f4f5] px-3 py-1 text-left">
                  Pin
                </th>
                <th className="border border-[#18181b] bg-[#f4f4f5] px-3 py-1 text-left">
                  Connection
                </th>
              </tr>
            </thead>
            <tbody>
              {grp.rows.map((r, ri) => (
                <tr key={ri} className={ri % 2 ? "bg-[#fafafa]" : ""}>
                  <td className={cell + " num whitespace-nowrap"}>{r.pin}</td>
                  <td className={cell}>{r.sig}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </section>
  )
}
