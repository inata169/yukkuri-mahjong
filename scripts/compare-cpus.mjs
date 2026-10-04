import { compareCpus } from "../src/game/comparison.js";

const options = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i].replace(/^--/, "");
  if (!["sets", "seed", "level"].includes(key) || process.argv[i + 1] == null)
    throw new Error("Usage: node scripts/compare-cpus.mjs --sets 5 --seed 20261004 --level 5");
  options[key] = Number(process.argv[i + 1]);
}
let final;
for (const result of compareCpus(options)) {
  final = result;
  process.stderr.write(`${result.completed}/${result.total} matches completed\n`);
}
console.log(JSON.stringify(final, null, 2));
