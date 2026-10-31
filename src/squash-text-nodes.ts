import { wrapAnsi } from "#/ansi/wrap.ts";
import { type DOMElement } from "#/dom.ts";
import { sanitizeAnsi } from "#/sanitize-ansi.ts";

// Squashing text nodes combines the host text nodes into one compatibility run.
//
// Also, this is necessary for libraries like ink-link (https://github.com/sindresorhus/ink-link),
// which need to wrap all children at once, instead of wrapping 3 text nodes separately.
export const squashTextNodes = (node: DOMElement): string => {
  let text = "";

  for (const childNode of node.childNodes) {
    let nodeText = "";

    if (childNode.nodeName === "#text") {
      nodeText = childNode.nodeValue;
    } else {
      if (childNode.isHidden) {
        continue;
      }

      if (childNode.nodeName === "ink-text" || childNode.nodeName === "ink-virtual-text") {
        nodeText = squashTextNodes(childNode);
      }

      // Nested compatibility transforms must run before the enclosing transform,
      // once per explicit line with that line's index.
      const transform = childNode.internal_transform;
      if (nodeText.length > 0 && typeof transform === "function") {
        nodeText = nodeText
          .split("\n")
          .map((line, lineIndex) => transform(line, lineIndex))
          .join("\n");
      }
    }

    text += nodeText;
  }

  text = sanitizeAnsi(text);

  // Width measurement only understands the ESC forms of these C1 controls.
  text = text
    .replaceAll("\u009B", "\u001B[")
    .replaceAll("\u009D", "\u001B]")
    .replaceAll("\u009C", "\u001B\\");

  // Expand tabs after combining nested text so measurement and rendering use the same columns.
  if (node.nodeName === "ink-text" && text.includes("\t")) {
    text = wrapAnsi(text, Number.POSITIVE_INFINITY, { trim: false });
  }

  return text;
};
