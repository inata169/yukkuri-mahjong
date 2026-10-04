import test from "node:test";
import assert from "node:assert/strict";
import { Session, M } from "../src/game/engine.js";
import { danger, threats, chooseImprovedCall, improvedCandidates } from "../src/game/strategy.js";
import { compareCpus, comparisonOptions, playComparisonMatch, summarizeComparison } from "../src/game/comparison.js";

function publicPlayer(hand = "m134679p248s37z123") {
  const p = new Session({ cpu: "legacy" }, "normal", { seed: 123 }).me;
  p._model.shoupai = [M.Shoupai.fromString(hand), ...Array.from({ length: 3 }, () => M.Shoupai.fromString(""))];
  p._model.he = Array.from({ length: 4 }, () => new M.He());
  p._model.shan.baopai = [];
  p._model.lunban = 3;
  return p;
}

test("improved defense distinguishes genbutsu, suji, walls and multiple threats", () => {
  const p = publicPlayer();
  p._model.shoupai[1]._lizhi = 1;
  p._model.he[1].dapai("m4");
  assert.equal(danger(p, "m4", {}), 0);
  assert.ok(danger(p, "m1", {}) > 0, "suji is never a safety guarantee");
  assert.ok(danger(p, "m1", {}) < danger(p, "p1", {}));
  assert.ok(danger(p, "p1", { p2: 4 }) < danger(p, "p1", {}));
  assert.ok(danger(p, "z1", { z1: 3 }) < danger(p, "z1", {}));
  p._model.shoupai[2]._lizhi = 1;
  assert.ok(danger(p, "m4", {}) > 0, "safe against one opponent need not be safe against another");
  p._model.he[2].dapai("m4");
  assert.equal(danger(p, "m4", {}), 0);
});

test("three exposed melds are a warning and improved defense changes an unsafe choice", () => {
  const p = publicPlayer();
  p._model.shoupai[1]._fulou = ["p123-", "s456-", "z555-"];
  assert.equal(threats(p).length, 1);
  assert.ok(danger(p, "m1") > 0);
  p._model.shoupai[1]._fulou = [];
  p._model.shoupai[1]._lizhi = 1;
  p._model.he[1].dapai("m5");
  p.cpu = "legacy";
  assert.equal(p.chooseDiscard().dapai, "z1");
  p.cpu = "improved";
  assert.equal(p.chooseDiscard().dapai, "m1");
  assert.ok(danger(p, "m1") < danger(p, "z1"));
});

test("call comparison finds a useful yaku call and declines a call that loses the pair", () => {
  const p = publicPlayer("m23467p2256s34z55");
  p._model.he[3].dapai("z5");
  const before = JSON.stringify(p.model);
  assert.equal(chooseImprovedCall(p, "z5-", 5), "z555-");
  assert.equal(JSON.stringify(p.model), before, "candidate evaluation cannot mutate the public board");
  p._model.shoupai[0] = M.Shoupai.fromString("m23467p234s456z55");
  assert.equal(chooseImprovedCall(p, "z5-", 5), null);
  assert.equal(chooseImprovedCall(p, "z5-", 2), null);
});

test("call comparison considers all legal chii choices and preserves kuikae restrictions", () => {
  const p = publicPlayer("m23467p23455s346");
  p._model.he[3].dapai("m5");
  assert.equal(p.get_chi_mianzi(p.shoupai, "m5-").length, 3);
  const call = chooseImprovedCall(p, "m5-", 3);
  assert.equal(call, "m5-67", "choose the best continuation, not the first legal chii");
  const hand = p.shoupai.clone().fulou(call);
  assert.ok(!p.get_dapai(hand).some((tile) => tile.startsWith("m5")));
  p._model.shoupai[1]._lizhi = 1;
  assert.equal(chooseImprovedCall(p, "m5-", 5), null, "decline a call requiring a dangerous discard");
});

test("CPU choice survives save, undo and replay; old saves retain legacy decisions", () => {
  const s = new Session({ cpu: "legacy", level: 5 }, "normal", { seed: 20261004 });
  s.step();
  s.updateSettings({ cpu: "improved" });
  assert.ok(s.undo());
  assert.ok(s.game._players.every((p) => p.cpu === "improved"));
  const loaded = Session.load(s.save());
  assert.equal(loaded.save(), s.save());
  loaded.replay();
  assert.ok(loaded.game._players.every((p) => p.cpu === "improved"));
  const old = JSON.parse(new Session({ cpu: "legacy" }).save());
  delete old.settings.cpu;
  for (const key of ["game", "initial"]) for (const p of old[key]._players) delete p.cpu;
  const migrated = Session.load(JSON.stringify(old));
  assert.equal(migrated.settings.cpu, "legacy");
  assert.ok(migrated.game._players.every((p) => (p.cpu || "legacy") === "legacy"));
  old.settings.cpu = "unknown";
  assert.throws(() => Session.load(JSON.stringify(old)), /設定/);
});

test("switching CPU reconsiders a queued decision without changing boards or a pending win", () => {
  const s = new Session({ cpu: "legacy" }, "normal", { seed: 1 });
  const p = s.me, fixture = publicPlayer();
  p._model = fixture._model;
  p._model.shoupai[1]._lizhi = 1;
  p._model.he[1].dapai("m5");
  s.game._reply[0] = p.chooseDiscard();
  const board = JSON.stringify(p.model);
  assert.equal(s.game._reply[0].dapai, "z1");
  s.updateSettings({ cpu: "improved" });
  assert.equal(s.game._reply[0].dapai, "m1");
  assert.equal(JSON.stringify(p.model), board);
  s.game._reply[1] = { hule: "-" };
  s.updateSettings({ cpu: "legacy" });
  assert.deepEqual(s.game._reply[1], { hule: "-" });
});

test("improved decisions cannot observe authoritative opponent hands or the wall", () => {
  const s = new Session({ cpu: "improved" }, "normal", { seed: 4 });
  const before = improvedCandidates(s.me);
  s.game.model.shan._pai.reverse();
  s.game.model.shoupai[1] = M.Shoupai.fromString("m111222333444z1");
  s.updateSettings({ reveal: true, wall: true });
  assert.deepEqual(improvedCandidates(s.me), before);
});

test("comparison uses deterministic walls, equal levels, swapped seats and conserved scores", () => {
  const first = [...compareCpus({ sets: 1, seed: 20261004, level: 5 })].at(-1);
  assert.equal(first.completed, 2);
  assert.deepEqual(first.matches[0].cpuById, first.matches[1].cpuById.map((cpu) => cpu === "legacy" ? "improved" : "legacy"));
  const repeated = playComparisonMatch({ seed: 20261004, level: 5 });
  const deterministic = ({ elapsedMs, ...data }) => data;
  assert.deepEqual(deterministic(repeated), deterministic(first.matches[0]));
  for (const match of first.matches) {
    assert.equal(match.scores.reduce((a, b) => a + b), 100000);
    assert.deepEqual(match.rank.toSorted(), [1, 2, 3, 4]);
    assert.ok(match.hands > 0);
    assert.ok(match.dealIns.every((n) => n <= match.hands));
  }
  assert.equal(first.summary.legacy.games, first.summary.improved.games);
  assert.equal(first.summary.legacy.netPoints + first.summary.improved.netPoints, 0);
});

test("common level-one decisions give both CPUs identical results after seat swapping", () => {
  const result = [...compareCpus({ sets: 1, seed: 37, level: 1 })].at(-1);
  assert.deepEqual(result.matches[0].scores, result.matches[1].scores);
  assert.deepEqual(result.summary.legacy, result.summary.improved);
  assert.deepEqual(summarizeComparison([]).legacy.averageRank, null);
  for (const input of [{ sets: 0 }, { sets: 1.5 }, { seed: -1 }, { seed: NaN }, { level: 6 }])
    assert.throws(() => comparisonOptions(input));
});
