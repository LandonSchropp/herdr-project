import type { Project } from "../../types.ts";
import { chunk } from "../../utilities/chunk.ts";
import { computeScrollOffset } from "./compute-scroll-offset.ts";
import {
  FOOTER_HEIGHT,
  HEADER_HEIGHT,
  PROJECT_HEADER_HEIGHT,
  SCROLL_MARGIN,
  SESSION_ROW_HEIGHT,
} from "./constants.ts";

/**
 * The top of the row holding the selected session, in rows from the top of the content.
 *
 * @param projects The projects rendered in the list, in display order.
 * @param selectedSessionId The id of the selected session, or `null` when none is selected.
 * @param numberOfColumns The number of session cards that fit in a row.
 * @returns The selected row's top offset in rows, or `null` when nothing is selected.
 */
function selectedRowTop(
  projects: Project[],
  selectedSessionId: string | null,
  numberOfColumns: number,
): number | null {
  let top = 0;

  for (const project of projects) {
    top += PROJECT_HEADER_HEIGHT;

    for (const row of chunk(project.sessions, numberOfColumns)) {
      if (row.some((session) => session.id === selectedSessionId)) {
        return top;
      }

      top += SESSION_ROW_HEIGHT;
    }
  }

  return null;
}

/**
 * The total height of every project's blocks, in rows.
 *
 * @param projects The projects rendered in the list.
 * @param numberOfColumns The number of session cards that fit in a row.
 * @returns The total content height in rows.
 */
function contentHeight(projects: Project[], numberOfColumns: number): number {
  return projects.reduce(
    (height, project) =>
      height +
      PROJECT_HEADER_HEIGHT +
      chunk(project.sessions, numberOfColumns).length * SESSION_ROW_HEIGHT,
    0,
  );
}

/**
 * Computes the scroll offset that keeps the selected session's row visible, using sticky
 * edge-triggered scrolling (see `computeScrollOffset`). The viewport is the window minus the header
 * and footer that frame the project list. Returns the current offset unchanged when nothing is
 * selected.
 *
 * @param projects The projects rendered in the list, in display order.
 * @param selectedSessionId The id of the selected session, or `null` when none is selected.
 * @param numberOfColumns The number of session cards that fit in a row.
 * @param currentOffset The viewport's current scroll offset, in rows from the top of the content.
 * @param windowHeight The height of the terminal window, in rows.
 * @returns The scroll offset to apply, in rows from the top of the content.
 */
export function scrollOffsetForSelection(
  projects: Project[],
  selectedSessionId: string | null,
  numberOfColumns: number,
  currentOffset: number,
  windowHeight: number,
): number {
  const top = selectedRowTop(projects, selectedSessionId, numberOfColumns);

  if (top === null) {
    return currentOffset;
  }

  const viewportHeight = Math.max(0, windowHeight - HEADER_HEIGHT - FOOTER_HEIGHT);
  const offset = computeScrollOffset(
    currentOffset,
    top,
    SESSION_ROW_HEIGHT,
    viewportHeight,
    SCROLL_MARGIN,
  );

  return Math.min(offset, Math.max(0, contentHeight(projects, numberOfColumns) - viewportHeight));
}
