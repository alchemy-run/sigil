/** @jsxImportSource react */
import { useContext, type PropsWithChildren, type Ref } from "react";

import { accessibilityContext } from "#/components/AccessibilityContext.ts";
import { type DOMElement } from "#/dom.ts";
import { type Styles } from "#/styles.ts";

export type Props = Omit<Styles, "textWrap"> & {
  /**
	A label for the element for screen readers.
	*/
  readonly "aria-label"?: string;

  /**
	Hide the element from screen readers.
	*/
  readonly "aria-hidden"?: boolean;

  /**
	The role of the element.
	*/
  readonly "aria-role"?:
    | "button"
    | "checkbox"
    | "combobox"
    | "list"
    | "listbox"
    | "listitem"
    | "menu"
    | "menuitem"
    | "option"
    | "progressbar"
    | "radio"
    | "radiogroup"
    | "tab"
    | "tablist"
    | "table"
    | "textbox"
    | "timer"
    | "toolbar";

  /**
	The state of the element.
	*/
  readonly "aria-state"?: {
    readonly busy?: boolean;
    readonly checked?: boolean;
    readonly disabled?: boolean;
    readonly expanded?: boolean;
    readonly multiline?: boolean;
    readonly multiselectable?: boolean;
    readonly readonly?: boolean;
    readonly required?: boolean;
    readonly selected?: boolean;
  };
};

/**
`<Box>` is an essential Ink component to build your layout. It's like `<div style="display: flex">` in the browser.
*/
export function Box({
  children,
  ref,
  backgroundColor,
  "aria-label": ariaLabel,
  "aria-hidden": ariaHidden,
  "aria-role": role,
  "aria-state": ariaState,
  ...style
}: PropsWithChildren<Props> & { readonly ref?: Ref<DOMElement> }) {
  const { isScreenReaderEnabled } = useContext(accessibilityContext);
  const label = ariaLabel ? <ink-text>{ariaLabel}</ink-text> : undefined;
  if (isScreenReaderEnabled && ariaHidden) {
    return null;
  }

  const boxElement = (
    <ink-box
      ref={ref}
      style={{
        flexWrap: "nowrap",
        flexDirection: "row",
        flexGrow: 0,
        flexShrink: 1,
        ...style,
        backgroundColor,
        overflowX: style.overflowX ?? style.overflow ?? "visible",
        overflowY: style.overflowY ?? style.overflow ?? "visible",
      }}
      internal_accessibility={{
        role,
        state: ariaState,
      }}
    >
      {isScreenReaderEnabled && label ? label : children}
    </ink-box>
  );

  return boxElement;
}
