import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const data = (p, mime) =>
  `data:${mime};base64,${fs.readFileSync(path.join(root, p)).toString("base64")}`;
let html = read("docs/index.html");
html = html.replace(
  /<link\b[^>]*href="\.\/fonts\/font\.css"[^>]*>/,
  () => {
    let css = read("public/fonts/font.css");
    css = css.replace(
      /url\("\.\/([^\"]+)"\)/g,
      (_, file) => `url("${data("public/fonts/" + file, "font/woff2")}")`,
    );
    return `<style>${css}</style>`;
  },
);
html = html.replace(
  /<link rel="stylesheet"[^>]*href="\.\/([^\"]+)"[^>]*>/g,
  (_, file) => `<style>${read("docs/" + file)}</style>`,
);
const tiles = Object.fromEntries(
  fs
    .readdirSync(path.join(root, "public/tiles"))
    .filter((f) => f.endsWith(".svg"))
    .map((f) => [f.slice(0, -4), data("public/tiles/" + f, "image/svg+xml")]),
);
const notices = fs
  .readdirSync(path.join(root, "public/licenses"))
  .filter((f) => f.endsWith(".txt"))
  .map((f) => f + "\n\n" + read("public/licenses/" + f))
  .join("\n\n--------------------\n\n");
const noticeUrl =
  "data:text/plain;charset=utf-8;base64," +
  Buffer.from(notices).toString("base64");
html = html.replace(
  /<script type="module"[^>]*src="\.\/([^\"]+)"[^>]*><\/script>/,
  (_, file) => {
    const js = read("docs/" + file).replace(/<\/script/gi, "<\\/script");
    return `<script>globalThis.__MAHJONG_ASSETS=${JSON.stringify(tiles)};globalThis.__MAHJONG_NOTICE=${JSON.stringify(noticeUrl)};<\/script><script type="module">${js}<\/script>`;
  },
);
const output = path.join(root, "yukkuri-mahjong.html");
fs.writeFileSync(output, html);
console.log(`Created ${output} (${fs.statSync(output).size} bytes)`);
