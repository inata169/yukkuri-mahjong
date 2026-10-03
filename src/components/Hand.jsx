import Tile from "./Tile.jsx";
import { Melds } from "./Table.jsx";
import { handTiles, tileName } from "../game/tiles.js";

export default function Hand({
  session,
  actions,
  selected,
  setSelected,
  onAction,
  manual,
  status,
  onTakeover,
}) {
  const hand = session.me.shoupai,
    tiles = handTiles(hand);
  const discard = actions.find(
    (a) => a.kind === "discard" && a.tile === selected?.token,
  );
  const riichi = actions.find(
    (a) => a.kind === "riichi" && a.tile === selected?.token,
  );
  const special = actions.filter(
    (a) => !["discard", "riichi"].includes(a.kind),
  );
  return (
    <section className="hand-panel" aria-label="あなたの手牌">
      <div className="hand-title">
        <span>あなたの手牌</span>
        <small>
          {hand.lizhi
            ? "リーチ中"
            : hand.menqian
              ? "鳴いていない手"
              : "鳴いている手"}
          {hand._zimo?.length === 2 ? " · 最後がツモ牌" : ""}
        </small>
      </div>
      <div className="your-hand">
        {tiles.map((p, i) => {
          const tsumo = i === tiles.length - 1 && hand._zimo?.length === 2;
          const token = p + (tsumo ? "_" : "");
          const enabled =
            manual &&
            actions.some((a) => a.kind === "discard" && a.tile === token);
          return (
            <Tile
              p={p}
              key={i}
              onClick={() => setSelected({ index: i, token })}
              disabled={!enabled}
              selected={selected?.index === i && enabled}
              className={tsumo ? "drawn-tile" : ""}
              label={`${tileName(p)}${tsumo ? "（ツモ牌）" : ""}を選ぶ`}
            />
          );
        })}
      </div>
      <Melds hand={hand} />
      <div className="hand-actions">
        <p role="status">
          {manual
            ? discard
              ? `${tileName(discard.tile)}を選択しています`
              : status
            : "自動で観戦しています。いつでも参加できます。"}
        </p>
        {manual && actions.some((a) => a.kind === "discard") ? (
          <div className="discard-actions">
            {riichi ? (
              <button
                className="button riichi-button"
                onClick={() => onAction(riichi)}
              >
                リーチして捨てる
              </button>
            ) : null}
            <button
              className="button primary"
              disabled={!discard}
              onClick={() => onAction(discard)}
            >
              この牌を捨てる
            </button>
          </div>
        ) : null}
      </div>
      {!manual ? (
        <button className="button primary full" onClick={onTakeover}>
          ここから自分で打つ
        </button>
      ) : null}
      {manual && special.length ? (
        <div className="special-actions">
          {special.map((a, i) => (
            <button
              key={i}
              className={`button ${a.kind === "win" ? "primary" : a.kind === "pass" ? "" : "secondary"}`}
              onClick={() => onAction(a)}
            >
              {a.label}
            </button>
          ))}
        </div>
      ) : null}
      {manual && special.some((a) => a.kind === "call") ? (
        <p className="call-explanation">
          鳴くとリーチはできなくなります。役を残せるか考えてから選びましょう。「見送る」も大切な選択です。
        </p>
      ) : null}
    </section>
  );
}
