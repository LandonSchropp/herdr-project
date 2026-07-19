/**
 * A project that can be opened in Herdr. Projects are declared as TOML files, each naming the
 * project and the Git repository it lives in.
 */
export type Project = {
  /** The project's display name. */
  name: string;
  /** The absolute path to the project's main Git repository. */
  repositoryRoot: string;
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
