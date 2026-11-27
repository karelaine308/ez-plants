#!/usr/bin/env node
// Finds the age and day a plant is most expensive, for its PEAKS entry in
// test/geometry-budget-peak.test.js (a plant with no entry fails that test).
//   node scripts/peak-sweep.mjs <plant> [rootDir] [--step 15] [--ages 3,5,8]
// Prints, per LOD band, the worst triangle count and where it happened, plus the draw counts.
// Slow (one build per age and day): about a minute for the default sweep. Record the result in
// PEAKS held to the rule 9 target, and re-run it when the plant's phenology changes.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const [plant, rootArg] = positional;
if (!plant) { console.error('usage: peak-sweep.mjs <plant> [rootDir] [--step 15] [--ages 3,5,8]'); process.exit(2); }
const root = resolve(rootArg ?? new URL('..', import.meta.url).pathname);
const step = Number(opt('--step', 15));
const ages = opt('--ages', '3,5,8').split(',').map(Number);
const Class = plant[0].toUpperCase() + plant.slice(1);
const Plant = (await import(pathToFileURL(`${root}/src/lib/plants/${plant}/${plant}.js`).href))[Class];
const { createPlantPrototype } = await import(pathToFileURL(`${root}/src/lib/field/plant-prototype.js`).href);
if (!Plant) { console.error(`${plant}.js does not export ${Class}`); process.exit(2); }

const tri = (g) => { const a = g?.index ?? g?.attributes?.position; return a ? a.count / 3 : 0; };
const measure = (plantObj) => {
  const proto = createPlantPrototype(plantObj);
  try {
    return proto.bands.map((b) => {
      const drawn = b.baked.organs.filter((o) => o.count > 0);
      return { t: Math.round(drawn.reduce((s, o) => s + tri(o.geometry) * o.count, 0) + (b.baked.wood ? tri(b.baked.wood.geometry) : 0)), d: drawn.length + (b.baked.wood ? 1 : 0) };
    });
  } finally { proto.dispose(); }
};
let peak = [], at = [], draws = [];
for (const age of ages) for (let day = 5; day <= 365; day += step) {
  const p = new Plant({ seed: 'budget', ageYears: age, dayOfYear: day });
  const m = measure(p); p.dispose();
  m.forEach((b, i) => { if (!(b.t <= (peak[i] ?? -1))) { peak[i] = b.t; at[i] = { age, day }; } draws[i] = Math.max(draws[i] ?? 0, b.d); });
}
console.log(`peak-sweep ${plant}: ages ${ages.join('/')}, every ${step} days`);
peak.forEach((t, i) => console.log(`band ${i}: ${t} triangles at age ${at[i].age} day ${at[i].day}`));
console.log(`draws per band (max over sweep): ${draws.join(' / ')}`);
console.log('PEAKS entry (use the band with the highest overall load for age/day):');
console.log(`  ${plant}: { age: ${at[0].age}, day: ${at[0].day}, triangles: [${peak.join(', ')}], draws: [${draws.join(', ')}] },`);
