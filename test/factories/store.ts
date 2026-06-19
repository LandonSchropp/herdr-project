import type { useStoreReducer } from "../../src/tui/state/use-store-reducer.ts";
import { Factory } from "fishery";

type Store = ReturnType<typeof useStoreReducer>;

/** Builds a store value for stubbing `useStore` in component tests. */
export const storeFactory = Factory.define<Store>(() => ({
  projects: [],
  selectedSessionId: null,
  numberOfColumns: 3,
  leftMargin: 4,
  rightMargin: 4,
  windowHeight: 30,
  lastSelectedColumn: null,
  scrollOffset: 0,
  activeModal: null,
  setSessions: () => {},
  removeSession: () => {},
  setWindowSize: () => {},
  moveLeft: () => {},
  moveRight: () => {},
  moveUp: () => {},
  moveDown: () => {},
  confirmDelete: () => {},
  selectProject: () => {},
  promptForSession: () => {},
  cancel: () => {},
}));
