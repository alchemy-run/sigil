/** @jsxImportSource react */
import { Box, type BoxProps } from "#/index.ts";

<Box minWidth={5} maxWidth={10} />;
<Box minWidth={undefined} maxWidth={undefined} />;
<Box width="50%" height="50%" minHeight="25%" maxHeight="75%" />;
// Percentages resolve against the parent (sigil fixes yoga#872).
<Box minWidth="50%" maxWidth="75%" />;

const percentages: BoxProps = { minWidth: "50%", maxWidth: "75%" };

export { percentages };
