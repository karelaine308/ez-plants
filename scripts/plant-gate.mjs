#!/usr/bin/env node
// Ground-truth gate, version 2. Scores one plant against the data file for that plant.
//   node scripts/plant-gate.mjs <plant> [rootDir] [--data <file>] [--json]
// The data file (scripts/ground-truth/<plant>.json) decides everything plant-specific:
//   peakAge / peakDay  optional (default 5 and 205): the age and day height, ramps and structure are
//                   measured at. Set the day to the plant's own peak; 205 is wrong for a spring bloomer.
//   class / entry   optional; default to Capitalised folder name and src/lib/plants/<plant>/<plant>.js
//   stats           which names in plant.stats() mean heads, flowers, stems, seedHeads, height
//   sources         the link list (rule 4C). Every check must list the source ids it rests on.
//   checks          each has a type, a tier ("gate" counts toward the exit code, "advisory" is
//                   printed but never fails the run), an origin and its params.
// A check whose stat is missing from stats(), or is zero for the whole sweep, prints NOT CHECKED.
// It never passes by default. Exit 1 if any gate check fails or any check lists no sources;
// exit 3 if every gate check that ran passed but some could not run (incomplete, not a pass).
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const di = args.indexOf('--data');
const dataArg = di >= 0 ? args[di + 1] : undefined;
const positional = args.filter((a, i) => !a.startsWith('--') && (di < 0 || i !== di + 1));
const [plant, rootArg] = positional;
if (!plant) { console.error('usage: plant-gate.mjs <plant> [rootDir] [--data <file>] [--json]'); process.exit(2); }
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(rootArg ?? resolve(here, '..'));
const dataPath = dataArg ? resolve(dataArg) : resolve(here, 'ground-truth', `${plant}.json`);
let gt;
try { gt = JSON.parse(readFileSync(dataPath, 'utf8')); } catch (e) { console.error(`cannot read the data file ${dataPath}: ${e.message}`); process.exit(2); }
const PA = gt.peakAge ?? 5, PD = gt.peakDay ?? 205; // the age and day height, ramp and structure are measured at
const Class = gt.class ?? plant[0].toUpperCase() + plant.slice(1);
const entry = gt.entry ?? `src/lib/plants/${plant}/${plant}.js`;
const mod = await import(pathToFileURL(`${root}/${entry}`).href);
const Plant = mod[Class];
if (!Plant) { console.error(`${entry} does not export ${Class}; set "class" in the data file`); process.exit(2); }

class NotChecked extends Error {}
const make = (seed, age, day) => new Plant({ seed, ageYears: age, dayOfYear: day });
const statVal = (p, name) => {
  const path = gt.stats?.[name];
  if (!path) throw new NotChecked(`no stat mapped for "${name}"`);
  let v = p.stats(); for (const k of path.split('.')) v = v?.[k];
  if (typeof v !== 'number') throw new NotChecked(`stats() has no number at ${path}`);
  return v;
};
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const f = (x, d = 2) => (typeof x === 'number' ? +x.toFixed(d) : x);
const FT = 0.3048, SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);
const week = (day) => Math.floor((day - 1) / 7) + 1;
const inRange = (v, [lo, hi]) => v >= lo && v <= hi;
const each = (seeds, age, day, fn) => seeds.map((s) => { const p = make(s, age, day); try { return fn(p); } finally { p.dispose(); } });

const cache = {};
const once = (k, fn) => (cache[k] ??= fn());
const modelWeekly = () => once('weekly', () => {
  const per = {};
  for (const seed of SEEDS.slice(0, 8)) {
    const p = make(seed, PA, PD);
    for (let day = 1; day <= 365; day++) { p.setTime({ ageYears: PA, dayOfYear: day }); (per[week(day)] ??= []).push(statVal(p, 'flowers')); }
    p.dispose();
  }
  const m = {}; for (const w in per) m[w] = mean(per[w]);
  if (!Object.values(m).some((v) => v > 0)) throw new NotChecked('flowers stat is zero all year');
  return m;
});
const obs = gt.bloomData?.weeklyFloweringObservations ?? {};
const pctWeek = (series, q, w0 = 1, w1 = 53) => {
  const ws = []; for (let w = w0; w <= w1; w++) ws.push(w);
  const tot = ws.reduce((s, w) => s + (series[w] ?? 0), 0); let c = 0;
  for (const w of ws) { c += series[w] ?? 0; if (c >= q * tot) return w; }
  return null;
};
const snapshotOf = (p) => {
  const sn = p._snapshot;
  if (!sn?.heads || !sn?.leaves || !sn?.axes) throw new NotChecked('_snapshot has no heads, leaves and axes');
  return sn;
};
const structure = () => once('structure', () => {
  const hf = [], lo = [], top = [];
  for (const s of SEEDS) {
    const p = make(s, PA, PD), sn = snapshotOf(p);
    const heads = sn.heads.filter((h) => h.visible !== false);
    const leaves = sn.leaves.filter((l) => l.visible !== false && !l.fallen);
    const tp = Math.max(...sn.axes.flatMap((a) => a.points.map((q) => q.y)), 0.01);
    const ly = leaves.map((l) => l.position.y / tp);
    hf.push(mean(heads.map((h) => h.position.y / tp))); lo.push(ly.filter((y) => y < 0.5).length / Math.max(1, ly.length)); top.push(1 - Math.max(...ly, 0));
    p.dispose();
  }
  return { hf: mean(hf), lo: mean(lo), top: mean(top) };
});

// Each type returns [value, ok, wantText, note?]
const TYPES = {
  cap({ stat, max }) {
    let m = 0, at = null;
    for (const seed of SEEDS) { const p = make(seed, PA, PD); for (const age of [0, 1, 2, 3, 5, 8, 12, 20]) for (let day = 10; day <= 360; day += 25) { p.setTime({ ageYears: age, dayOfYear: day }); const h = statVal(p, stat); if (h > m) { m = h; at = `seed ${seed} age ${age} day ${day}`; } } p.dispose(); }
    if (m === 0) throw new NotChecked(`${stat} is zero in every sampled state`);
    return [m, m <= max, `<= ${max}`, at];
  },
  ramp({ stat, ages, range }) {
    const meds = ages.map((a) => median(each(SEEDS, a, PD, (p) => statVal(p, stat))));
    const bad = meds.find((v) => !inRange(v, range));
    return [bad ?? meds[0], bad === undefined, range.join(' to ')];
  },
  growth({ stat, ages, minRatio = 1.05 }) {
    const meds = ages.map((a) => median(each(SEEDS, a, PD, (p) => statVal(p, stat))));
    const ok = meds.every((v, i) => i === 0 || v >= meds[i - 1] * minRatio);
    return [meds.map((v) => f(v, 1)).join(' > '), ok, `each age >= ${minRatio}x the one before (ages ${ages.join(', ')})`];
  },
  absent({ age, stats }) {
    const p = make(1, age, 100); const mx = Object.fromEntries(stats.map((s) => [s, 0]));
    for (let d = 5; d <= 365; d += 5) { p.setTime({ ageYears: age, dayOfYear: d }); for (const s of stats) mx[s] = Math.max(mx[s], statVal(p, s)); }
    p.dispose();
    return [stats.map((s) => `${mx[s]} ${s}`).join(', '), stats.every((s) => mx[s] <= 0), `none at age ${age}`];
  },
  bloomPercentile({ q, tolerance, weeks: [w0, w1] }) {
    if (!Object.keys(obs).length) throw new NotChecked('no observation data in the data file');
    const real = pctWeek(obs, q, w0, w1), got = pctWeek(modelWeekly(), q, w0, w1);
    return [got, got !== null && Math.abs(got - real) <= tolerance, `${real} +/- ${tolerance}`];
  },
  bloomEnd({ fraction, range }) {
    const m = modelWeekly(), peak = Math.max(...Object.values(m));
    const last = Math.max(...Object.keys(m).filter((w) => m[w] >= fraction * peak).map(Number));
    return [last, inRange(last, range), `${range.join(' to ')}`, `last week with open heads >= ${fraction * 100}% of peak`];
  },
  bloomCorrelation({ weeks: [w0, w1], minR }) {
    if (!Object.keys(obs).length) throw new NotChecked('no observation data in the data file');
    const m = modelWeekly(), ws = []; for (let w = w0; w <= w1; w++) ws.push(w);
    const a = ws.map((w) => m[w] ?? 0), b = ws.map((w) => obs[w] ?? 0), ma = mean(a), mb = mean(b);
    const r = a.reduce((s, x, i) => s + (x - ma) * (b[i] - mb), 0) / Math.sqrt(a.reduce((s, x) => s + (x - ma) ** 2, 0) * b.reduce((s, x) => s + (x - mb) ** 2, 0) || 1);
    return [f(r), r >= minR, `>= ${minR}`, 'timing of observations, not amount in bloom'];
  },
  heightMean({ range }) { const h = each(SEEDS, PA, PD, (p) => statVal(p, 'height') / FT); return [f(mean(h)), inRange(mean(h), range), `${range.join(' to ')} ft`]; },
  spreadRange({ range }) { const w = each(SEEDS, PA, PD, (p) => statVal(p, 'spread') / FT); return [f(mean(w)), inRange(mean(w), range), `${range.join(' to ')} ft`]; },
  heightMax({ max }) { const h = each(SEEDS, PA, PD, (p) => statVal(p, 'height') / FT); return [f(Math.max(...h)), Math.max(...h) <= max, `<= ${max} ft`]; },
  headFraction({ range }) { const v = structure().hf; return [f(v), inRange(v, range), range.join(' to ')]; },
  leavesLow({ range }) { const v = structure().lo; return [f(v), inRange(v, range), range.join(' to ')]; },
  leafFreeTop({ max, min }) { const v = structure().top; return [f(v), (max === undefined || v <= max) && (min === undefined || v >= min), [max !== undefined && `<= ${max}`, min !== undefined && `>= ${min}`].filter(Boolean).join(' and ')]; },
  leafElevation({ minDeg, age = 0, day = 160 }) {
    const e = [];
    for (const s of SEEDS.slice(0, 6)) { const p = make(s, age, day); for (const l of snapshotOf(p).leaves) { const d = l.direction ?? l.dir ?? l.normal; if (d && Number.isFinite(d.y)) e.push(Math.abs(Math.asin(Math.max(-1, Math.min(1, d.y / Math.hypot(d.x, d.y, d.z)))) * 180 / Math.PI)); } p.dispose(); }
    if (!e.length) throw new NotChecked('no leaf direction in _snapshot');
    return [f(median(e), 0), median(e) >= minDeg, `>= ${minDeg} deg`];
  },
  // ---- checks for grasses and other plants whose season is a sequence of events (added 27 Nov 2026) ----
  // Each sweeps the year in 5-day steps over six seeds and reports the median day. They read only stats()
  // (and, for the ratio, _snapshot), so any plant that reports the mapped stat can use them.
  culmEmergence({ stat = 'stems', age = PA, range }) {
    // New culms appear after the plant has been cut back: the first day on or after day 100 on which the stat
    // rises above its low point of days 60 to 200. A stat that never changes in that window cannot be read.
    const days = each(SEEDS.slice(0, 6), age, PD, (p) => {
      const at = []; for (let d = 60; d <= 365; d += 5) { p.setTime({ ageYears: age, dayOfYear: d }); at.push([d, statVal(p, stat)]); }
      const low = Math.min(...at.filter(([d]) => d <= 200).map(([, v]) => v));
      const hit = at.find(([d, v]) => d >= 100 && v > low);
      return hit ? hit[0] : null;
    });
    if (days.every((d) => d === null)) throw new NotChecked(`${stat} never rises after its low point in days 60 to 200`);
    const m = median(days.filter((d) => d !== null));
    return [m, inRange(m, range), `day ${range.join(' to ')}`];
  },
  seedFluff({ stat = 'seedHeads', startRange, endRange, fraction = 0.1, age = PA }) {
    const out = each(SEEDS.slice(0, 6), age, PD, (p) => {
      const at = []; for (let d = 150; d <= 365; d += 5) { p.setTime({ ageYears: age, dayOfYear: d }); at.push([d, statVal(p, stat)]); }
      const mx = Math.max(...at.map(([, v]) => v));
      if (mx <= 0) return null;
      return [at.find(([, v]) => v > 0)[0], [...at].reverse().find(([, v]) => v >= fraction * mx)[0]];
    });
    if (out.every((o) => o === null)) throw new NotChecked(`${stat} is zero from day 150 to 365`);
    const ok = out.filter(Boolean), st = median(ok.map((o) => o[0])), en = median(ok.map((o) => o[1]));
    return [`day ${st} to ${en}`, inRange(st, startRange) && inRange(en, endRange), `start ${startRange.join(' to ')}, end ${endRange.join(' to ')}`, `end = last day with the stat >= ${fraction * 100}% of its peak`];
  },
  cutback({ stat = 'height', heightIn, cutDayRange, regrowthStartRange, age = PA }) {
    const r = each(SEEDS.slice(0, 6), age, PD, (p) => {
      const at = []; for (let d = 1; d <= 200; d += 5) { p.setTime({ ageYears: age, dayOfYear: d }); at.push([d, statVal(p, stat)]); }
      const stub = Math.min(...at.filter(([d]) => d >= 30 && d <= 150).map(([, v]) => v));
      const cut = at.find(([d, v]) => d >= 30 && v <= stub + 0.02);
      const grow = cut && at.find(([d, v]) => d > cut[0] && v > stub + 0.05);
      return { stub: stub / 0.0254, cut: cut?.[0], grow: grow?.[0] };
    });
    const cut = median(r.map((x) => x.cut).filter((x) => x != null)), grow = median(r.map((x) => x.grow).filter((x) => x != null)), stub = median(r.map((x) => x.stub));
    if (![cut, grow].every(Number.isFinite)) throw new NotChecked('no cutback and regrowth found in days 30 to 200');
    const ok = inRange(stub, heightIn) && inRange(cut, cutDayRange) && inRange(grow, regrowthStartRange);
    return [`${f(stub, 1)} in, cut day ${cut}, regrowth day ${grow}`, ok, `${heightIn.join(' to ')} in, cut ${cutDayRange.join(' to ')}, regrowth ${regrowthStartRange.join(' to ')}`];
  },
  culmMoundRatio({ range, age = PA, day = PD }) {
    const r = each(SEEDS.slice(0, 6), age, day, (p) => {
      const sn = p._snapshot;
      if (!sn?.leaves || !sn?.axes) throw new NotChecked('_snapshot has no leaves and axes');
      const culm = Math.max(...sn.axes.flatMap((a) => a.points.map((q) => q.y)), 0.01);
      const tips = sn.leaves.filter((l) => l.visible !== false && !l.fallen).map((l) => l.position.y + (l.direction?.y ?? 0) * (l.lengthM ?? 0)).sort((x, y) => x - y);
      if (!tips.length) throw new NotChecked('no visible leaves');
      return culm / tips[Math.floor(0.95 * (tips.length - 1))];
    });
    const m = mean(r);
    return [f(m), inRange(m, range), range.join(' to '), 'culm tip height over the 95th percentile leaf tip'];
  },
  winterStanding({ stat, day, min }) { const v = mean(each(SEEDS, PA, day, (p) => statVal(p, stat))); return [f(v, 1), v >= min, `>= ${min}`]; }
};

const srcIds = new Set((gt.sources ?? []).map((s) => s.id)); srcIds.add('owner');
const reputable = new Set((gt.sources ?? []).filter((s) => s.reputable ?? s.stable).map((s) => s.id));
const rows = [];
for (const c of gt.checks) {
  const row = { id: c.id, name: c.label, tier: c.tier ?? 'gate', origin: c.origin, sources: c.sources ?? [] };
  const bad = row.sources.filter((id) => !srcIds.has(id));
  const reputableN = row.sources.filter((id) => reputable.has(id)).length;
  row.reputable = reputableN;
  try {
    if (!row.sources.length) throw Object.assign(new Error('lists no sources (rule 4C)'), { sourceFail: true });
    if (bad.length) throw Object.assign(new Error(`unknown source ids: ${bad.join(', ')}`), { sourceFail: true });
    const fn = TYPES[c.type];
    if (!fn) throw new Error(`unknown check type "${c.type}"`);
    const [value, ok, want, note] = fn(c.params ?? {});
    Object.assign(row, { value, ok, want, note });
  } catch (e) {
    if (e instanceof NotChecked) Object.assign(row, { ok: null, value: e.message });
    else Object.assign(row, { ok: false, value: e.message, sourceFail: !!e.sourceFail });
  }
  rows.push(row);
}
const gateFail = rows.filter((r) => r.ok === false && (r.tier === 'gate' || r.sourceFail));
const exitCode = gateFail.length ? 1 : rows.some((r) => r.tier === 'gate' && r.ok === null) ? 3 : 0;
if (asJson) { console.log(JSON.stringify(rows)); process.exit(exitCode); }

const w = Math.max(...rows.map((r) => r.name.length));
console.log(`GATE ${plant}  ${root}`);
const sect = (tier, title) => {
  console.log(`\n${title}`);
  for (const r of rows.filter((x) => x.tier === tier)) {
    const tag = r.ok === null ? 'NOT CHECKED' : r.ok ? 'PASS       ' : 'FAIL       ';
    console.log(`${tag} ${r.name.padEnd(w)}  ${String(r.value).padEnd(18)} ${r.want ? `want ${r.want}` : ''}${r.note ? `  (${r.note})` : ''}${r.reputable === 0 && !r.sources.every((s) => s === 'owner') ? '  [no reputable source]' : ''}`);
  }
};
sect('gate', 'GATE CHECKS (count toward the result)');
sect('advisory', 'ADVISORY CHECKS (reported, never fail the run)');
const g = rows.filter((r) => r.tier === 'gate');
console.log(`\nGate: ${g.filter((r) => r.ok).length} passed, ${g.filter((r) => r.ok === false).length} failed, ${g.filter((r) => r.ok === null).length} not checked.`);
const adv = rows.filter((r) => r.tier === 'advisory');
console.log(`Advisory: ${adv.filter((r) => r.ok).length} passed, ${adv.filter((r) => r.ok === false).length} failed, ${adv.filter((r) => r.ok === null).length} not checked.`);
const nourl = (gt.sources ?? []).filter((s) => !s.url);
if (nourl.length) console.log(`Sources with no URL recorded: ${nourl.map((s) => s.id).join(', ')}`);
if (g.some((r) => r.ok === null)) console.log('INCOMPLETE: some gate checks could not run, so this is not a pass (exit 3).');
console.log('\nJudged by eye, not by this gate:\n - ' + (gt.visual ?? []).join('\n - '));
process.exit(exitCode);
