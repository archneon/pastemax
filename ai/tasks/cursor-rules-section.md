**Task Description for Cursor Agent**

**Goal:** Add a new logical section named "CURSOR_RULES" to the PasteMax application.

**Purpose:**
The application currently categorizes files based on predefined directory structures (like `ai/rules`, `ai/docs`, etc.) defined in `PROMPT_SECTIONS`. We need to add a _new_ category specifically for rule files used by Cursor, which reside in the `.cursor/rules` directory within user projects.

This involves:

1.  Defining a new CSS color variable for visual distinction in the UI.
2.  Updating the frontend configuration (`src/constants.ts`) to include the definition of the `CURSOR_RULES` section (its ID, name for markers, UI label, directory path, and color). This affects how files are displayed in the structured list and how the final prompt output is generated.
3.  Updating the backend configuration (`constants.js`) to ensure the Electron main process correctly identifies files in `.cursor/rules` during the initial scan and assigns the appropriate `sectionId`.

**Key Files to Modify:**

- `src/styles/index.css` (To add the new color)
- `src/constants.ts` (Frontend section definition)
- `constants.js` (Backend section definition)

---

**Step-by-Step Implementation Plan**

**Step 1: Define the New Color Variable in CSS**

- **File:** `src/styles/index.css`
- **Action:** Add a new CSS custom property for the green color in both the `:root` (light mode) and `.dark-mode` scopes.

```css
/* src/styles/index.css */

:root {
  --background-primary: #ffffff;
  --background-secondary: #f8f8f8;
  /* ... other existing colors ... */
  --accent-purple: #9b59b6;
  --primary-button-background: #000000;
  --primary-button-text: #ffffff;

  /* --- ADD THIS NEW COLOR --- */
  --accent-green: #27ae60; /* Green for Cursor Rules */
  /* --- END ADD --- */
}

.dark-mode {
  --background-primary: #1e1e1e;
  --background-secondary: #252526;
  /* ... other existing dark mode colors ... */
  --accent-purple: #bb86fc;
  --primary-button-background: #0e639c;
  --primary-button-text: #ffffff;

  /* --- ADD THIS NEW DARK MODE COLOR --- */
  --accent-green: #2ecc71; /* Lighter green for dark mode */
  /* --- END ADD --- */
}

/* ... rest of the CSS file ... */
```

**Step 2: Update Frontend Section Definitions**

- **File:** `src/constants.ts`
- **Action:** Add a new object representing the `CURSOR_RULES` section to the `PROMPT_SECTIONS` array. Place it logically, for example, directly after the existing `rules` section.

```typescript
// src/constants.ts
import { PromptSectionDefinition } from "./types/promptConfigTypes";
// ... other imports and constants ...

// Section Definitions - ORDER MATTERS for output and structured UI!
export const PROMPT_SECTIONS: PromptSectionDefinition[] = [
  {
    id: "rules", // Existing
    name: "RULES",
    label: "Rules",
    directory: "ai/rules",
    color: "var(--warning-color)",
  },
  // --- ADD THIS NEW SECTION DEFINITION ---
  {
    id: "cursor_rules", // Unique ID for this section
    name: "CURSOR_RULES", // Name used for prompt markers (@@@@_CURSOR_RULES_START)
    label: "Cursor Rules", // Label displayed in the UI
    directory: ".cursor/rules", // Directory path to match
    color: "var(--accent-green)", // Use the newly defined green color variable
  },
  // --- END ADD ---
  {
    id: "scraped", // Existing
    name: "SCRAPED_DOCUMENTATION",
    label: "Scraped Docs",
    directory: "ai/scraped",
    color: "var(--success-color)",
  },
  {
    id: "docs", // Existing
    name: "PROJECT_DOCUMENTATION",
    label: "Project Docs",
    directory: "ai/docs",
    color: "var(--accent-purple)",
  },
  {
    id: "project_files", // Existing (Default)
    name: "PROJECT_FILES",
    label: "Project",
    directory: null,
    color: "var(--accent-blue)",
  },
  {
    id: "prompts", // Existing
    name: "PROMPTS",
    label: "Prompts",
    directory: "ai/prompts",
    color: "var(--error-color)",
  },
];

// ... rest of the constants ...
```

**Step 3: Update Backend Section Definitions**

- **File:** `constants.js` (in the project root)
- **Action:** Add a corresponding entry for `CURSOR_RULES` to the `PROMPT_SECTIONS` array in this file. Ensure the `id`, `name`, and `directory` match the ones defined in `src/constants.ts`. Maintain the same relative order.

```javascript
// constants.js
// ... other constants like IPC_CHANNELS, MAX_FILE_SIZE ...

// Section definitions for main process categorization
const PROMPT_SECTIONS = [
  {
    id: "rules",
    name: "RULES",
    directory: "ai/rules",
  },
  // --- ADD THIS NEW SECTION DEFINITION ---
  {
    id: "cursor_rules", // Must match src/constants.ts
    name: "CURSOR_RULES", // Must match src/constants.ts
    directory: ".cursor/rules", // Must match src/constants.ts
    // label and color are not strictly needed by the backend, but can be added for consistency
  },
  // --- END ADD ---
  {
    id: "scraped",
    name: "SCRAPED_DOCUMENTATION",
    directory: "ai/scraped",
  },
  {
    id: "docs",
    name: "PROJECT_DOCUMENTATION",
    directory: "ai/docs",
  },
  {
    id: "project_files",
    name: "PROJECT_FILES",
    directory: null,
  },
  {
    id: "prompts",
    name: "PROMPTS",
    directory: "ai/prompts",
  },
];

module.exports = {
  // ... other exports like IPC_CHANNELS ...
  PROMPT_SECTIONS, // Ensure this is exported
};
```
