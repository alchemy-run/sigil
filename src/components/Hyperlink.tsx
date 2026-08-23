/** @jsxImportSource react */
import { type ReactNode } from "react";

import { link } from "#/ansi/escapes.ts";
import { createSupportsHyperlinks } from "#/ansi/supports-hyperlinks.ts";
import { Text, type Props as TextProps } from "#/components/Text.tsx";
import { Transform } from "#/components/Transform.tsx";
import { useStdout } from "#/hooks/use-stdout.ts";

export type Props = Omit<TextProps, "children"> & {
  /**
	The URL the hyperlink points to.
	*/
  readonly url: string;

  /**
	When the terminal does not support OSC 8 hyperlinks, append the URL in
	parentheses after the text so it stays reachable. Set to `false` to render
	the text alone.

	@default true
	*/
  readonly fallback?: boolean;

  readonly children?: ReactNode;
};

/**
A clickable OSC 8 hyperlink — the counterpart to the router's `<Link>`, which
navigates between screens. On terminals without hyperlink support it falls
back to `text (url)`.

```tsx
<Hyperlink url="https://example.com">Documentation</Hyperlink>
```
*/
export function Hyperlink({ url, fallback = true, children, ...textProps }: Props) {
  const { stdout } = useStdout();

  if (!createSupportsHyperlinks(stdout)) {
    return (
      <Text {...textProps}>
        {children}
        {fallback ? <Text dimColor> ({url})</Text> : null}
      </Text>
    );
  }

  // OSC 8 sequences are zero-width, so wrapping after layout is safe. The
  // transform runs per output line, giving every line its own complete pair.
  return (
    <Transform transform={(text) => link(text, url)}>
      <Text {...textProps}>{children}</Text>
    </Transform>
  );
}
