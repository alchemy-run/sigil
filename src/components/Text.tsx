/** @jsxImportSource react */
import { useContext, type ReactNode } from "react";

import type { Paint } from "#/color/paint.ts";
import { accessibilityContext } from "#/components/AccessibilityContext.ts";
import { cellAttributes } from "#/screen/cell.ts";
import { parseSemanticColor } from "#/semantic-text-style.ts";
import { type Styles } from "#/styles.ts";

export type Props = {
  /**
	A label for the element for screen readers.
	*/
  readonly "aria-label"?: string;

  /**
	Hide the element from screen readers.
	*/
  readonly "aria-hidden"?: boolean;

  /**
	Change text color. Ink uses Chalk under the hood, so all its functionality is supported.
	*/
  readonly color?: Paint;

  /**
	Same as `color`, but for the background.
	*/
  readonly backgroundColor?: Paint;

  /**
	Dim the color (make it less bright).
	*/
  readonly dimColor?: boolean;

  /**
	Make the text bold.
	*/
  readonly bold?: boolean;

  /**
	Make the text italic.
	*/
  readonly italic?: boolean;

  /**
	Make the text underlined.
	*/
  readonly underline?: boolean;

  /**
	Make the text crossed out with a line.
	*/
  readonly strikethrough?: boolean;

  /**
	Inverse background and foreground colors.
	*/
  readonly inverse?: boolean;

  /**
	This property tells Ink to wrap or truncate text if its width is larger than the container. If `wrap` is passed (the default), Ink will wrap text and split it into multiple lines. If `hard` is passed, Ink will fill each line to the full column width, breaking words as necessary. If `truncate-*` is passed, Ink will truncate text instead, resulting in one line of text with the rest cut off. If `none` is passed, the text is neither wrapped nor truncated — it overflows the container (and the screen's nominal width), which is intended for log lines committed to scrollback (e.g. inside `<Static>`), not for live regions.
	*/
  readonly wrap?: Styles["textWrap"];

  readonly children?: ReactNode;
};

/**
This component can display text and change its style to make it bold, underlined, italic, or strikethrough.
*/
export function Text({
  color,
  backgroundColor,
  dimColor = false,
  bold = false,
  italic = false,
  underline = false,
  strikethrough = false,
  inverse = false,
  wrap = "wrap",
  children,
  "aria-label": ariaLabel,
  "aria-hidden": ariaHidden = false,
}: Props) {
  const { isScreenReaderEnabled } = useContext(accessibilityContext);
  const childrenOrAriaLabel = isScreenReaderEnabled && ariaLabel ? ariaLabel : children;

  if (childrenOrAriaLabel === undefined || childrenOrAriaLabel === null) {
    return null;
  }

  const foreground = typeof color === "object" ? color : parseSemanticColor(color);
  const background =
    typeof backgroundColor === "object" ? backgroundColor : parseSemanticColor(backgroundColor);
  const semanticStyle = {
    ...(foreground ? { foreground } : {}),
    ...(background ? { background } : {}),
    ...(color === "" ? { resetForeground: true } : {}),
    ...(backgroundColor === "" ? { resetBackground: true } : {}),
    ...(underline ? { underline: "single" as const } : {}),
    attributes:
      (dimColor ? cellAttributes.faint : 0) +
      (bold ? cellAttributes.bold : 0) +
      (italic ? cellAttributes.italic : 0) +
      (strikethrough ? cellAttributes.strikethrough : 0) +
      (inverse ? cellAttributes.inverse : 0),
  };

  if (isScreenReaderEnabled && ariaHidden) {
    return null;
  }

  return (
    <ink-text
      style={{ flexGrow: 0, flexShrink: 1, flexDirection: "row", textWrap: wrap }}
      internal_textStyle={semanticStyle}
    >
      {childrenOrAriaLabel}
    </ink-text>
  );
}
