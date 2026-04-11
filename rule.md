# 🏗️ ProductScope Phase Isolation Rules

The main architectural philosophy of this project is **Zero Cross-Phase Dependencies**. This ensures that multiple developers can work simultaneously without encountering ANY merge conflicts.

## 🚫 1. Strict Phase Isolation
- **Edit within your folder**: If you are working on Phase 3, you **must only** make edits to files under `phases/phase3/`.
- **No Cross-Referencing**: `phase3.js` MUST NOT import `phase2.js` or `phase4.html`. 
- **Duplication is better than Dependency**: If multiple phases need the same utility function or CSS styling *and it's not in the global components logic*, **COPY IT** into your phase. Do not link a phase to another phase's `.css` or `.js` file. A phase should never break if another phase directory is deleted.

## 🌍 2. Global State & Dependencies
- **Shared State**: All data moving between phases must use `core/state.js`.
- **Modifying Core / Global Files**: You are allowed to edit `core/router.js`, `core/ai.js`, `core/state.js`, or `assets/css/global.css`, **BUT** you must add a clear comment marking which phase relies on this change. 
  
  **Rule Example:**
  ```javascript
  // [PHASE 3] Adds delay function for crawling simulated feedback
  export function delayContext() { ... }
  ```
  ```css
  /* [PHASE 5/7] Global charting library overrides */
  .chart-generic-grid { ... }
  ```

## 🛠️ 3. Assets & Styles
- **Phase UI**: Phase-specific layouts (`.persona-grid`, `.matrix-table`) strictly belong in `phase[X].css`.
- **Global Components**: Buttons (`.btn`), inputs (`input[type=text]`), and badges (`.badge`) should rely on `assets/css/components.css`.

## 🤖 4. AI Tooling
- **Never Call API Directly in Phase files**.
- Send prompts through `callLLM()` imported from `core/ai.js`.
