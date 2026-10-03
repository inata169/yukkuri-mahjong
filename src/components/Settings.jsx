import { LEVELS, PRESETS } from "../game/engine.js";
export default function Settings({
  settings,
  onChange,
  onNew,
  onReplay,
  preset,
  setPreset,
  length,
  setLength,
}) {
  return (
    <div className="settings">
      <label>
        ヒントの出し方
        <select
          value={settings.hints}
          onChange={(e) => onChange({ hints: e.target.value })}
        >
          <option value="ask">聞いたときだけ</option>
          <option value="always">いつも表示</option>
          <option value="off">ヒントなし</option>
        </select>
      </label>
      <fieldset>
        <legend>CPUの強さ</legend>
        <div className="levels">
          {LEVELS.map((name, i) => (
            <button
              key={i}
              className={settings.level === i + 1 ? "chosen" : ""}
              aria-pressed={settings.level === i + 1}
              onClick={() => onChange({ level: i + 1 })}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <p>{LEVELS[settings.level - 1]}</p>
        <small>
          次の判断から反映します。レベル5はリーチへの守りも考えます。対戦段位を示すものではありません。
        </small>
      </fieldset>
      <label>
        進む速さ
        <select
          value={settings.speed}
          onChange={(e) => onChange({ speed: Number(e.target.value) })}
        >
          <option value="1500">ゆっくり</option>
          <option value="850">ふつう</option>
          <option value="250">はやい</option>
        </select>
      </label>
      <fieldset>
        <legend>見て学ぶ・チート練習</legend>
        <label className="switch-label">
          <span>相手の手牌を公開</span>
          <input
            type="checkbox"
            checked={settings.reveal}
            onChange={(e) => onChange({ reveal: e.target.checked })}
          />
        </label>
        <label className="switch-label">
          <span>山の残り牌を公開</span>
          <input
            type="checkbox"
            checked={settings.wall}
            onChange={(e) => onChange({ wall: e.target.checked })}
          />
        </label>
        <small>公開しても、CPUとヒントは非公開情報を使いません。</small>
        <button className="button full" onClick={onReplay}>
          この局を同じ配牌からやり直す
        </button>
      </fieldset>
      <fieldset>
        <legend>新しく始める</legend>
        <label>
          対局の長さ
          <select
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
          >
            <option value="1">東風戦（東場）</option>
            <option value="2">半荘戦（東場＋南場）</option>
          </select>
        </label>
        <label>
          配牌
          <select value={preset} onChange={(e) => setPreset(e.target.value)}>
            {Object.entries(PRESETS).map(([key, text]) => (
              <option key={key} value={key}>
                {text}
              </option>
            ))}
          </select>
        </label>
        <p className="muted">
          現在の対局を終了して、新しい対局に切り替えます。
        </p>
        <button className="button primary full" onClick={onNew}>
          新しい対局を始める
        </button>
      </fieldset>
      <p className="muted">
        採用ルール：25,000点持ち、赤5各1枚、喰いタンあり、後付けあり、ダブロンあり、喰い替えなし。親は和了・テンパイで連荘、延長戦なしです。
      </p>
    </div>
  );
}
