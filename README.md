# LogicBench

An ALU design and schematic tool. Define operations by select code, verify the circuit, and inspect the resulting block diagram, chip-level schematic, or pin-by-pin netlist.

## Features

- Configure 1–8-bit operands, 1–4 select lines, and the adder implementation.
- Enter arithmetic and logic operations for each select code.
- Simulate the circuit across its input cases and report whether the design matches the requested operations.
- View block diagrams, detailed TTL schematics, parts lists, and pin connections.
- Print or save schematics as PDF from the browser.
- Use built-in examples to explore supported designs.

The app runs entirely in the browser. It requires no backend, database, API keys, or environment variables. Detailed schematics are limited to designs with up to 60 ICs; larger designs can still be reviewed as netlists.

## Requirements

- Node.js `22.12+` on the 22.x line, or `24.x`
- pnpm `10.34.3`

`package.json` declares the supported Node.js versions. `.mise.toml` selects Node.js 22 and pnpm 10.34.3 as the default development tools.

## Getting started

Install dependencies and start the development server:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open [http://localhost:8443](http://localhost:8443). Changes to the source refresh automatically.

## Project commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the development server |
| `pnpm typecheck` | Check the TypeScript sources |
| `pnpm build` | Type-check and create the production site in `dist/` |
| `pnpm preview` | Serve the production build locally at `http://localhost:4173` |

Run `pnpm build` before `pnpm preview`.

## Project structure

| Path | Purpose |
| --- | --- |
| `src/App.tsx` | Application flow and result selection |
| `src/ui/` | Problem setup, summaries, and netlists |
| `src/engine/` | Expression parsing, circuit solving, and verification |
| `src/alu/` | ALU operation definitions and reference design derivation |
| `src/schematic/` | Block, automatic, and chip-level schematic renderers |
| `src/index.css` | Global styles and typography |
| `vite.config.ts` | Vite, React, and Tailwind configuration |
