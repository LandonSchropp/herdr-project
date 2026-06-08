import { useStore } from "../state/store.tsx";
import { Project } from "./project.tsx";
import { Box } from "ink";

/**
 * Middle of the TUI. Fills the space between the header and footer, clips its content to that
 * height, and scrolls to keep the selected session in view.
 */
export function ProjectList() {
  const { projects, leftMargin, rightMargin, scrollOffset } = useStore();

  return (
    <Box
      flexGrow={1}
      flexDirection="column"
      overflow="hidden"
      paddingLeft={leftMargin}
      paddingRight={rightMargin}
    >
      <Box flexDirection="column" flexShrink={0} marginTop={-scrollOffset}>
        {projects.map((project) => (
          <Project key={project.project} project={project} />
        ))}
      </Box>
    </Box>
  );
}
