Okay, agent, let's get this done! Here are the detailed instructions for implementing Phase 1 of the refactoring for PasteMax.

---

**Instructions for Cursor Agent: PasteMax Phase 1 Refactor - Simplify Overview & Add Docs Section**

**1. Introduction & Goal:**

Hello Cursor Agent! We're continuing work on PasteMax. The main goal of this task (Phase 1) is to simplify how context instructions (the "overview") are handled and to introduce a dedicated section for user-written project documentation. We will also fix related bugs concerning file selection and prompt generation.

**Specific Objectives:**

1.  **Centralize Overview:** Remove the old concept of individual description files (`ai/.descriptions/`). Use a single file for the main overview/instructions.
2.  **New Overview Location:** Move this single overview file to `<project_root>/.pastemax/prompt-overview` (note: no file extension).
3.  **New Marker System:**
    - Use `%%%%_PROMPT_OVERVIEW_START` and `%%%%_PROMPT_OVERVIEW_END` to wrap the overview content.
    - Use connected markers (with `_`) for the project tree and file content sections (e.g., `@@@@_PROJECT_TREE_START`, `@@@@_RULES_START`).
    - Keep file markers as they are (`>>>> FILE_START: path`).
4.  **Dynamic Overview Explanation:** The content of `prompt-overview` provided by the user will be the base. Append a standardized "Structure Explanation" block _only_ listing the elements (tree, specific sections like RULES, PROJECT_FILES) that are actually present in the content being copied at that moment.
5.  **Add "Project Docs" Section:** Introduce a new standard section for user-written project documentation located in `ai/docs/`.
6.  **UI/UX Fixes:**
    - Disable the "Include Overview" toggle button if the `.pastemax/prompt-overview` file is missing or empty.
    - Prevent the `prompt-overview` file from being selectable in the sidebar file tree.
    - Ensure the main file list area only displays selected _regular_ content files.
    - Ensure the "Copy" button is enabled _only_ when at least one _regular_ content file is selected (the "Include..." toggles should not enable the button on their own).

**Why:** Cleaner project structure, simpler user experience, more accurate AI context, fixed bugs.

**2. Step-by-Step Implementation:**

**Step 1: Add CSS Variable**

- **File:** `src/styles/index.css`
- **Action:** Inside the `:root` selector, add a CSS variable for purple. If your theme already has one use it, otherwise add:
  ```css
  :root {
    /* ... other variables ... */
    --accent-purple: #9b59b6; /* Example purple */
  }
  .dark-mode {
    /* ... other variables ... */
    /* Optional: Define a different purple for dark mode if desired */
    --accent-purple: #bb86fc; /* Example dark mode purple */
  }
  ```

**Step 2: Update Constants Files**

- **File:** `constants.js` (Main Process)
  - **Remove:** `DESCRIPTIONS_DIR`.
  - **Modify:** `OVERVIEW_FILENAME` -> `PROMPT_OVERVIEW_FILENAME = "prompt-overview";`
  - **Add:** `PASTEMAX_DIR = ".pastemax";`
  - **Modify `PROMPT_SECTIONS`:**
    - Remove the `descriptionFilename` property from all section objects (if they still exist).
    - **Add** a new section object for Project Documentation:
    ```javascript
    {
      id: "docs",
      name: "PROJECT_DOCUMENTATION", // For markers
      directory: "ai/docs",
    },
    ```
    _(Place it logically, maybe after 'scraped' or before 'project_files')._
  - **Remove:** `PROJECT_TREE_CONFIG` object entirely.
  - **Update `module.exports`:** Ensure `PASTEMAX_DIR`, `PROMPT_OVERVIEW_FILENAME` are exported, and `DESCRIPTIONS_DIR`, `PROJECT_TREE_CONFIG` are removed.
- **File:** `src/constants.ts` (Renderer Process)
  - **Remove:** `DESCRIPTIONS_DIR`.
  - **Modify:** `OVERVIEW_FILENAME` -> `PROMPT_OVERVIEW_FILENAME = "prompt-overview";`
  - **Add:** `PASTEMAX_DIR = ".pastemax";`
  - **Modify `PROMPT_SECTIONS` (`PromptSectionDefinition[]`):**
    - Remove the `descriptionFilename` property from the `PromptSectionDefinition` type itself (in `src/types/promptConfigTypes.ts` first - see Step 4) and then remove the property from all section objects here.
    - **Add** the new section object for Project Documentation, including the `label` and `color`:
    ```typescript
    {
      id: "docs",
      name: "PROJECT_DOCUMENTATION",
      label: "Project Docs", // For UI
      directory: "ai/docs",
      color: "var(--accent-purple)", // Use the new CSS variable
    },
    ```
    _(Place it in the same logical order as in `constants.js`)._
  - **Remove:** `PROJECT_TREE_CONFIG` object definition entirely.
  - **Modify `PROMPT_MARKERS`:** Update the marker templates to use the connected `_` style where appropriate. Keep the file path placeholder for file markers.
    ```typescript
    export const PROMPT_MARKERS = {
      section_open: "@@@@_{section_name}_START", // Changed
      section_close: "@@@@_{section_name}_END", // Changed
      // description_open/close are no longer needed - REMOVE them
      file_open: ">>>> FILE_START: {file_path}", // Unchanged
      file_close: ">>>> FILE_END: {file_path}", // Unchanged
    };
    ```

**Step 3: Update TypeScript Types**

- **File:** `src/types/promptConfigTypes.ts`
  - **Modify `PromptSectionDefinition` interface:** Remove the `descriptionFilename` property.
- **File:** `src/types/FileTypes.ts`
  - **Modify `FileData` interface:** Ensure `fileKind` is defined as `"overview" | "regular"`. Remove any old properties like `isOverviewTemplate`, `descriptionForSectionId`, `isProjectTreeDescription`.

**Step 4: Update `electron/fileProcessor.js`**

- **Imports:** Update the `require('../constants')` to import `PASTEMAX_DIR`, `PROMPT_OVERVIEW_FILENAME` and the updated `PROMPT_SECTIONS`. Remove `DESCRIPTIONS_DIR`, `PROJECT_TREE_CONFIG`.
- **`readFilesRecursively` Function:**
  - Find the block checking `parentDirRelative`. Change the condition from `=== DESCRIPTIONS_DIR` to `=== PASTEMAX_DIR`.
  - Inside that block, simplify the logic:
    - If `dirent.name === PROMPT_OVERVIEW_FILENAME`, set `fileData.fileKind = 'overview';`.
    - Else (any other file in `.pastemax`), set `fileData.isSkipped = true;` and `fileData.error = 'Only prompt-overview is allowed in .pastemax directory';`. Remove the `fileData.fileKind = 'regular';` assignment from this else branch.
  - Ensure the logic assigning `sectionId` to `regular` files correctly iterates through the _updated_ `PROMPT_SECTIONS` array (including the new "docs" section).

**Step 5: Update `src/hooks/useAppLogic.ts`**

- **Add `hasOverviewFile`:** Implement the `useMemo` calculation as described in the previous discussion:
  ```typescript
  const hasOverviewFile = useMemo(() => {
    const overviewFile = allFiles.find((file) => file.fileKind === "overview");
    const existsAndNotEmpty = !!(
      overviewFile &&
      overviewFile.content &&
      overviewFile.content.trim().length > 0
    );
    logger.debug(
      `useAppLogic: Calculated hasOverviewFile: ${existsAndNotEmpty}`
    );
    return existsAndNotEmpty;
  }, [allFiles]);
  ```
- **Verify `selectedContentFilesCount`:** Make sure this `useMemo` correctly filters using `file.fileKind === 'regular'`.
- **Return `hasOverviewFile`:** Add `hasOverviewFile` to the return object of the hook.

**Step 6: Update UI (`src/App.tsx`)**

- **Get State:** Destructure `hasOverviewFile` from `useAppLogic()`.
- **Disable "Include Overview" Toggle:**
  - Find the `FileTreeToggle` for "Include Overview".
  - Add the `disabled={!hasOverviewFile}` prop.
  - Update the `title` prop to be conditional:
    ```typescript
      title={
        !hasOverviewFile
          ? "Overview file (.pastemax/prompt-overview) not found or empty"
          : includePromptOverview
          ? "Exclude prompt overview"
          : "Include prompt overview"
      }
    ```
- **Verify Copy Button:** Ensure the `CopyButton`'s `disabled` prop is still `disabled={selectedContentFilesCount === 0}` and the text inside uses `selectedContentFilesCount`.

**Step 7: Refactor `src/utils/promptUtils.ts` (`generatePromptContent`)**

- **Imports:** Import the updated `PROMPT_MARKERS` and `PROMPT_SECTIONS`.
- **Remove `descriptionMap`:** Delete all code related to creating and using `descriptionMap`.
- **Find `overviewContent`:** Use `allFiles.find(file => file.fileKind === 'overview')`.
- **Filter `contentFiles`:** Ensure filtering uses `file.fileKind === 'regular'`.
- **Generate `mainOutput` and Track Presence:**
  - Initialize `let mainOutput = "";` and `const presentSectionNames = new Set<string>();`.
  - **Tree:** If `includeFileTree`, generate the ASCII tree. Add `@@@@_PROJECT_TREE_START` marker, tree content, and `@@@@_PROJECT_TREE_END` marker to `mainOutput`.
  - **File Sections:** Loop through `PROMPT_SECTIONS`. If a section has files in `filesBySection`:
    - Add the section name to `presentSectionNames` (e.g., `presentSectionNames.add(section.name);`).
    - Add `@@@@_{section.name}_START` marker to `mainOutput`.
    - Loop through `sectionFiles`, adding `>>>> FILE_START: path`, content, and `>>>> FILE_END: path` markers/content to `mainOutput`.
    - Add `@@@@_{section.name}_END` marker to `mainOutput`.
- **Generate `dynamicExplanations`:**
  - Initialize `let dynamicExplanations = "";`.
  - Check if `includeFileTree` is true AND `mainOutput` contains the tree start marker. If yes, append the explanation for the project tree to `dynamicExplanations`.
  - Loop through `PROMPT_SECTIONS`. If `presentSectionNames.has(section.name)`, append the explanation for that file section to `dynamicExplanations`, mentioning its specific markers.
  - If `dynamicExplanations` is not empty, prepend `\n\nStructure Explanation:` to it.
- **Construct Overview Block:**
  - Initialize `let overviewBlock = "";`.
  - If `includePromptOverview` is true AND `overviewContent` exists:
    - Add `%%%%_PROMPT_OVERVIEW_START\n`.
    - Add `String(overviewContent).trim()`.
    - Add `\n` + `dynamicExplanations` (if `dynamicExplanations` is not empty).
    - Add `\n%%%%_PROMPT_OVERVIEW_END\n\n`.
- **Combine and Return:** Set `finalOutput = overviewBlock + mainOutput.trim();`. Return `finalOutput` or a placeholder.
- **Cleanup:** Remove any unused variables or code related to old descriptions.

**Step 8: Update `src/components/TreeItem.tsx`**

- **`isDisabled` Calculation:** Ensure it includes `fileData.fileKind === 'overview'`:
  ```typescript
  const isDisabled = useMemo(
    () =>
      !!(
        fileData &&
        (fileData.isBinary ||
          fileData.isSkipped ||
          fileData.fileKind === "overview")
      ),
    [fileData]
  );
  ```
- **Checkbox `onChange` / `handleCheckboxChange`:** Explicitly check `!isDisabled` before calling `toggleFileSelection` or `toggleFolderSelection`.
- **Badge Display (Optional Enhancement):** Update the badge logic for disabled items to show "Overview" specifically if `fileData.fileKind === 'overview'`.
  ```typescript
  {
    isDisabled && fileData && (
      <span className="tree-item-badge">
        {" "}
        {fileData.fileKind === "overview" // Check first
          ? "Overview"
          : fileData.isBinary
          ? "Binary"
          : "Skipped"}{" "}
      </span>
    );
  }
  ```

**Step 9: Update `src/components/FileList.tsx`**

- **Filter `displayableFiles`:** Confirm the filter uses `file.fileKind === 'regular'` and does _not_ check for the old flags.
  ```typescript
  const displayableFiles = files.filter(
    (file) =>
      selectedPathsSet.has(normalizePath(file.path)) && // Use normalizePath here too for safety
      file.fileKind === "regular" && // <<< Check this
      !file.isBinary &&
      !file.isSkipped
  );
  ```

**Step 10: Final Check & Testing**

- Run `npx tsc --noEmit`. Fix any reported errors.
- Run `npm run dev:electron`.

This concludes Phase 1. Good luck, agent!
