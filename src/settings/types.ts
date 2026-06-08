import type { settingsSchema } from "./schema.ts";
import type { z } from "zod";

/** Orc's validated settings. */
export type Settings = z.infer<typeof settingsSchema>;
