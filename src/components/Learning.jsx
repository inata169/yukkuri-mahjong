import {
  Lightbulb,
  MessageCircle,
  Play,
  Pause,
  StepForward,
  Undo2,
  Hand,
  HelpCircle,
} from "lucide-react";
import Tile from "./Tile.jsx";
import { tileName } from "../game/tiles.js";
import { LEVELS } from "../game/engine.js";
import { CPU_TYPES } from "../game/strategy.js";

export default function Learning({
  session,
  info,
  hintOpen,
  onHint,
  onPrompt,
  onWhy,
  mode,
  paused,
  onMode,
  onPause,
  onStep,
  onUndo,
  onSettings,
}) {
  const canHint = session.settings.hints !== "off",
    show = canHint && (session.settings.hints === "always" || hintOpen);
  return (
    <aside className="learning">
      <div className="section-heading">
        <h2>次の一手</h2>
        <button className="level-button" onClick={onSettings}>
          レベル {session.settings.level}
        </button>
      </div>
      {show && info ? (
        <>
          <div className="recommendation">
            <small>手を進める・守る候補</small>
            <div>
              <Tile p={info.best.p} />
              <strong>{tileName(info.best.p)}を捨てる</strong>
            </div>
          </div>
          <ol className="reasons">
            {info.lines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
          <div className="improving">
            <h3>来るとうれしい牌</h3>
            <div>
              {info.best.improvements
                .filter((x) => x.count > 0)
                .map((x) => (
                  <span key={x.tile}>
                    <Tile p={x.tile} small />
                    <small>最大{x.count}枚</small>
                  </span>
                ))}
            </div>
          </div>
          {info.paths.length ? (
            <div className="yaku-paths">
              <h3>狙い方のヒント</h3>
              {info.paths.slice(0, 3).map((p) => (
                <p key={p.name}>
                  <b>{p.name}</b>
                  <span>{p.text}</span>
                </p>
              ))}
            </div>
          ) : null}
          <small className="muted">
            見えている情報からの目安です。必ず勝てる手や唯一の正解ではありません。
          </small>
        </>
      ) : (
        <div className="hint-empty">
          <Lightbulb size={32} />
          <h3>
            {!canHint
              ? "自分の力で考える時間"
              : show
                ? "次の自分の番で、候補を説明します"
                : "迷ったら、理由も一緒に。"}
          </h3>
          <p>
            {!canHint
              ? "ヒントはオフです。練習設定でいつでも戻せます。"
              : "捨てる候補、狙える役、守り方を確認できます。急がなくて大丈夫です。"}
          </p>
        </div>
      )}
      <div className="learning-buttons">
        <button
          className="button hint-button"
          disabled={!canHint}
          onClick={onHint}
        >
          <Lightbulb size={19} />
          {show ? "ヒントを閉じる" : "ヒントを見る"}
        </button>
        <button className="button ai-button" onClick={onPrompt}>
          <MessageCircle size={19} />
          AIに相談
        </button>
      </div>
      <button className="text-button why-button" onClick={onWhy}>
        <HelpCircle size={16} /> なぜ、あがれない？
      </button>
      <div className="playback">
        <h3>見て学ぶ・自分で打つ</h3>
        <button
          className={`button ${mode === "auto" ? "primary" : ""}`}
          onClick={onMode}
        >
          {mode === "auto" ? (
            <>
              <Hand size={18} />
              ここから自分で打つ
            </>
          ) : (
            <>
              <Play size={18} />
              自動で観戦
            </>
          )}
        </button>
        <div className="playback-row">
          <button className="button" onClick={onPause}>
            {paused ? <Play size={17} /> : <Pause size={17} />}{" "}
            {paused ? "再開" : "一時停止"}
          </button>
          <button
            className="button"
            onClick={onStep}
            disabled={session.finished}
          >
            <StepForward size={17} />
            1手進める
          </button>
        </div>
        <button
          className="text-button"
          disabled={!session.history.length}
          onClick={onUndo}
        >
          <Undo2 size={17} />
          1手戻す
        </button>
        <small className="muted">
          1手進めると、その場面だけおまかせで進みます。
        </small>
      </div>
      <div className="learning-foot">
        {CPU_TYPES[session.settings.cpu]} レベル{session.settings.level} ·{" "}
        {LEVELS[session.settings.level - 1]}
        <br />
        制限時間なし · この端末に自動保存
      </div>
    </aside>
  );
}
