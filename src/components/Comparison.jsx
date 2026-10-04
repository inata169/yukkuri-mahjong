import { useEffect, useRef, useState } from "react";
import ComparisonWorker from "../game/comparison.worker.js?worker&inline";
import { CPU_TYPES } from "../game/strategy.js";
import { comparisonOptions } from "../game/comparison.js";

export default function Comparison() {
  const worker = useRef(null);
  const [sets, setSets] = useState(5), [seed, setSeed] = useState("20261004"),
    [level, setLevel] = useState(5), [status, setStatus] = useState("idle"),
    [result, setResult] = useState(null), [error, setError] = useState("");
  const running = status === "running";
  useEffect(() => () => {
    worker.current?.terminate();
    worker.current = null;
  }, []);

  function stop() {
    worker.current?.terminate();
    worker.current = null;
    setStatus("stopped");
  }
  function start() {
    setError("");
    try {
      if (!seed.trim()) throw new Error("山の番号を入力してください。");
      const config = comparisonOptions({ sets, seed: Number(seed), level });
      worker.current?.terminate();
      const next = new ComparisonWorker();
      worker.current = next;
      setResult(null);
      setStatus("running");
      next.onmessage = ({ data }) => {
        if (worker.current !== next) return;
        if (data.type === "progress") setResult(data.result);
        else {
          next.terminate();
          worker.current = null;
          setStatus(data.type === "complete" ? "complete" : "error");
          if (data.type === "error") setError(data.message);
        }
      };
      next.onerror = () => {
        if (worker.current !== next) return;
        next.terminate();
        worker.current = null;
        setStatus("error");
        setError("自動対戦を実行できませんでした。ブラウザーを更新して再試行してください。");
      };
      next.postMessage(config);
    } catch (e) {
      worker.current?.terminate();
      worker.current = null;
      setStatus("error");
      setError(e.message);
    }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "yukkuri-mahjong-cpu-comparison.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const number = (n, digits = 2) => n == null ? "—" : n.toFixed(digits);
  const rate = (n) => n == null ? "—" : `${(n * 100).toFixed(1)}%`;
  return <div className="comparison">
    <p>旧CPUと改善版CPUが2人ずつ対戦します。1セットは、同じ山の並びで席を入れ替える2回の東風戦です。</p>
    <p className="muted">両CPUは同じレベルです。レベル3は鳴き、4・5は守備も比較できます。レベル1・2の判断は共通です。</p>
    <fieldset disabled={running} className="comparison-controls">
      <legend>対戦条件</legend>
      <label>セット数<select value={sets} onChange={(e) => setSets(Number(e.target.value))}>
        <option value={1}>1セット（2対局）</option><option value={5}>5セット（10対局）</option><option value={20}>20セット（40対局）</option>
      </select></label>
      <label>CPUレベル<select value={level} onChange={(e) => setLevel(Number(e.target.value))}>
        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>レベル{n}</option>)}
      </select></label>
      <label>山の番号<input type="number" min="0" max="4294967295" step="1" value={seed} onChange={(e) => setSeed(e.target.value)} /></label>
    </fieldset>
    <p className="muted">同じ番号・条件・アプリの版なら再現できます。鳴きや連荘によって、その後の展開は変わります。</p>
    <div className="comparison-buttons">
      <button className="button primary" disabled={running} onClick={start}>自動対戦を開始</button>
      <button className="button" disabled={!running} onClick={stop}>停止</button>
    </div>
    <p role="status">{running ? `対戦中：${result?.completed || 0} / ${sets * 2}対局完了` : status === "complete" ? "自動対戦が完了しました。" : status === "stopped" ? "停止しました。完了した対局の結果を表示しています。" : ""}</p>
    {error ? <p role="alert">{error}</p> : null}
    {result ? <>
      <p>集計：{result.completed}対局／山の番号 {result.config.seed}／レベル{result.config.level}</p>
      {result.completed % 2 ? <p className="muted">席の入れ替えが途中です。公平な比較にはセットの完了が必要です。</p> : null}
      <table className="comparison-table">
        <caption>CPU別の対戦結果</caption>
        <thead><tr><th scope="col">指標</th>{Object.values(CPU_TYPES).map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{[
          ["平均順位", (s) => number(s.averageRank)],
          ["平均収支", (s) => `${number(s.averageNetPoints, 0)}点`],
          ["和了率", (s) => rate(s.winRate)],
          ["放銃率", (s) => rate(s.dealInRate)],
        ].map(([label, format]) => <tr key={label}><th scope="row">{label}</th>{Object.keys(CPU_TYPES).map((cpu) => <td key={cpu}>{format(result.summary[cpu])}</td>)}</tr>)}</tbody>
      </table>
      <p className="muted">順位は小さいほど良好。収支は開始時の25,000点との差です。和了率・放銃率は各CPUが参加した局数で計算します。少数の対戦だけでは強さを断定できません。</p>
      <button className="button" onClick={download}>比較結果を書き出す</button>
    </> : null}
    <p className="muted">現在の対局は変更しません。この画面を閉じると比較を終了します。料金は発生しません。</p>
  </div>;
}
