import Tile from "./Tile.jsx";
import { WINDS, handTiles, parseTiles } from "../game/tiles.js";
import { Eye } from "lucide-react";

export function PlayerDetail({ session, seat }) {
  const m = session.game.model,
    h = m.shoupai[seat],
    own = m.player_id[seat] === 0;
  return (
    <>
      <p>
        {WINDS[seat]}家 · {m.defen[m.player_id[seat]].toLocaleString()}点{" "}
        {h.lizhi ? " · リーチ" : ""}
      </p>
      <h3>手牌</h3>
      {own || session.settings.reveal ? (
        <div className="detail-tiles">
          {handTiles(h).map((p, i) => (
            <Tile p={p} key={i} />
          ))}
        </div>
      ) : (
        <p>手牌は伏せています。「練習設定」の手牌公開で見られます。</p>
      )}
      <h3>鳴いた牌</h3>
      <Melds hand={h} />
      {!h._fulou.length ? <p>まだ鳴いていません。</p> : null}
      <h3>捨て牌（順番どおり）</h3>
      <div className="detail-tiles">
        {m.he[seat]._pai.map((p, i) => (
          <span className="detail-discard" key={i}>
            <Tile p={p} />
            <small>
              {i + 1}
              {p.includes("*") ? " リーチ" : ""}
              {/[+=-]$/.test(p) ? " 鳴かれた" : ""}
            </small>
          </span>
        ))}
      </div>
    </>
  );
}
export function Melds({ hand }) {
  return (
    <div className="melds">
      {hand._fulou.map((meld, i) => (
        <span className="meld" key={i}>
          {parseTiles(meld).map((p, j) => (
            <Tile p={p} small key={j} />
          ))}
        </span>
      ))}
    </div>
  );
}
function Opponent({ session, seat, position, onInspect }) {
  const m = session.game.model,
    h = m.shoupai[seat],
    id = m.player_id[seat];
  const active = m.lunban === seat && !session.roundEnd;
  const tiles = handTiles(h),
    count = tiles.length;
  return (
    <div className={`opponent opponent-${position} ${active ? "active" : ""}`}>
      <button
        className="player-name"
        onClick={() => onInspect(seat)}
        aria-label={`${m.player[id]}の牌を確認`}
      >
        <b>{WINDS[seat]}</b>
        <span>
          {m.player[id]}
          <small>
            {m.defen[id].toLocaleString()}点 {h.lizhi ? "・リーチ" : ""}
          </small>
        </span>
      </button>
      <div
        className={`opponent-hand ${session.settings.reveal ? "revealed" : ""}`}
        aria-label={session.settings.reveal ? "公開手牌" : "伏せた手牌"}
      >
        {(session.settings.reveal ? tiles : Array(count).fill("_")).map(
          (p, i) => (
            <Tile p={p} small key={i} />
          ),
        )}
      </div>
      <Melds hand={h} />
      <button
        className="river"
        onClick={() => onInspect(seat)}
        aria-label={`${m.player[id]}の捨て牌を拡大`}
      >
        {m.he[seat]._pai.map((p, i) => (
          <Tile
            p={p}
            small
            key={i}
            className={`${p.includes("*") ? "riichi-tile" : ""} ${/[+=-]$/.test(p) ? "called-tile" : ""}`}
          />
        ))}
        {!m.he[seat]._pai.length ? (
          <span className="river-empty">捨て牌</span>
        ) : null}
      </button>
    </div>
  );
}
export default function Table({ session, onInspect }) {
  const m = session.game.model,
    l = session.seat,
    me = m.shoupai[l];
  return (
    <section className="table" aria-label="麻雀卓">
      <Opponent
        session={session}
        seat={(l + 2) % 4}
        position="top"
        onInspect={onInspect}
      />
      <Opponent
        session={session}
        seat={(l + 3) % 4}
        position="left"
        onInspect={onInspect}
      />
      <div className="table-center">
        <span className="round-label">
          {WINDS[m.zhuangfeng]}
          {m.jushu + 1}局
        </span>
        <strong>
          残り <b>{m.shan.paishu}</b> 枚
        </strong>
        <span>
          {m.changbang}本場 · 供託 {m.lizhibang}本
        </span>
        <div className="dora">
          <small>ドラ表示牌</small>
          <div>
            {m.shan.baopai.map((p, i) => (
              <Tile p={p} small key={i} />
            ))}
          </div>
        </div>
        {session.settings.reveal || session.settings.wall ? (
          <span className="training-indicator">
            <Eye size={13} /> 公開練習中
          </span>
        ) : null}
      </div>
      <Opponent
        session={session}
        seat={(l + 1) % 4}
        position="right"
        onInspect={onInspect}
      />
      <div className="your-river">
        <button className="player-name" onClick={() => onInspect(l)}>
          <b>{WINDS[l]}</b>
          <span>
            あなた
            <small>
              {m.defen[0].toLocaleString()}点 {me.lizhi ? "・リーチ" : ""}
            </small>
          </span>
        </button>
        <button
          className="river"
          onClick={() => onInspect(l)}
          aria-label="自分の捨て牌を拡大"
        >
          {m.he[l]._pai.map((p, i) => (
            <Tile
              p={p}
              small
              key={i}
              className={`${p.includes("*") ? "riichi-tile" : ""} ${/[+=-]$/.test(p) ? "called-tile" : ""}`}
            />
          ))}
        </button>
      </div>
    </section>
  );
}
