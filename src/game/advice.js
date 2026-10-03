import M from "@kobalab/majiang-core";
import { handTiles, parseTiles, normalize, tileName, WINDS } from "./tiles.js";

// This module receives only the player's public Board, never the server/table wall.
export function visibleCounts(player) {
  const counts = {};
  const add = (p) => {
    const q = normalize(p);
    if (q && q !== "_") counts[q] = (counts[q] || 0) + 1;
  };
  handTiles(player.shoupai).forEach(add);
  for (const h of player.model.he)
    h._pai.filter((p) => !/[+=-]$/.test(p)).forEach(add);
  for (const h of player.model.shoupai)
    for (const m of h._fulou) parseTiles(m).forEach(add);
  player.shan.baopai.forEach(add);
  return counts;
}
export function yakuPaths(hand, wind, round) {
  const tiles = [...handTiles(hand), ...hand._fulou.flatMap(parseTiles)];
  const n = tiles.map(normalize),
    paths = [];
  if (hand.menqian)
    paths.push({
      name: "リーチ",
      text: "鳴かずにテンパイすれば宣言できます。",
      value: 1,
    });
  const ends = n.filter((p) => p[0] === "z" || /[19]/.test(p[1])).length;
  if (ends <= 3)
    paths.push({
      name: "タンヤオ",
      text: ends
        ? `1・9・字牌があと${ends}枚。2〜8だけの形を目指せます。`
        : "すべて2〜8の牌です。この条件を保って手を完成させます。",
      value: 3 - ends,
    });
  const honors = [...new Set([5, 6, 7, wind + 1, round + 1])];
  for (const h of honors) {
    const count = n.filter((p) => p === "z" + h).length;
    if (count >= 2)
      paths.push({
        name: `役牌・${tileName("z" + h)}`,
        text:
          count >= 3
            ? "3枚以上そろっています。ほかの組み合わせを完成させましょう。"
            : "同じ牌をあと1枚集めると、役のある3枚組にできます。",
        value: count === 2 ? 2 : 5,
      });
  }
  if (hand.menqian) {
    const counts = n.reduce((a, p) => ((a[p] = (a[p] || 0) + 1), a), {});
    if (Object.values(counts).filter((c) => c >= 2).length >= 4)
      paths.push({
        name: "七対子",
        text: "異なる7種類の対子（同じ牌2枚）を集めます。鳴けません。",
        value: 2,
      });
  }
  return paths;
}
function yakuValue(hand, player) {
  const tiles = [...handTiles(hand), ...hand._fulou.flatMap(parseTiles)];
  const dora = player.shan.baopai.map(M.Shan.zhenbaopai);
  let v = tiles.reduce(
    (sum, p) =>
      sum +
      (p[1] === "0" ? 1.3 : 0) +
      dora.filter((d) => d === normalize(p)).length * 1.3,
    0,
  );
  const paths = yakuPaths(hand, player._menfeng, player.model.zhuangfeng);
  v += paths.reduce((sum, p) => sum + Math.max(p.value, 0) * 0.45, 0);
  return v;
}
export function candidates(player, level = 5) {
  if (!player?.shoupai?._zimo) return [];
  const seen = visibleCounts(player);
  const threats = player.model.shoupai
    .map((h, i) => (h.lizhi && i !== player._menfeng ? i : -1))
    .filter((i) => i >= 0);
  return player
    .get_dapai(player.shoupai)
    .map((p) => {
      const hand = player.shoupai.clone().dapai(p);
      const shanten = M.Util.xiangting(hand);
      const improvements = M.Util.tingpai(hand);
      const counts = improvements.map((t) => ({
        tile: t,
        count: Math.max(0, 4 - (seen[normalize(t)] || 0)),
      }));
      const remaining = counts.reduce((a, x) => a + x.count, 0);
      const safe =
        threats.length > 0 && threats.every((i) => player.model.he[i].find(p));
      let risk = 0;
      if (threats.length && !safe) {
        risk =
          normalize(p)[0] === "z"
            ? Math.max(0.15, 0.8 - (seen[normalize(p)] || 0) * 0.18)
            : 0.9;
      }
      const defense = level >= 5 ? risk * (shanten > 0 ? 150 : 42) : 0;
      const value = level >= 4 ? yakuValue(hand, player) * 2 : 0;
      const score =
        -shanten * 100 + (level >= 3 ? remaining : 0) + value - defense;
      return {
        p,
        shanten,
        improvements: counts,
        remaining,
        safe,
        threats: threats.length,
        score,
      };
    })
    .sort((a, b) => b.score - a.score || a.p.localeCompare(b.p));
}
export function advice(player) {
  const ranked = candidates(player),
    best = ranked[0];
  if (!best) return null;
  const lines = [];
  if (best.safe)
    lines.push(
      "リーチしている相手全員の現物です。その相手にはロンされない牌を優先しています。",
    );
  else if (best.threats)
    lines.push(
      "相手がリーチしています。この候補も安全を保証するものではありません。",
    );
  lines.push(
    best.shanten === 0
      ? "捨てるとテンパイ。あと1枚で手の形が完成します（役とフリテンも確認）。"
      : `捨てたあと、テンパイまでの目安は${best.shanten}段階です。手の形を進めやすい候補です。`,
  );
  if (best.remaining)
    lines.push(
      `形を進める牌は${best.improvements.filter((x) => x.count > 0).length}種類、見えていない分が最大${best.remaining}枚あります。相手の手牌にある分も含むため、山に残る枚数ではありません。`,
    );
  return {
    best,
    ranked: ranked.slice(0, 3),
    lines,
    paths: yakuPaths(player.shoupai, player._menfeng, player.model.zhuangfeng),
  };
}
export function makePrompt(player, legal, status) {
  const m = player.model;
  const rows = m.player_id.map(
    (id, l) =>
      `${WINDS[l]}家（${id === 0 ? "自分" : "CPU"}）: ${m.defen[id]}点／捨て牌: ${m.he[l]._pai.map(tileName).join(" ") || "なし"}／鳴き: ${m.shoupai[l]._fulou.join("、") || "なし"}／リーチ: ${m.shoupai[l].lizhi ? "あり" : "なし"}`,
  );
  return `日本の4人打ちリーチ麻雀の初心者です。次の局面での選択と理由を、やさしい日本語で教えてください。\n\n【ルール】25,000点持ち、赤5は各1枚、喰いタンあり、後付けあり、ダブロンあり、喰い替えなし。ドラだけでは和了できません。\n【局面】${WINDS[m.zhuangfeng]}${m.jushu + 1}局 ${m.changbang}本場／供託${m.lizhibang}本／自分は${WINDS[player._menfeng]}家／残り${player.shan.paishu}枚\n【状況】${status}\n【手牌】${handTiles(player.shoupai).map(tileName).join(" ")}\n【牌の機械表記】${player.shoupai.toString()}（m=萬子、p=筒子、s=索子、z=字牌、0=赤5）\n【ツモ牌】${player.shoupai._zimo?.length === 2 ? tileName(player.shoupai._zimo) : "なし"}\n【ドラ表示牌】${player.shan.baopai.map(tileName).join(" ")}\n【ドラ】${player.shan.baopai.map(M.Shan.zhenbaopai).map(tileName).join(" ")}\n${rows.join("\n")}\n【今選べる操作】${legal.map((a) => a.label).join("／") || "自分の番を待つ"}\n\n相手の非公開手牌・山牌・裏ドラは不明です。推測を事実として扱わず、捨てる候補を最大3つ比較し、手の速さ・狙える役・守りの観点から説明してください。ポン・チーが可能なら、鳴く場合と見送る場合も比較してください。不確かなことは明記してください。`;
}
