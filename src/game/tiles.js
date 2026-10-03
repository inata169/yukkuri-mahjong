export const WINDS = ["東", "南", "西", "北"];
export const normalize = (p) => p?.slice(0, 2).replace("0", "5");
export function tileName(p) {
  if (!p || p === "_") return "伏せ牌";
  const n = Number(p[1]) || 5;
  return p[0] === "z"
    ? ["", "東", "南", "西", "北", "白", "發", "中"][n]
    : `${p[1] === "0" ? "赤" : ""}${n}${{ m: "萬", p: "筒", s: "索" }[p[0]]}`;
}
export function parseTiles(text = "") {
  return [...text.matchAll(/([mpsz])([0-9+*=_-]+)/g)].flatMap(([, s, ns]) =>
    (ns.match(/\d/g) || []).map((n) => s + n),
  );
}
export function handTiles(hand) {
  return hand ? parseTiles(hand.toString().split(",")[0]) : [];
}
export function tileFile(p) {
  if (!p || p === "_") return "Back";
  const s = p[0],
    n = p[1];
  if (s === "z")
    return ["", "Ton", "Nan", "Shaa", "Pei", "Haku", "Hatsu", "Chun"][+n];
  return `${{ m: "Man", p: "Pin", s: "Sou" }[s]}${n === "0" ? "5-Dora" : n}`;
}
export function meldName(m) {
  const ns = (m.match(/\d/g) || []).map((n) => +n || 5);
  return ns.length === 4
    ? "カン"
    : ns.every((n) => n === ns[0])
      ? "ポン"
      : "チー";
}
