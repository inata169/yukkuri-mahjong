import M from "@kobalab/majiang-core";
import { candidates, yakuPaths, makePrompt } from "./advice.js";
import { tileName, meldName, WINDS, parseTiles } from "./tiles.js";

export const DEFAULT_SETTINGS = {
  level: 2,
  hints: "ask",
  reveal: false,
  wall: false,
  speed: 850,
  length: 1,
};
export const LEVELS = [
  "はじめの一歩",
  "やさしい",
  "ふつう",
  "役と点数",
  "守りも考える",
];
export const PRESETS = {
  normal: "普通の配牌",
  riichi: "リーチを練習",
  tanyao: "タンヤオを練習",
  yakuhai: "役牌を練習",
};
const PRESET_HANDS = {
  riichi: "m123456p234s678z1",
  tanyao: "m23467p23455s346",
  yakuhai: "m23467p234s456z55",
};
const EMPTY = () => {};
function hash(text) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

class TrainingPlayer extends M.Player {
  constructor(level) {
    super();
    this.level = level;
  }
  chooseDiscard() {
    const a = candidates(this, this.level),
      n = hash(this.shoupai.toString() + this.he._pai.join(""));
    const c = this.level === 1 ? (n % 3 === 0 ? a[n % a.length] : a[0]) : a[0];
    const riichi =
      this.level >= 2 &&
      this.allow_lizhi(this.shoupai, c.p) &&
      (this.level < 5 ||
        !this.model.shoupai.some((s, i) => i !== this._menfeng && s.lizhi) ||
        c.shanten === 0);
    return { dapai: c.p + (riichi ? "*" : "") };
  }
  canWin(data, extra = false) {
    if (data?.m && /^[mpsz]\d{4}$/.test(data.m)) return false;
    const p = data
      ? (data.m ? data.m[0] + data.m.slice(-1) : data.p.slice(0, 2)) +
        "_+=-"[(4 + this.model.lunban - this._menfeng) % 4]
      : null;
    return this.allow_hule(this.shoupai, p, extra);
  }
  action_kaiju() {
    this._callback();
  }
  action_qipai() {
    this._callback();
  }
  action_zimo(data, kan) {
    if (data.l !== this._menfeng) return this._callback();
    if (this.canWin(null, kan)) return this._callback({ hule: "-" });
    // Conservative CPU: kan only with unchanged shape distance and no opponent riichi.
    if (
      this.level >= 4 &&
      !this.model.shoupai.some((s, i) => i !== this._menfeng && s.lizhi)
    ) {
      const n = M.Util.xiangting(this.shoupai);
      const g = this.get_gang_mianzi(this.shoupai).find(
        (m) => M.Util.xiangting(this.shoupai.clone().gang(m)) <= n,
      );
      if (g) return this._callback({ gang: g });
    }
    this._callback(this.chooseDiscard());
  }
  action_dapai(data) {
    if (data.l === this._menfeng) return this._callback();
    if (this.canWin(data)) return this._callback({ hule: "-" });
    if (this.level < 3 || this.shoupai.lizhi) return this._callback();
    if (
      this.level >= 5 &&
      this.model.shoupai.some((s, i) => i !== this._menfeng && s.lizhi)
    )
      return this._callback();
    const p = data.p.slice(0, 2) + "_+=-"[(4 + data.l - this._menfeng) % 4];
    const n = M.Util.xiangting(this.shoupai);
    const melds = [
      ...this.get_peng_mianzi(this.shoupai, p),
      ...this.get_chi_mianzi(this.shoupai, p),
    ];
    const meld = melds.find((m) => {
      const hand = this.shoupai.clone().fulou(m);
      return (
        M.Util.xiangting(hand) < n &&
        yakuPaths(hand, this._menfeng, this.model.zhuangfeng).some(
          (x) =>
            (x.name.startsWith("役牌") && x.value >= 5) ||
            (x.name === "タンヤオ" && x.value === 3),
        )
      );
    });
    this._callback(meld ? { fulou: meld } : {});
  }
  action_fulou(data) {
    this._callback(
      data.l === this._menfeng && !/^[mpsz]\d{4}/.test(data.m)
        ? this.chooseDiscard()
        : {},
    );
  }
  action_gang(data) {
    this._callback(
      data.l !== this._menfeng && this.canWin(data, true) ? { hule: "-" } : {},
    );
  }
  action_hule() {
    this._callback();
  }
  action_pingju() {
    this._callback();
  }
  action_jieju() {
    this._callback();
  }
}

class TrainingGame extends M.Game {
  constructor(settings, preset) {
    super(
      Array.from(
        { length: 4 },
        (_, i) => new TrainingPlayer(i === 0 ? 5 : settings.level),
      ),
      EMPTY,
      M.rule({ 場数: settings.length, 延長戦方式: 0 }),
      "ゆっくり麻雀",
    );
    this._sync = true;
    this._preset = preset;
    this._model.player = ["あなた", "こはる", "あおい", "ひなた"];
    this._event = {};
  }
  call_players(type, msg) {
    this._status = type;
    this._reply = [];
    for (let l = 0; l < 4; l++) {
      const id = this.model.player_id[l];
      this._players[id].action(msg[l], (reply) => {
        this._reply[id] = reply || {};
      });
    }
    this._event =
      type === "kaiju"
        ? {}
        : type === "jieju"
          ? { jieju: true }
          : JSON.parse(JSON.stringify(this._paipu.log.at(-1)?.at(-1) || {}));
  }
  qipai(shan) {
    shan = shan || new M.Shan(this._rule);
    if (PRESET_HANDS[this._preset]) {
      const target = parseTiles(PRESET_HANDS[this._preset]);
      for (const t of target) {
        const at = shan._pai.indexOf(t);
        if (at < 0) throw new Error("練習配牌が不正です");
        shan._pai.splice(at, 1);
      }
      shan._pai.push(...target.reverse());
      shan._baopai = [shan._pai[4]];
      shan._fubaopai = [shan._pai[9]];
      this._preset = "normal";
    }
    super.qipai(shan);
  }
  jieju() {
    super.jieju();
    // Core awards leftover deposits to first place; clear the settled display ledger.
    this.model.lizhibang = 0;
  }
}

// Preserve engine prototypes explicitly; never eval or deserialize arbitrary classes.
const b = new M.Board({ qijia: 0, player: [], title: "" });
b.qipai({
  zhuangfeng: 0,
  jushu: 0,
  changbang: 0,
  lizhibang: 0,
  baopai: "z1",
  defen: [25000, 25000, 25000, 25000],
  shoupai: ["", "", "", ""],
});
const TYPES = {
  TrainingGame,
  TrainingPlayer,
  Shoupai: M.Shoupai,
  He: M.He,
  Shan: M.Shan,
  Board: M.Board,
  PublicShan: b.shan.constructor,
};
const SKIP = new Set([
  "_callback",
  "_timeout_id",
  "_view",
  "_handler",
  "_stop",
]);
function encode(value) {
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(encode);
  const type = Object.keys(TYPES).find(
    (k) => Object.getPrototypeOf(value) === TYPES[k].prototype,
  );
  const obj = type ? { $type: type } : {};
  for (const [k, v] of Object.entries(value))
    if (!SKIP.has(k) && typeof v !== "function" && v !== undefined)
      obj[k] = encode(v);
  return obj;
}
function decode(value) {
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(decode);
  const obj =
    value.$type && TYPES[value.$type]
      ? Object.create(TYPES[value.$type].prototype)
      : {};
  for (const [k, v] of Object.entries(value))
    if (
      k !== "$type" &&
      k !== "__proto__" &&
      k !== "constructor" &&
      k !== "prototype"
    )
      obj[k] = decode(v);
  return obj;
}

// A save is user-supplied input. Validate both the live state and replay state
// before replacing the current match, including the boards used by the CPU.
function validateGame(game) {
  const four = (a, valid) =>
    Array.isArray(a) && a.length === 4 && a.every(valid);
  const integer = (n, min, max) =>
    Number.isInteger(n) && n >= min && n <= max;
  const tile = (p) => typeof p === "string" && !!M.Shoupai.valid_pai(p);
  const board = (m) => {
    if (
      !m ||
      !four(m.player, (p) => typeof p === "string") ||
      !four(m.defen, Number.isFinite) ||
      !four(m.player_id, (id) => integer(id, 0, 3)) ||
      new Set(m.player_id).size !== 4 ||
      !integer(m.lunban, -1, 3) ||
      !integer(m.zhuangfeng, 0, 3) ||
      !integer(m.jushu, 0, 15) ||
      !integer(m.changbang, 0, 10000) ||
      !integer(m.lizhibang, 0, 10000) ||
      !four(m.shoupai, (h) =>
        h instanceof M.Shoupai &&
        integer(h._bingpai?._, 0, 14) &&
        ["m", "p", "s", "z"].every((s) =>
          Array.isArray(h._bingpai?.[s]) &&
          h._bingpai[s].length === (s === "z" ? 8 : 10) &&
          h._bingpai[s].every((n) => integer(n, 0, 4)),
        ) &&
        Array.isArray(h._fulou) &&
        h._fulou.every((meld) => typeof meld === "string" && M.Shoupai.valid_mianzi(meld)),
      ) ||
      !four(m.he, (h) => h instanceof M.He && Array.isArray(h._pai) &&
        h._pai.every(tile) && h._find && typeof h._find === "object") ||
      !m.shan || !integer(m.shan.paishu, 0, 122) ||
      !Array.isArray(m.shan.baopai) || !m.shan.baopai.every(tile)
    ) throw new Error("保存データが不完全です");
  };
  if (
    !(game instanceof TrainingGame) ||
    !["qipai", "zimo", "dapai", "fulou", "gang", "gangzimo", "hule", "pingju", "jieju"].includes(game._status) ||
    !Array.isArray(game._reply) || !Array.isArray(game._paipu?.log) ||
    !game._rule || typeof game._rule !== "object" ||
    !four(game._players, (p) => p instanceof TrainingPlayer &&
      p.model instanceof M.Board && integer(p._menfeng, 0, 3))
  ) throw new Error("保存データが不完全です");
  board(game.model);
  for (const player of game._players) board(player.model);
  if (!(game.model.shan instanceof M.Shan) ||
      !Array.isArray(game.model.shan._pai) || !game.model.shan._pai.every(tile))
    throw new Error("山の保存データが不完全です");
  if (game._status === "hule") {
    const h = game._event?.hule;
    if (!h || typeof h.shoupai !== "string" || !Number.isFinite(h.defen) ||
        !integer(h.l, 0, 3) || !four(h.fenpei, Number.isFinite) ||
        !Array.isArray(h.hupai) || !h.hupai.every((x) => typeof x.name === "string"))
      throw new Error("和了の保存データが不完全です");
  }
  if (game._status === "pingju" &&
      (!game._event?.pingju || !four(game._event.pingju.fenpei, Number.isFinite)))
    throw new Error("流局の保存データが不完全です");
}

export class Session {
  constructor(settings = { ...DEFAULT_SETTINGS }, preset = "normal") {
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
    this.history = [];
    this.reviews = [];
    this.assisted = false;
    this.game = new TrainingGame(this.settings, preset);
    this.game.kaiju(0);
    this.game.reply_kaiju();
    this.initial = this.snapshot();
    this.game.reply_qipai();
  }
  get me() {
    return this.game._players[0];
  }
  get seat() {
    return this.game.model.player_id.indexOf(0);
  }
  get finished() {
    return this.game._status === "jieju";
  }
  get roundEnd() {
    return ["hule", "pingju", "jieju"].includes(this.game._status);
  }
  snapshot() {
    return encode(this.game);
  }
  restore(snapshot) {
    this.game = decode(snapshot);
    this.game._callback = EMPTY;
    this.game._sync = true;
    this.updateSettings({});
  }
  save() {
    return JSON.stringify({
      version: 1,
      game: this.snapshot(),
      initial: this.initial,
      settings: this.settings,
      reviews: this.reviews.slice(-60),
      assisted: this.assisted,
    });
  }
  static load(text) {
    const s = JSON.parse(text);
    if (s.version !== 1 || s.game?.$type !== "TrainingGame" || !s.initial)
      throw new Error("保存形式が異なります");
    const session = Object.create(Session.prototype);
    session.settings = { ...DEFAULT_SETTINGS, ...s.settings };
    if (
      ![1, 2, 3, 4, 5].includes(session.settings.level) ||
      !["ask", "always", "off"].includes(session.settings.hints) ||
      ![250, 850, 1500].includes(session.settings.speed) ||
      ![1, 2].includes(session.settings.length) ||
      typeof session.settings.reveal !== "boolean" ||
      typeof session.settings.wall !== "boolean"
    ) throw new Error("保存された設定が不正です");
    session.history = [];
    session.reviews = s.reviews || [];
    session.assisted = !!s.assisted;
    session.initial = s.initial;
    try {
      validateGame(decode(s.game));
      const initial = decode(s.initial);
      validateGame(initial);
      if (initial._status !== "qipai" || !Array.isArray(session.reviews) ||
          !session.reviews.every((r) => r && typeof r.pick === "string" &&
            M.Shoupai.valid_pai(r.pick) && typeof r.best === "string" &&
            M.Shoupai.valid_pai(r.best) && Number.isFinite(r.shanten)))
        throw new Error("保存データが不完全です");
      session.restore(s.game);
      session.actions();
      session.status();
      session.prompt();
      candidates(session.me);
    } catch {
      throw new Error("保存データが不完全です。元の対局ファイルを選んでください。");
    }
    return session;
  }
  updateSettings(settings) {
    this.settings = { ...this.settings, ...settings };
    const g = this.game;
    for (let id = 1; id < 4; id++) {
      const player = g._players[id];
      if (player.level === this.settings.level) continue;
      player.level = this.settings.level;
      // Replies are already queued when a snapshot is taken. Reconsider only
      // decisions, never replay the event that updated the player's board.
      // Keep wins: Player.dapai marks temporary furiten after choosing a reply.
      if (g._reply[id]?.hule) continue;
      const callback = player._callback;
      player._callback = (reply) => { g._reply[id] = reply || {}; };
      try {
        const l = g.model.lunban;
        if (g._status === "zimo" || g._status === "gangzimo")
          player.action_zimo({ l }, g._status === "gangzimo");
        else if (g._status === "dapai")
          player.action_dapai({ l, p: g._dapai });
        else if (g._status === "fulou")
          player.action_fulou(g._event.fulou);
      } finally {
        player._callback = callback;
      }
    }
  }
  actions() {
    const g = this.game,
      m = g.model,
      l = this.seat,
      s = g._status,
      own = m.lunban === l;
    const a = [];
    if (
      (s === "zimo" || s === "gangzimo" || (s === "fulou" && !g._gang)) &&
      own
    ) {
      if (s !== "fulou" && g.allow_hule())
        a.push({ kind: "win", label: "ツモであがる", reply: { hule: "-" } });
      if (s !== "fulou")
        for (const k of g.get_gang_mianzi())
          a.push({
            kind: "kan",
            label: `カン ${parseTiles(k).map(tileName).join(" ")}`,
            meld: k,
            reply: { gang: k },
          });
      for (const p of g.get_dapai()) {
        a.push({
          kind: "discard",
          tile: p,
          label: `${tileName(p)}を捨てる`,
          reply: { dapai: p },
        });
        if (s !== "fulou" && g.allow_lizhi(p))
          a.push({
            kind: "riichi",
            tile: p,
            label: `${tileName(p)}でリーチ`,
            reply: { dapai: p + "*" },
          });
      }
      if (s !== "fulou" && g.allow_pingju())
        a.push({
          kind: "draw",
          label: "九種九牌で流局",
          reply: { daopai: "-" },
        });
    } else if ((s === "dapai" || s === "gang") && !own) {
      if (g.allow_hule(l))
        a.push({ kind: "win", label: "ロンであがる", reply: { hule: "-" } });
      if (s === "dapai")
        for (const meld of [
          ...g.get_peng_mianzi(l),
          ...g.get_chi_mianzi(l),
          ...g.get_gang_mianzi(l),
        ])
          a.push({
            kind: "call",
            label: `${meldName(meld)} ${parseTiles(meld).map(tileName).join(" ")}`,
            meld,
            reply: { fulou: meld },
          });
      if (a.length) a.push({ kind: "pass", label: "見送る", reply: {} });
    }
    return a;
  }
  step(action) {
    if (this.finished) return;
    const g = this.game,
      legal = this.actions();
    if (
      action &&
      !legal.some(
        (a) => JSON.stringify(a.reply) === JSON.stringify(action.reply),
      )
    )
      throw new Error("今はその操作を選べません");
    this.history.push({
      game: this.snapshot(),
      initial: this.initial,
      reviews: this.reviews.slice(),
    });
    if (this.history.length > 24) this.history.shift();
    if (action) {
      if (action.kind === "discard" || action.kind === "riichi") {
        const best = candidates(this.me)[0],
          pick = action.tile;
        this.reviews.push({
          round: `${WINDS[g.model.zhuangfeng]}${g.model.jushu + 1}局`,
          pick,
          best: best?.p,
          remaining: best?.remaining,
          shanten: best?.shanten,
        });
      }
      g._reply[0] = action.reply;
    }
    const methods = {
      kaiju: "reply_kaiju",
      qipai: "reply_qipai",
      zimo: "reply_zimo",
      gangzimo: "reply_zimo",
      dapai: "reply_dapai",
      fulou: "reply_fulou",
      gang: "reply_gang",
      hule: "reply_hule",
      pingju: "reply_pingju",
    };
    g[methods[g._status]]();
    if (g._status === "qipai") {
      this.initial = this.snapshot();
      this.reviews = [];
    }
  }
  undo() {
    const s = this.history.pop();
    if (!s) return false;
    this.restore(s.game);
    this.initial = s.initial;
    this.reviews = s.reviews;
    this.assisted = true;
    return true;
  }
  replay() {
    this.restore(this.initial);
    this.history = [];
    this.reviews = [];
    this.assisted = true;
    this.step();
  }
  prompt() {
    return makePrompt(this.me, this.actions(), this.status());
  }
  status() {
    const g = this.game,
      m = g.model,
      id = m.player_id[m.lunban],
      name = m.player[id];
    if (g._status === "jieju") return "対局終了";
    if (g._status === "hule")
      return `${m.player[m.player_id[g._event.hule.l]]}が${g._event.hule.baojia == null ? "ツモ" : "ロン"}であがりました`;
    if (g._status === "pingju")
      return `流局 — ${g._event.pingju.name === "荒牌平局" ? "山の牌がなくなりました" : g._event.pingju.name}`;
    if (g._status === "qipai") return "新しい局が始まります";
    if (g._status === "dapai")
      return `${name}が${tileName(g._dapai)}を捨てました${g._dapai.includes("*") ? "・リーチ！" : ""}`;
    if (g._status === "gang") return `${name}がカンしました`;
    if (g._status === "fulou")
      return `${name}が${meldName(g._event.fulou.m)}しました`;
    return id === 0
      ? "あなたの番です。捨てる牌を選んでください。"
      : `${name}の番です`;
  }
  whyNoWin() {
    const sh = this.me.shoupai,
      x = M.Util.xiangting(sh);
    if (this.actions().some((a) => a.kind === "win"))
      return "あがれます。「あがる」ボタンを選んでください。";
    if (!sh._zimo && x === 0) {
      const waits = M.Util.tingpai(sh);
      if (waits.some((p) => this.me.he.find(p)))
        return "自分の捨て牌に待ち牌があるためフリテンです。どの待ち牌でもロンできません。役があればツモではあがれます。";
      return "テンパイしています。待ち牌が出るか、自分で引く必要があります。役とフリテンの条件も満たす必要があります。";
    }
    if (x < 0)
      return "手の形は完成していますが、あがるための役がありません。ドラだけではあがれません。";
    return `手の形がまだ完成していません。基本は3枚の組を4つと同じ牌2枚を1組です。テンパイまでの目安は${Math.max(0, x)}段階です。`;
  }
}

export { M };
