import { tileFile, tileName } from "../game/tiles.js";
export default function Tile({
  p,
  small = false,
  selected = false,
  onClick,
  disabled = false,
  label,
  className = "",
}) {
  const props = {
    className: `tile ${small ? "tile-small" : ""} ${selected ? "selected" : ""} ${className}`,
    title: tileName(p),
  };
  const src =
    globalThis.__MAHJONG_ASSETS?.[tileFile(p)] ||
    `${import.meta.env.BASE_URL}tiles/${tileFile(p)}.svg`;
  const picture = (
    <img src={src} alt={onClick ? "" : tileName(p)} draggable="false" />
  );
  return onClick ? (
    <button
      {...props}
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label || `${tileName(p)}を選ぶ`}
      aria-pressed={selected}
    >
      {picture}
    </button>
  ) : (
    <span {...props}>{picture}</span>
  );
}
