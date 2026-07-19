#!/usr/bin/env bun

import { App } from "./tui/app.tsx";
import { render } from "ink";

const { waitUntilExit } = render(<App />);
await waitUntilExit();
