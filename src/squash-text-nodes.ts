import { type DOMElement } from "#/dom.ts";
import { sanitizeAnsi } from "#/sanitize-ansi.ts";

// Squashing text nodes combines the host text nodes into one compatibility run.
//
// Also, this is necessary for libraries like ink-link (https://github.com/sindresorhus/ink-link),
// which need to wrap all children at once, instead of wrapping 3 text nodes separately.
export const squashTextNodes = (node: DOMElement): string => {
  let text = "";

  for (let index = 0; index < node.childNodes.length; index++) {
    const childNode = node.childNodes[index];

    if (childNode === undefined) {
      continue;
    }

    let nodeText = "";

    if (childNode.nodeName === "#text") {
      nodeText = childNode.nodeValue;
    } else {
      if (childNode.nodeName === "ink-text" || childNode.nodeName === "ink-virtual-text") {
        nodeText = squashTextNodes(childNode);
      }

      // Nested compatibility transforms must run before the enclosing transform.
      if (nodeText.length > 0 && typeof childNode.internal_transform === "function") {
        nodeText = childNode.internal_transform(nodeText, index);
      }
    }

    text += nodeText;
  }

  return sanitizeAnsi(text);
};
