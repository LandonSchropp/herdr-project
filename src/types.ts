/** A tab to open in a project's workspace. */
export type Tab = {
  /** The tab's label. */
  name: string;
  /** The command to run in the tab, or `null` to leave a plain shell. */
  command: string | null;
};

/**
 * A project that can be opened in Herdr. Projects are either declared in the settings file or
 * discovered as Git repositories under the configured project paths.
 */
export type Project = {
  /** The project's display name. */
  name: string;
  /** The absolute path to the project's main Git repository. */
  repositoryRoot: string;
  /** The tabs to open in the project's workspace. */
  tabs: Tab[];
};

/** A Git worktree belonging to a project's repository. */
export type Worktree = {
  /** The branch checked out in the worktree. */
  branch: string;
  /** The absolute path to the worktree's checkout. */
  path: string;
  /**
   * Whether this is the repository's main checkout rather than a linked worktree. Exactly one
   * worktree in a repository is the main one.
   */
  isMain: boolean;
};

/** The Herdr workspace a worktree was opened into, and the tab and pane Herdr created with it. */
export type Workspace = {
  /** The workspace's id. */
  workspaceId: string;
  /** The id of the tab Herdr created with the workspace. */
  rootTabId: string;
  /** The id of the pane Herdr created with the workspace. */
  rootPaneId: string;
};

/** The plugin's settings. */
export type Settings = {
  /**
   * Globs scanned for Git repositories. Each match becomes a project named after its directory,
   * using {@link Settings.defaultTabs}.
   */
  projectPaths: string[];
  /** The tabs used by discovered projects and by any declared project that omits its own. */
  defaultTabs: Tab[];
  /** Projects declared explicitly, which win over a discovered project at the same path. */
  projects: Project[];
};
