import { Session } from "./engine.js";

export function comparisonOptions({ sets = 5, seed = 20261004, level = 5 } = {}) {
  if (!Number.isInteger(sets) || sets < 1 || sets > 1000 ||
      !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff ||
      !Number.isInteger(level) || level < 1 || level > 5)
    throw new Error("セット数は1〜1000、山の番号は0〜4294967295、レベルは1〜5で指定してください。");
  return { sets, seed, level };
}

export function playComparisonMatch({ seed, level, swapped = false }) {
  const cpuById = [0, 1, 2, 3].map((id) => (id % 2 === 0) !== swapped ? "improved" : "legacy");
  const session = new Session({ level, length: 1 }, "normal", { seed, cpuById });
  const game = session.game;
  const wins = [0, 0, 0, 0], dealIns = [0, 0, 0, 0];
  let steps = 0, lastHand = 0;
  let losers = new Set();
  const started = performance.now();
  while (!session.finished) {
    if (++steps > 20000 || game._handNumber > 200) throw new Error("自動対戦が進まなくなったため停止しました。");
    if (lastHand !== game._handNumber) {
      lastHand = game._handNumber;
      losers = new Set();
    }
    session.step(undefined, { record: false });
    if (game._status === "hule") {
      const event = game._event.hule;
      wins[game.model.player_id[event.l]]++;
      if (event.baojia != null) {
        const id = game.model.player_id[event.baojia];
        // A double ron is one dealt-in hand for its discarder.
        if (!losers.has(id)) dealIns[id]++;
        losers.add(id);
      }
    }
  }
  return {
    seed, swapped, level, cpuById, hands: game._handNumber, steps,
    rank: game._paipu.rank.slice(), scores: game.model.defen.slice(), wins, dealIns,
    elapsedMs: performance.now() - started,
  };
}

export function summarizeComparison(matches) {
  const summary = Object.fromEntries(["legacy", "improved"].map((cpu) => [cpu,
    { games: 0, hands: 0, rank: 0, netPoints: 0, wins: 0, dealIns: 0 }]));
  for (const match of matches) {
    for (let id = 0; id < 4; id++) {
      const row = summary[match.cpuById[id]];
      row.games++;
      row.hands += match.hands;
      row.rank += match.rank[id];
      row.netPoints += match.scores[id] - 25000;
      row.wins += match.wins[id];
      row.dealIns += match.dealIns[id];
    }
  }
  return Object.fromEntries(Object.entries(summary).map(([cpu, row]) => [cpu, {
    ...row,
    averageRank: row.games ? row.rank / row.games : null,
    averageNetPoints: row.games ? row.netPoints / row.games : null,
    winRate: row.hands ? row.wins / row.hands : null,
    dealInRate: row.hands ? row.dealIns / row.hands : null,
  }]));
}

export function* compareCpus(input) {
  const config = comparisonOptions(input), matches = [];
  for (let set = 0; set < config.sets; set++) {
    const seed = (config.seed + set) >>> 0;
    for (const swapped of [false, true]) {
      matches.push(playComparisonMatch({ seed, level: config.level, swapped }));
      yield { formatVersion: 1, algorithmVersion: "defense-calls-v1", config, completed: matches.length, total: config.sets * 2,
        summary: summarizeComparison(matches), matches: matches.slice() };
    }
  }
}
