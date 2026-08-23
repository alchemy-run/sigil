// Standalone OSC 8 hyperlink builder with fallback — the string counterpart
// to the <Hyperlink> component, for use outside the React renderer.
import { link } from "#/ansi/escapes.ts";
import { detectHyperlinkSupport } from "#/capabilities/detect.ts";

type HyperlinkOptions = {
  /**
	When the terminal does not support OSC 8 hyperlinks, append the URL in
	parentheses after the text so it stays reachable. Set to `false` to
	return the text alone.

	@default true
	*/
  fallback?: boolean;

  /**
	The stream the text will be written to, for support detection.

	@default process.stdout
	*/
  stream?: { isTTY?: boolean };
};

/**
Wraps text in a clickable OSC 8 hyperlink when the terminal supports it,
falling back to `text (url)`.

```ts
import { hyperlink } from "@alchemy.run/sigil/ansi";

console.log(hyperlink("Documentation", "https://example.com"));
```
*/
export const hyperlink = (
  text: string,
  url: string,
  { fallback = true, stream = process.stdout }: HyperlinkOptions = {},
): string => {
  if (detectHyperlinkSupport(stream)) {
    return link(text, url);
  }

  return fallback ? `${text} (${url})` : text;
};
