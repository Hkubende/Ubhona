import type { PaperWidth } from "./models";

export function charsForPaperWidth(paperWidth: PaperWidth) {
  return paperWidth === "58mm" ? 32 : 42;
}

export function divider(width: number) {
  return "-".repeat(Math.max(8, width));
}

export function center(text: string, width: number) {
  const value = text.trim();
  if (!value) return "";
  if (value.length >= width) return value.slice(0, width);
  const left = Math.floor((width - value.length) / 2);
  return `${" ".repeat(left)}${value}`;
}

export function right(text: string, width: number) {
  const value = text.trim();
  if (value.length >= width) return value.slice(0, width);
  return `${" ".repeat(width - value.length)}${value}`;
}

export function money(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return `KSh ${Math.round(value).toLocaleString("en-KE")}`;
}

export function wrapText(text: string, width: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= width) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word.length > width ? word.slice(0, width) : word;
  }
  if (current) lines.push(current);
  return lines;
}

export function twoColumn(leftText: string, rightText: string, width: number) {
  const left = leftText.trim();
  const rightValue = rightText.trim();
  if (left.length + rightValue.length + 1 <= width) {
    return `${left}${" ".repeat(width - left.length - rightValue.length)}${rightValue}`;
  }
  const maxLeft = Math.max(1, width - rightValue.length - 1);
  const clippedLeft = left.slice(0, maxLeft);
  return `${clippedLeft}${" ".repeat(width - clippedLeft.length - rightValue.length)}${rightValue}`;
}
