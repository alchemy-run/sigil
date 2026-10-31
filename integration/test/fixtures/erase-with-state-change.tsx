import { Box, Text, render } from "@alchemy.run/sigil";
import { useEffect, useState } from "react";

function Erase() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false);
    });

    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <Box flexDirection="column">
      {show ? (
        <>
          <Text>A</Text>
          <Text>B</Text>
          <Text>C</Text>
        </>
      ) : null}
    </Box>
  );
}

process.stdout.rows = Number(process.argv[2]);
render(<Erase />);
