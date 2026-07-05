import { crashLogPath } from "../../sessions/crash-log.ts";
import { Box, Text, useApp, useInput } from "ink";

type FatalErrorProps = {
  /** The thrown value that crashed the TUI. */
  error: unknown;
};

/** Full-window screen shown when the TUI crashes; press q or escape to quit. */
export function FatalError({ error }: FatalErrorProps) {
  const { exit } = useApp();

  useInput((input, key) => {
    if (input === "q" || key.escape) {
      exit();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="red">
        orc crashed
      </Text>

      <Box marginTop={1}>
        <Text>{Bun.inspect(error, { colors: true })}</Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Crash log: {crashLogPath()}</Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Press q or escape to quit.</Text>
      </Box>
    </Box>
  );
}
