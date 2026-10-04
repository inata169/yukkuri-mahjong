import test from "node:test";
import assert from "node:assert/strict";
import { Session, M } from "../src/game/engine.js";
import { candidates, visibleCounts } from "../src/game/advice.js";
import { handTiles, parseTiles, normalize } from "../src/game/tiles.js";

function physicalTiles(s) {
  const m = s.game.model;
  return [
    ...m.shan._pai,
    ...m.shoupai.flatMap((h) => [
      ...handTiles(h),
      ...h._fulou.flatMap(parseTiles),
    ]),
    ...m.he.flatMap((h) =>
      h._pai.filter((p) => !/[+=-]$/.test(p)).map((p) => p.slice(0, 2)),
    ),
  ];
}
test("meld parser retains every tile on either side of the called-tile marker", () => {
  assert.deepEqual(parseTiles("m12-3"), ["m1", "m2", "m3"]);
  assert.deepEqual(parseTiles("p555+0"), ["p5", "p5", "p5", "p0"]);
});
test("all presets preserve 136 tiles, four of each kind, and legal hand sizes", () => {
  for (const preset of ["normal", "riichi", "tanyao", "yakuhai"]) {
    const s = new Session({}, preset),
      tiles = physicalTiles(s);
    assert.equal(tiles.length, 136);
    const counts = tiles.reduce(
      (a, p) => ((a[normalize(p)] = (a[normalize(p)] || 0) + 1), a),
      {},
    );
    assert.equal(Object.keys(counts).length, 34);
    assert.ok(Object.values(counts).every((n) => n === 4));
    assert.equal(handTiles(s.me.shoupai).length, 14);
    assert.ok(s.actions().some((a) => a.kind === "discard"));
  }
});
test("all five CPU levels can finish a complete east match without illegal progression", () => {
  for (let level = 1; level <= 5; level++) {
    const s = new Session({ level, length: 1 });
    let steps = 0;
    while (!s.finished && steps++ < 4000) {
      assert.equal(physicalTiles(s).length, 136);
      s.step();
      assert.equal(
        s.game.model.defen.reduce((a, b) => a + b, 0) +
          s.game.model.lizhibang * 1000,
        100000,
      );
    }
    assert.ok(s.finished, `level ${level} finishes`);
  }
});
test("save/reload preserves exact next event, hidden model and public player prototypes", () => {
  const a = new Session({ level: 4 });
  for (let i = 0; i < 20; i++) a.step();
  const b = Session.load(a.save());
  assert.equal(b.save(), a.save());
  assert.deepEqual(b.actions(), a.actions());
  assert.deepEqual(candidates(b.me), candidates(a.me));
  a.step();
  b.step();
  assert.equal(b.save(), a.save());
});
test("undo restores pending decisions; replay restores the same complete wall and hands", () => {
  const s = new Session(),
    initial = s.snapshot();
  s.step(s.actions().find((a) => a.kind === "discard"));
  assert.ok(s.undo());
  assert.deepEqual(s.snapshot(), initial);
  s.step();
  s.step();
  s.replay();
  assert.deepEqual(s.snapshot(), initial);
});
test("revealing opponents and wall cannot affect the hint or AI prompt", () => {
  const s = new Session(),
    before = candidates(s.me),
    prompt = s.prompt();
  s.updateSettings({ reveal: true, wall: true });
  assert.deepEqual(candidates(s.me), before);
  assert.equal(s.prompt(), prompt);
  // Change authoritative hidden state only. Neither public-board consumer may observe it.
  s.game.model.shan._pai.reverse();
  s.game.model.shoupai[1] = M.Shoupai.fromString("m111222333444z1");
  assert.deepEqual(candidates(s.me), before);
  assert.equal(s.prompt(), prompt);
  assert.ok(s.me.model.shoupai[1].toString().includes("_"));
});
test("called tiles are counted exactly once in public visible counts", () => {
  const s = new Session();
  s.me.model.he[1]._pai = ["z5+"];
  s.me.model.shoupai[2]._fulou = ["z555-"];
  const own = handTiles(s.me.shoupai).filter((p) => p === "z5").length,
    indicator = s.me.shan.baopai.filter((p) => p === "z5").length;
  assert.equal(visibleCounts(s.me).z5, own + indicator + 3);
});
test("engine rejects no-yaku ron and own-river furiten but permits a valid riichi ron", () => {
  const rule = M.rule(),
    hand = M.Shoupai.fromString("m123456p789s12z11");
  assert.equal(M.Game.allow_hule(rule, hand, "s3+", 0, 1, false, true), false);
  assert.equal(M.Game.allow_hule(rule, hand, "s3+", 0, 1, true, true), true);
  assert.equal(M.Game.allow_hule(rule, hand, "s3+", 0, 1, true, false), false);
});
test("invalid manual actions are rejected instead of silently discarding a different tile", () => {
  const s = new Session();
  assert.throws(() =>
    s.step({ kind: "discard", reply: { dapai: "not-a-tile" } }),
  );
});

test("undo and replay retain the currently selected CPU level", () => {
  const s = new Session({ level: 2 });
  s.step();
  s.updateSettings({ level: 5 });
  assert.ok(s.undo());
  assert.equal(s.settings.level, 5);
  assert.deepEqual(s.game._players.slice(1).map((p) => p.level), [5, 5, 5]);
  s.replay();
  assert.deepEqual(s.game._players.slice(1).map((p) => p.level), [5, 5, 5]);
});

test("loading rejects corrupted scores, replay state, settings and reviews", () => {
  const saved = new Session().save();
  const corruptions = [
    (s) => { s.game._model.defen = null; },
    (s) => { s.game._players[0]._model.shoupai = []; },
    (s) => { s.initial = {}; },
    (s) => { s.settings.speed = -1; },
    (s) => { s.settings.level = 99; },
    (s) => { s.reviews = {}; },
    (s) => { s.game._status = "unknown"; },
    (s) => { s.game._model.player_id = [0, 0, 0, 0]; },
  ];
  for (const corrupt of corruptions) {
    const value = JSON.parse(saved);
    corrupt(value);
    assert.throws(() => Session.load(JSON.stringify(value)), /保存/);
  }
  assert.equal(Session.load(saved).save(), saved);
});

test("a saved half match retains rules and can resume and replay", () => {
  const s = new Session({ length: 2, level: 4, speed: 250 });
  s.step(s.actions().find((a) => a.kind === "discard"));
  const loaded = Session.load(s.save());
  assert.equal(loaded.settings.length, 2);
  assert.equal(loaded.game._rule["場数"], 2);
  assert.equal(loaded.reviews.length, 1);
  loaded.step();
  loaded.replay();
  assert.equal(loaded.actions().filter((a) => a.kind === "discard").length > 0, true);
});

// A fixed wall makes the level 1 / level 5 decision regression reproducible.
function pendingCpuSession() {
  const s = new Session({ level: 1 });
  const wall = new M.Shan(s.game._rule);
  wall._pai.sort();
  let seed = 12345;
  for (let i = wall._pai.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [wall._pai[i], wall._pai[j]] = [wall._pai[j], wall._pai[i]];
  }
  wall._baopai = [wall._pai[4]];
  wall._fubaopai = [wall._pai[9]];
  s.game.qipai(wall);
  s.initial = s.snapshot();
  s.step();
  s.step();
  s.step();
  assert.equal(s.game._status, "zimo");
  assert.equal(s.game.model.player_id[s.game.model.lunban], 1);
  assert.deepEqual(s.game._reply[1], { dapai: "m2" });
  return s;
}

test("level changes update the pending CPU move, including undo and older saves", () => {
  const s = pendingCpuSession();
  const oldSave = JSON.parse(s.save());
  const before = s.snapshot();
  s.updateSettings({ level: 5 });
  assert.deepEqual(s.game._reply[1], { dapai: "p9" });
  assert.deepEqual(s.snapshot()._model, before._model);
  assert.deepEqual(s.game._reply[0], before._reply[0]);

  const undone = pendingCpuSession();
  undone.step();
  undone.updateSettings({ level: 5 });
  assert.ok(undone.undo());
  assert.deepEqual(undone.game._reply[1], { dapai: "p9" });
  assert.deepEqual(undone.snapshot()._model, before._model);
  undone.step();
  assert.equal(undone.game.model.he[1]._pai.at(-1), "p9");

  oldSave.settings.level = 5;
  const loaded = Session.load(JSON.stringify(oldSave));
  assert.deepEqual(loaded.game._reply[1], { dapai: "p9" });
  loaded.step();
  assert.equal(loaded.game.model.he[1]._pai.at(-1), "p9");
});

test("level changes preserve boards, manual replies and pending wins through a match", () => {
  const s = pendingCpuSession();
  let steps = 0, wins = 0;
  while (!s.finished && steps++ < 4000) {
    const before = s.snapshot();
    s.updateSettings({ level: s.settings.level === 1 ? 5 : 1 });
    const after = s.snapshot();
    assert.deepEqual(after._model, before._model);
    assert.deepEqual(after._reply[0], before._reply[0]);
    for (let id = 1; id < 4; id++) {
      assert.deepEqual(after._players[id]._model, before._players[id]._model);
      assert.equal(after._players[id]._neng_rong, before._players[id]._neng_rong);
      if (before._reply[id].hule) {
        wins++;
        assert.deepEqual(after._reply[id], before._reply[id]);
      }
    }
    s.step();
    assert.equal(physicalTiles(s).length, 136);
  }
  assert.ok(s.finished);
  assert.ok(wins > 0, "the test exercised a pending CPU win");
});

test("loading rejects unbounded concealed-tile counts in all saved boards", () => {
  const saved = new Session().save();
  for (const key of ["game", "initial"]) {
    for (let board = -1; board < 4; board++) {
      for (const count of [-1, 1.5, 15, 1000000, null, undefined]) {
        const data = JSON.parse(saved);
        const model = board === -1 ? data[key]._model : data[key]._players[board]._model;
        model.shoupai[1]._bingpai._ = count;
        assert.throws(() => Session.load(JSON.stringify(data)), /保存/);
      }
    }
  }
  assert.equal(Session.load(saved).save(), saved);
});


test("loading rejects more than four melds in every live and replay board", () => {
  const saved = new Session().save();
  for (const key of ["game", "initial"]) {
    for (let board = -1; board < 4; board++) {
      const data = JSON.parse(saved);
      const model = board === -1 ? data[key]._model : data[key]._players[board]._model;
      model.shoupai[1]._fulou = Array(5).fill("m111+");
      assert.throws(() => Session.load(JSON.stringify(data)), /保存/);
    }
  }
});

test("loading bounds collections rendered by the table and review dialog", () => {
  const saved = new Session().save();
  const corruptions = [
    (s) => { s.game._model.he[1]._pai = Array(137).fill("m1"); },
    (s) => { s.initial._players[2]._model.he[1]._pai = Array(137).fill("m1"); },
    (s) => { s.game._model.shan._baopai = Array(6).fill("m1"); },
    (s) => { s.initial._players[2]._model.shan.baopai = Array(6).fill("m1"); },
    (s) => { s.reviews = Array(61).fill({ pick: "m1", best: "m1", shanten: 1 }); },
  ];
  for (const corrupt of corruptions) {
    const data = JSON.parse(saved);
    corrupt(data);
    assert.throws(() => Session.load(JSON.stringify(data)), /保存/);
  }
  assert.equal(Session.load(saved).save(), saved);
});

test("loading bounds the separate winning hand and yaku display", () => {
  const data = JSON.parse(new Session().save());
  data.game._status = "hule";
  data.game._event = { hule: {
    l: 0, shoupai: "z11,m123-,p123-,s123-,z555+", defen: 1000,
    fenpei: [1000, -1000, 0, 0], hupai: [{ name: "役牌 白", fanshu: 1 }],
  } };
  const saved = JSON.stringify(data);
  assert.equal(Session.load(saved).game._event.hule.shoupai, data.game._event.hule.shoupai);
  data.game._event.hule.shoupai += ",m111+";
  assert.throws(() => Session.load(JSON.stringify(data)), /保存/);
  const oversized = JSON.parse(saved);
  oversized.game._event.hule.hupai = Array(65).fill({ name: "役牌 白", fanshu: 1 });
  assert.throws(() => Session.load(JSON.stringify(oversized)), /保存/);
});
