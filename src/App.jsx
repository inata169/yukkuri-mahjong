import { useState, useRef, useEffect, useMemo } from "react";
import {
  Settings2,
  BookOpen,
  RotateCcw,
  Copy,
  Check,
  Eye,
  Download,
  ChevronDown,
} from "lucide-react";
import { Session, DEFAULT_SETTINGS, M } from "./game/engine.js";
import { advice } from "./game/advice.js";
import { tileName, handTiles } from "./game/tiles.js";
import Table, { PlayerDetail, Melds } from "./components/Table.jsx";
import Hand from "./components/Hand.jsx";
import Learning from "./components/Learning.jsx";
import Modal from "./components/Modal.jsx";
import Settings from "./components/Settings.jsx";
import Guide from "./components/Guide.jsx";
import Tile from "./components/Tile.jsx";

const SAVE_KEY = "yukkuri-mahjong-session-v1";
function boot() {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved)
      return {
        session: Session.load(saved),
        notice: "保存した対局を再開しました。",
      };
  } catch {
    return {
      session: new Session(),
      notice: "保存データを読み込めなかったため、新しい対局を開始しました。",
    };
  }
  return { session: new Session(), notice: "" };
}
export default function App() {
  const ref = useRef(null);
  if (!ref.current) ref.current = boot();
  const session = ref.current.session;
  const [revision, setRevision] = useState(0),
    [selected, setSelected] = useState(null),
    [mode, setMode] = useState("manual"),
    [paused, setPaused] = useState(false),
    [hintOpen, setHintOpen] = useState(false),
    [modal, setModal] = useState(null),
    [notice, setNotice] = useState(ref.current.notice),
    [copied, setCopied] = useState(false),
    [copyError, setCopyError] = useState(false),
    [copying, setCopying] = useState(false),
    [preset, setPreset] = useState("normal"),
    [length, setLength] = useState(session.settings.length);
  const saveError = useRef(false),
    importRef = useRef(null);
  const actions = useMemo(() => session.actions(), [session, revision]);
  const info = useMemo(
    () =>
      session.settings.hints !== "off" &&
      (hintOpen || session.settings.hints === "always")
        ? advice(session.me)
        : null,
    [session, revision, hintOpen],
  );
  const refresh = () => {
    setSelected(null);
    setHintOpen(false);
    setRevision((n) => n + 1);
  };
  function step(action) {
    try {
      session.step(action);
      refresh();
    } catch (e) {
      setPaused(true);
      setNotice(
        `対局を停止しました：${e.message}。設定から同じ配牌でやり直せます。`,
      );
    }
  }
  function updateSettings(change) {
    session.updateSettings(change);
    if (change.reveal || change.wall) session.assisted = true;
    setRevision((n) => n + 1);
  }
  useEffect(() => {
    try {
      localStorage.setItem(SAVE_KEY, session.save());
      saveError.current = false;
    } catch {
      if (!saveError.current) {
        setNotice(
          "このブラウザーに保存できません。「対局を書き出す」で保存してください。",
        );
        saveError.current = true;
      }
    }
  }, [session, revision]);
  useEffect(() => {
    if (modal || paused || session.finished || document.hidden) return;
    if (mode === "manual" && (actions.length || session.roundEnd)) return;
    const timer = setTimeout(
      () => step(),
      session.roundEnd ? 2400 : session.settings.speed,
    );
    return () => clearTimeout(timer);
  }, [session, revision, paused, mode, modal, actions]);
  useEffect(() => {
    const fn = () => {
      if (document.hidden) setPaused(true);
    };
    document.addEventListener("visibilitychange", fn);
    return () => document.removeEventListener("visibilitychange", fn);
  }, []);
  function newGame() {
    ref.current.session = new Session({ ...session.settings, length }, preset);
    setMode("manual");
    setPaused(false);
    setModal(null);
    setNotice(
      preset === "normal"
        ? "新しい対局を始めました。"
        : "練習用に配牌を調整した対局です。",
    );
    refresh();
  }
  function undo() {
    if (session.undo()) {
      setMode("manual");
      setPaused(true);
      setNotice("1手戻しました。「再開」で続けられます。");
      refresh();
    }
  }
  function replay() {
    session.replay();
    setMode("manual");
    setPaused(false);
    setModal(null);
    setNotice("この局を同じ配牌からやり直しました。");
    refresh();
  }
  async function copy() {
    setCopyError(false);
    setCopying(true);
    let timer;
    try {
      await Promise.race([
        navigator.clipboard.writeText(session.prompt()),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("Clipboard timeout")), 3000);
        }),
      ]);
      setCopied(true);
    } catch {
      setCopyError(true);
    } finally {
      clearTimeout(timer);
      setCopying(false);
    }
  }
  function download() {
    const blob = new Blob([session.save()], { type: "application/json" });
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "yukkuri-mahjong-save.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importSave(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 4000000) throw new Error("ファイルが大きすぎます");
      const loaded = Session.load(await file.text());
      ref.current.session = loaded;
      setLength(loaded.settings.length);
      setMode("manual");
      setPaused(true);
      setModal(null);
      setNotice("対局を読み込みました。「再開」で続けられます。");
      refresh();
    } catch (err) {
      setNotice(`読み込めませんでした：${err.message}`);
    }
    e.target.value = "";
  }
  const g = session.game,
    m = g.model,
    end = g._event;
  const title =
    modal?.type === "settings"
      ? "練習設定"
      : modal?.type === "guide"
        ? "役の手引き"
        : modal?.type === "prompt"
          ? "AIに相談する文章"
          : modal?.type === "why"
            ? "あがるための条件"
            : modal?.type === "player"
              ? `${m.player[m.player_id[modal.seat]]}の牌`
              : modal?.type === "wall"
                ? "山の残り牌"
                : modal?.type === "review"
                  ? "この局の振り返り"
                  : "";
  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-tile">發</span>
          <div>
            <h1>ゆっくり麻雀</h1>
            <p>一手ずつ、分かる練習。</p>
          </div>
        </div>
        <nav aria-label="メニュー">
          <button
            className="header-button"
            onClick={() => setModal({ type: "guide" })}
          >
            <BookOpen size={19} />
            <span>役の手引き</span>
          </button>
          <button
            className="header-button"
            onClick={() => setModal({ type: "settings" })}
          >
            <Settings2 size={20} />
            <span>練習設定</span>
          </button>
        </nav>
      </header>
      {notice ? (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button aria-label="お知らせを閉じる" onClick={() => setNotice("")}>
            ×
          </button>
        </div>
      ) : null}
      <main className="game-layout">
        <div className="play-area">
          <div className="table-shell">
            <Table
              session={session}
              onInspect={(seat) => setModal({ type: "player", seat })}
            />
            <Hand
              session={session}
              actions={actions}
              selected={selected}
              setSelected={setSelected}
              onAction={step}
              manual={mode === "manual"}
              onTakeover={() => {
                setMode("manual");
                setPaused(false);
              }}
              status={
                paused
                  ? "一時停止中です。手動でも操作できます。"
                  : session.status()
              }
            />
          </div>
          {session.roundEnd ? (
            <section className="result-panel" aria-live="polite">
              <h2>{session.status()}</h2>
              {end.hule ? (
                <>
                  <div className="winning-hand">
                    {handTiles(M.Shoupai.fromString(end.hule.shoupai)).map(
                      (p, i) => (
                        <Tile p={p} small key={i} />
                      ),
                    )}
                  </div>
                  <Melds hand={M.Shoupai.fromString(end.hule.shoupai)} />
                  <p className="win-score">
                    {end.hule.damanguan
                      ? `${end.hule.damanguan}倍役満`
                      : `${end.hule.fanshu}翻 ${end.hule.fu || ""}符`}{" "}
                    · {end.hule.defen.toLocaleString()}点
                  </p>
                  <p>
                    {end.hule.hupai
                      ?.map((h) => `${h.name} ${h.fanshu}翻`)
                      .join("／")}
                  </p>
                </>
              ) : null}
              {end.hule || end.pingju ? (
                <div className="score-changes">
                  {(end.hule || end.pingju).fenpei.map((v, l) => (
                    <span key={l}>
                      {m.player[m.player_id[l]]}
                      <b className={v > 0 ? "plus" : v < 0 ? "minus" : ""}>
                        {v > 0 ? "+" : ""}
                        {v.toLocaleString()}点
                      </b>
                    </span>
                  ))}
                </div>
              ) : null}
              {session.finished ? (
                <p>
                  {m.player
                    .map((p, id) => `${p} ${m.defen[id].toLocaleString()}点`)
                    .join("／")}
                </p>
              ) : null}
              <div className="result-buttons">
                <button
                  className="button"
                  onClick={() => setModal({ type: "review" })}
                >
                  この局を振り返る
                </button>
                <button
                  className="button primary"
                  onClick={() =>
                    session.finished ? setModal({ type: "settings" }) : step()
                  }
                >
                  {session.finished ? "新しい対局へ" : "結果を確認して進む"}
                </button>
              </div>
            </section>
          ) : null}
          <div className="quick-bar">
            <button
              className="text-button"
              onClick={() => setModal({ type: "settings" })}
            >
              <Settings2 size={17} />
              練習設定
              <ChevronDown size={15} />
            </button>
            <label>
              ヒント
              <select
                aria-label="ヒント設定"
                value={session.settings.hints}
                onChange={(e) => updateSettings({ hints: e.target.value })}
              >
                <option value="ask">聞いたときだけ</option>
                <option value="always">いつも表示</option>
                <option value="off">なし</option>
              </select>
            </label>
            <label className="quick-toggle">
              手牌公開
              <input
                aria-label="相手の手牌を公開"
                type="checkbox"
                checked={session.settings.reveal}
                onChange={(e) => updateSettings({ reveal: e.target.checked })}
              />
            </label>
            {session.settings.wall ? (
              <button
                className="text-button"
                onClick={() => setModal({ type: "wall" })}
              >
                <Eye size={17} />
                山を見る
              </button>
            ) : null}
            <button
              className="text-button"
              onClick={undo}
              disabled={!session.history.length}
            >
              <RotateCcw size={17} />
              戻す
            </button>
          </div>
        </div>
        <Learning
          session={session}
          info={info}
          hintOpen={hintOpen}
          onHint={() => {
            if (session.settings.hints === "always") {
              updateSettings({ hints: "ask" });
              setHintOpen(false);
            } else setHintOpen((v) => !v);
          }}
          onPrompt={() => {
            setCopied(false);
            setCopyError(false);
            setModal({ type: "prompt" });
          }}
          onWhy={() => setModal({ type: "why" })}
          mode={mode}
          paused={paused}
          onMode={() => {
            setMode((v) => (v === "auto" ? "manual" : "auto"));
            setPaused(false);
            setSelected(null);
          }}
          onPause={() => setPaused((v) => !v)}
          onStep={() => {
            setPaused(true);
            step();
          }}
          onUndo={undo}
          onSettings={() => setModal({ type: "settings" })}
        />
      </main>
      <footer className="app-footer">
        <span>牌や捨て牌を押すと、拡大して確認できます。</span>
        <div>
          <button className="text-button" onClick={download}>
            <Download size={15} />
            対局を書き出す
          </button>
          <button
            className="text-button"
            onClick={() => importRef.current.click()}
          >
            読み込む
          </button>
          <a
            href={
              globalThis.__MAHJONG_NOTICE ||
              `${import.meta.env.BASE_URL}licenses/index.html`
            }
            download={globalThis.__MAHJONG_NOTICE ? "LICENSES.txt" : undefined}
            target="_blank"
            rel="noreferrer"
          >
            素材・ライセンス
          </a>
        </div>
        <input
          ref={importRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={importSave}
        />
      </footer>
      {modal ? (
        <Modal title={title} onClose={() => setModal(null)}>
          {modal.type === "settings" ? (
            <Settings
              settings={session.settings}
              onChange={updateSettings}
              onNew={newGame}
              onReplay={replay}
              preset={preset}
              setPreset={setPreset}
              length={length}
              setLength={setLength}
            />
          ) : null}
          {modal.type === "guide" ? <Guide /> : null}
          {modal.type === "player" ? (
            <PlayerDetail session={session} seat={modal.seat} />
          ) : null}
          {modal.type === "why" ? (
            <>
              <p className="why-message">{session.whyNoWin()}</p>
              <button
                className="button"
                onClick={() => setModal({ type: "guide" })}
              >
                役の手引きを見る
              </button>
            </>
          ) : null}
          {modal.type === "prompt" ? (
            <>
              <p>
                下の文章をコピーし、ChatGPTなどに貼り付けて相談できます。相手の非公開手牌・山牌は含めません。
              </p>
              <textarea
                className="prompt-text"
                readOnly
                value={session.prompt()}
                aria-label="AIへの相談文"
                onFocus={(e) => e.target.select()}
              />
              <button className="button primary full" onClick={copy} disabled={copying}>
                {copied ? <Check size={18} /> : <Copy size={18} />}{" "}
                {copying ? "コピーしています…" : copied ? "コピーしました" : "相談文をコピー"}
              </button>
              {copyError ? (
                <p role="status">
                  コピーできませんでした。相談文を押して選択し、コピーしてください。
                  PCではCtrl+C（Macでは⌘C）でもコピーできます。
                </p>
              ) : null}
            </>
          ) : null}
          {modal.type === "wall" ? (
            <>
              <p>
                次に引く牌から順番に表示しています。王牌14枚は除いています。カンがあると引く順番が変わります。
              </p>
              <div className="detail-tiles">
                {m.shan._pai
                  .slice(14)
                  .reverse()
                  .map((p, i) => (
                    <span className="detail-discard" key={i}>
                      <Tile p={p} />
                      <small>{i + 1}</small>
                    </span>
                  ))}
              </div>
            </>
          ) : null}
          {modal.type === "review" ? (
            <>
              <p>
                自分で捨てた牌と、その時点の見えている情報からの候補です。候補と違っても、間違いとは限りません。
              </p>
              {session.reviews.length ? (
                <div className="review-list">
                  {session.reviews.map((r, i) => (
                    <div key={i}>
                      <span>{i + 1}手目</span>
                      <Tile p={r.pick} small />
                      <span>候補</span>
                      <Tile p={r.best} small />
                      <small>テンパイまで{Math.max(0, r.shanten)}段階</small>
                    </div>
                  ))}
                </div>
              ) : (
                <p>この局では、まだ自分で捨てる操作をしていません。</p>
              )}
              <button className="button" onClick={replay}>
                同じ配牌でもう一度
              </button>
            </>
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}
