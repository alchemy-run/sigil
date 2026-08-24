import { type ReactNode, type Key, type Ref } from "react";

import { type DOMElement } from "#/dom.ts";
import type { SemanticTextStyle } from "#/semantic-text-style.ts";
import { type Styles } from "#/styles.ts";

declare module "react" {
  namespace JSX {
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
    interface IntrinsicElements {
      "ink-box": Ink.Box;
      "ink-text": Ink.Text;
    }
  }
}

declare namespace Ink {
  type Box = {
    internal_static?: boolean;
    children?: ReactNode;
    key?: Key;
    ref?: Ref<DOMElement>;
    style?: Omit<Styles, "textWrap">;
    internal_accessibility?: DOMElement["internal_accessibility"];
  };

  type Text = {
    children?: ReactNode;
    key?: Key;
    style?: Styles;

    // eslint-disable-next-line @typescript-eslint/naming-convention
    internal_ansi?: boolean;
    internal_transform?: (children: string, index: number) => string;
    internal_textStyle?: SemanticTextStyle;
    internal_accessibility?: DOMElement["internal_accessibility"];
  };
}
