/**
 * Light formatting of AI chat replies: paragraphs (blank line), lists
 * ("1. ", "- ") and **bold**. Parsed into plain data and rendered as React
 * elements - no HTML from the model ever reaches the page.
 */

export type ChatSpan = { text: string; bold: boolean };
export type ChatLine = ChatSpan[];
export type ChatBlock =
  | { kind: "p"; lines: ChatLine[] }
  | { kind: "ul"; items: ChatLine[] }
  | { kind: "ol"; start: number; items: ChatLine[] };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*(\d{1,2})[.)]\s+(.*)$/;
/** "... 2. Nowy temat" inside one line - a list the model did not break. */
const INLINE_ITEM = /\s(?=\d{1,2}\.\s+\p{Lu})/u;

export function parseInline(text: string): ChatLine {
  const spans: ChatLine = [];
  const pattern = /\*\*(.+?)\*\*/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) {
      spans.push({ text: text.slice(last, match.index), bold: false });
    }
    spans.push({ text: match[1], bold: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) spans.push({ text: text.slice(last), bold: false });
  // Unpaired ** left over - drop the markers, keep the words.
  return spans.map((span) => ({
    ...span,
    text: span.text.replace(/\*\*/g, ""),
  }));
}

/** Splits "Tematy: 1. A 2. B 3. C" into separate lines (only 2+ items). */
function splitInlineList(line: string): string[] {
  if (!/(^|\s)1\.\s/.test(line)) return [line];
  const parts = line.split(INLINE_ITEM);
  const items = parts.filter((part) => NUMBERED.test(part));
  return items.length >= 2 ? parts.map((part) => part.trim()) : [line];
}

export function parseChatText(text: string): ChatBlock[] {
  const blocks: ChatBlock[] = [];
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .flatMap(splitInlineList);

  // A blank line ends a paragraph; list items stay one list across blank lines.
  let paragraphBreak = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    const current = blocks[blocks.length - 1];
    if (!line.trim()) {
      paragraphBreak = true;
      continue;
    }
    const broken = paragraphBreak;
    paragraphBreak = false;
    const bullet = BULLET.exec(line);
    if (bullet) {
      if (current?.kind === "ul") current.items.push(parseInline(bullet[1]));
      else blocks.push({ kind: "ul", items: [parseInline(bullet[1])] });
      continue;
    }
    const numbered = NUMBERED.exec(line);
    if (numbered) {
      if (current?.kind === "ol") current.items.push(parseInline(numbered[2]));
      else {
        blocks.push({
          kind: "ol",
          start: Number(numbered[1]),
          items: [parseInline(numbered[2])],
        });
      }
      continue;
    }
    if (current?.kind === "p" && !broken) {
      current.lines.push(parseInline(line.trim()));
    } else {
      blocks.push({ kind: "p", lines: [parseInline(line.trim())] });
    }
  }
  return blocks;
}
