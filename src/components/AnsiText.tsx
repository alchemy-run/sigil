/** @jsxImportSource react */
import { useContext } from "react";

import { stripAnsi } from "#/ansi/strip.ts";
import { accessibilityContext } from "#/components/AccessibilityContext.ts";
import { Text } from "#/components/Text.tsx";
import type { Styles } from "#/styles.ts";

export type Props = {
  /** External text containing ANSI SGR styling or OSC 8 hyperlinks. */
  readonly children: string;
  readonly wrap?: Styles["textWrap"];
  readonly "aria-label"?: string;
  readonly "aria-hidden"?: boolean;
};

/**
 * Renders explicitly trusted ANSI-styled output as structured terminal cells.
 * Ordinary `Text` continues to strip terminal control sequences.
 */
export function AnsiText({
  children,
  wrap = "wrap",
  "aria-label": ariaLabel,
  "aria-hidden": ariaHidden = false,
}: Props) {
  const { isScreenReaderEnabled } = useContext(accessibilityContext);

  if (isScreenReaderEnabled) {
    if (ariaHidden) return null;
    return <Text>{ariaLabel ?? stripAnsi(children)}</Text>;
  }

  return (
    <ink-text
      style={{ flexGrow: 0, flexShrink: 1, flexDirection: "row", textWrap: wrap }}
      internal_ansi
    >
      {children}
    </ink-text>
  );
}
