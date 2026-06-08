import { expandHome } from "../utilities/directory.ts";
import { z } from "zod";

/** The schema for orc's settings file. */
export const settingsSchema = z.object({
  /**
   * Globs matching the repositories to offer as non-tmuxinator projects (e.g. `~/Development/*`). A
   * leading `~/` is expanded to home.
   */
  projectPaths: z.array(z.string().transform(expandHome)).default([]),
});
