# Third-party notices

This project contains code derived from or ported from the following projects.
Per-file headers (`// Derived from …` / `// Ported from …`) identify the
specific origin of each file.

## Ink

The core of this project is a fork of [Ink](https://github.com/vadimdemedes/ink).
Copyright (c) Vadym Demedes. See the root `LICENSE` file.

## Yoga

The layout engine (`src/yoga/`) is a TypeScript port of
[Yoga](https://github.com/facebook/yoga), and `patches/yoga-f64.patch` modifies
Yoga sources.

MIT License

Copyright (c) Facebook, Inc. and its affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Packages by Sindre Sorhus (MIT)

Portions of `src/ansi/` and `src/` are derived from the following packages:
`ansi-escapes`, `ansi-styles`, `chalk`, `cli-boxes`,
`cli-cursor`, `cli-truncate`, `get-east-asian-width`,
`is-fullwidth-code-point`, `quick-lru`, `restore-cursor`,
`slice-ansi`, `terminal-size`, `type-fest`, `wrap-ansi`.

MIT License

Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)

Licensed under the MIT License (text above).

## supports-color (MIT)

`src/ansi/supports-color.ts` is derived from `supports-color`.

Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)
and Josh Junon.

Licensed under the MIT License (text above).

## color-convert (MIT)

The color-space conversions in `src/ansi/sgr.ts` originate from
`color-convert`, via `ansi-styles`.

Copyright (c) 2011-2016 Heather Arthur and Josh Junon.

Licensed under the MIT License (text above).

## Packages by Vadym Demedes (MIT)

`src/patch-console.ts` and `src/code-excerpt.ts` are derived from
`patch-console`, `code-excerpt`, and `convert-to-spaces`.

Copyright (c) Vadym Demedes <vadimdemedes@hey.com> (https://github.com/vadimdemedes)

Licensed under the MIT License (text above).

## @alcalzone/ansi-tokenize (MIT)

`src/ansi/tokenize.ts` is ported from `@alcalzone/ansi-tokenize`.

Copyright (c) 2023 AlCalzone (Dominic Griesel)

Licensed under the MIT License (text above).

## stack-utils (MIT)

`src/parse-stack-line.ts` is derived from `stack-utils`.

Copyright (c) 2016-2022 Isaac Z. Schlueter <i@izs.me>, James Talmage
<james@talmage.io> (github.com/jamestalmage), and Contributors.

Licensed under the MIT License (text above).

## fast-string-truncated-width (MIT)

`src/ansi/string-width.ts` is derived from `fast-string-truncated-width`.

The MIT License (MIT)

Copyright (c) 2024-present Fabio Spampinato

Licensed under the MIT License (text above).

## es-toolkit (MIT)

`src/throttle.ts` is derived from `throttle` in `es-toolkit/compat`.

Copyright (c) 2024 Viva Republica, Inc.

Licensed under the MIT License (text above).

## enquirer (MIT)

`src/parse-keypress.ts` is derived from `enquirer`'s `lib/keypress.js`.

Copyright (c) 2016-present, Jon Schlinkert and Contributors.

Licensed under the MIT License (text above).

## signal-exit (ISC)

`src/signal-exit.ts` is a minimal reimplementation of `signal-exit`'s
behavior.

Copyright (c) 2015-2023 Benjamin Coe, Isaac Z. Schlueter, and Contributors

ISC License

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
