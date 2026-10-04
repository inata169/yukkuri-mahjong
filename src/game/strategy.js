import M from "@kobalab/majiang-core";
import { candidates, visibleCounts, yakuPaths } from "./advice.js";
import { handTiles, parseTiles, normalize } from "./tiles.js";

export const CPU_TYPES = { legacy: "旧CPU", improved: "改善版CPU" };

// These are relative warning scores, not calibrated deal-in probabilities.
// Only the player's public board is consulted, even in reveal/wall mode.
export function threats(player) {
  return player.model.shoupai.flatMap((hand, seat) => {
    if (seat === player._menfeng) return [];
    const weight = hand.lizhi ? 1 : hand._fulou.length >= 3 ? 0.4 : 0;
    return weight ? [{ seat, weight: weight * (seat === 0 ? 1.5 : 1) }] : [];
  });
}

export function danger(player, tile, seen = visibleCounts(player)) {
  const p = normalize(tile), suit = p[0], n = Number(p[1]);
  return threats(player).reduce((sum, threat) => {
    const river = player.model.he[threat.seat];
    if (river.find(p)) return sum;
    let risk;
    if (suit === "z") risk = seen[p] >= 3 ? 0.15 : seen[p] === 2 ? 0.45 : 0.9;
    else {
      risk = n === 1 || n === 9 ? 0.65 : n === 2 || n === 8 ? 0.85 : 1;
      const suji = [n - 3, n + 3].filter((r) => r >= 1 && r <= 9);
      if (suji.every((r) => river.find(suit + r))) risk *= 0.65;
      const sequences = [n - 2, n - 1, n].filter((r) => r >= 1 && r <= 7);
      const blocked = sequences.filter((r) => [r, r + 1, r + 2]
        .some((v) => v !== n && (seen[suit + v] || 0) >= 4)).length;
      if (blocked) risk *= blocked === sequences.length ? 0.45 : 0.8;
    }
    if (player.shan.baopai.some((d) => M.Shan.zhenbaopai(d) === p)) risk *= 1.15;
    return sum + risk * threat.weight;
  }, 0);
}

function valueUnits(player, hand) {
  const tiles = [...handTiles(hand), ...hand._fulou.flatMap(parseTiles)];
  const dora = player.shan.baopai.map(M.Shan.zhenbaopai);
  return (hand.menqian ? 1 : 0) + tiles.reduce((sum, p) =>
    sum + (p[1] === "0" ? 1 : 0) + dora.filter((d) => d === normalize(p)).length, 0)
    + yakuPaths(hand, player._menfeng, player.model.zhuangfeng)
      .filter((x) => x.name.startsWith("役牌") && x.value >= 5).length;
}

export function improvedCandidates(player, level = 5) {
  if (level < 4) return candidates(player, level);
  const seen = visibleCounts(player);
  return candidates(player, 4).map((candidate) => {
    const hand = player.shoupai.clone().dapai(candidate.p);
    const priority = candidate.shanten === 0 ? 75 : candidate.shanten === 1 ? 140 : 230;
    const risk = danger(player, candidate.p, seen);
    const penalty = risk * priority * (level === 4 ? 0.65 : 1)
      * (valueUnits(player, hand) >= 3 ? 0.75 : 1);
    return { ...candidate, risk, score: candidate.score - penalty };
  }).sort((a, b) => b.score - a.score || a.p.localeCompare(b.p));
}

function afterCall(player, hand) {
  const view = Object.create(player);
  view._model = Object.assign(Object.create(Object.getPrototypeOf(player.model)), player.model);
  view._model.shoupai = player.model.shoupai.slice();
  view._model.shoupai[player._menfeng] = hand;
  // The claimed tile is now in the meld, so exclude its river copy from counts.
  view._model.he = player.model.he.slice();
  const seat = player.model.lunban, river = player.model.he[seat];
  view._model.he[seat] = Object.assign(Object.create(Object.getPrototypeOf(river)), river,
    { _pai: river._pai.map((p, i) => i === river._pai.length - 1 ? p + "+" : p) });
  return view;
}

export function chooseImprovedCall(player, tile, level) {
  if (level < 3 || player.shoupai.lizhi) return null;
  const melds = [...player.get_peng_mianzi(player.shoupai, tile),
    ...player.get_chi_mianzi(player.shoupai, tile)];
  const seen = visibleCounts(player);
  const remaining = M.Util.tingpai(player.shoupai)
    .reduce((sum, p) => sum + Math.max(0, 4 - (seen[normalize(p)] || 0)), 0);
  // Staying closed retains riichi and flexibility. A call must earn its cost.
  const passScore = -M.Util.xiangting(player.shoupai) * 100 + remaining;
  const openingCost = player.shoupai.menqian ? 24 : 8;
  let best = null, bestScore = passScore + openingCost;
  for (const meld of melds) {
    const hand = player.shoupai.clone().fulou(meld);
    const hasYaku = yakuPaths(hand, player._menfeng, player.model.zhuangfeng)
      .some((x) => (x.name.startsWith("役牌") && x.value >= 5)
        || (x.name === "タンヤオ" && x.value === 3));
    if (!hasYaku) continue;
    const choice = improvedCandidates(afterCall(player, hand), level)[0];
    if (choice && choice.score > bestScore) {
      bestScore = choice.score;
      best = meld;
    }
  }
  return best;
}
