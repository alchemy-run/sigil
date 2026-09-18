/** @jsxImportSource @alchemy.run/sigil */
import { Text } from "@alchemy.run/sigil";
import { useState } from "@alchemy.run/sigil/react";

function Status() {
  const [label] = useState("Planning stack");
  return <Text>{label}</Text>;
}

export const make = () => <Status />;
