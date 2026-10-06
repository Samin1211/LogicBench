// Shared MSB/LSB labels for the wide reference sheets.
export const tag = (bit: number, n: number) => (bit === n - 1 ? "MSB" : bit === 0 ? "LSB" : undefined)
export const tagP = (bit: number, n: number) => (tag(bit, n) ? " (" + tag(bit, n) + ")" : "")
