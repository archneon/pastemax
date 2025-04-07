**Objective:** Create a dedicated section for PasteMax configuration files (like `.pastemax/prompt-overview`) to cleanly separate the "Include Overview" toggle functionality from the ability to select and copy the raw content of the overview file itself.

**Reasoning:** We need two distinct functionalities:

1.  An "Include Overview" toggle that prepends the overview content (potentially processed) to the final prompt, independent of file selection.
2.  The ability to select the `.pastemax/prompt-overview` file in the sidebar tree and have its raw template content included in the main prompt body like any other selected file.
    Creating a new section (e.g., `PASTEMAX_CONFIG`) provides a semantically correct place for such files in the UI (`FileList`) and the final output, keeping them separate from regular project files while allowing both functionalities to coexist without conflict.

**Plan:**

1.  **Define New Section:** Add the `PASTEMAX_CONFIG` section definition to both `src/constants.ts` and `constants.js`.
2.  **Assign Section ID in Backend:** Modify `electron/fileProcessor.js` to assign the new `sectionId: 'pastemax_config'` to files within the `.pastemax` directory. Crucially, the `prompt-overview` file should get _both_ `fileKind: 'overview'` _and_ `sectionId: 'pastemax_config'`.
3.  **Update FileList Display:** Modify `src/components/FileList.tsx` to remove the filter that excludes non-'regular' files, allowing the selected `prompt-overview` file to be displayed under its new section.
4.  **Update Copy Button Count:** Modify `src/hooks/useAppLogic.ts` to include selected, non-binary/skipped files regardless of their `fileKind` in the `selectedContentFilesCount`.
5.  **Adjust Prompt Generation:** Modify `src/utils/promptUtils.ts` (`generatePromptContent`):
    - Decouple the prepended `overviewBlock` generation from file selection; it should only depend on the `includePromptOverview` toggle and the existence of the file identified by `fileKind: 'overview'`.
    - Ensure the main loop processes _all_ selected, valid files (including `prompt-overview` if selected), grouping them by their `sectionId` (including the new `'pastemax_config'`).

**Step-by-Step Instructions:**

**Step 1: Define New Section in Constants**

- **File 1:** `src/constants.ts`
- **Locate:** The `PROMPT_SECTIONS` array.
- **Action:** Add a new section definition object to the array. Place it logically, perhaps near the beginning or end.

  ```typescript
  // src/constants.ts
  export const PROMPT_SECTIONS: PromptSectionDefinition[] = [
    // ... existing sections like RULES ...
    {
      id: "pastemax_config", // Unique identifier
      name: "PASTEMAX_CONFIG", // Name for markers if needed
      label: "PasteMax Config", // UI Label for the section header
      directory: PASTEMAX_DIR, // Link to the .pastemax directory
      color: "var(--text-secondary)", // Choose an appropriate color
    },
    // ... other existing sections like PROJECT_FILES, PROMPTS ...
  ];
  ```

- **File 2:** `constants.js`
- **Locate:** The `PROMPT_SECTIONS` array.
- **Action:** Add the _same_ section definition object to this array, maintaining consistency.

  ```javascript
  // constants.js
  const PROMPT_SECTIONS = [
    // ... existing sections ...
    {
      id: "pastemax_config",
      name: "PASTEMAX_CONFIG",
      label: "PasteMax Config", // Ensure label matches if used by backend (unlikely but good practice)
      directory: PASTEMAX_DIR,
      // Color is frontend-only, no need here usually, but keep structure similar
    },
    // ... other existing sections ...
  ];
  ```

**Step 2: Assign Section ID in `fileProcessor.js`**

- **File:** `electron/fileProcessor.js`
- **Locate:** The logic block inside `readFilesRecursively` that handles files, specifically where `fileKind` is determined (inside the `try` block for processing a file).
- **Action:** Modify the logic for files within the `PASTEMAX_DIR`. Assign `sectionId: 'pastemax_config'` to them. Ensure `prompt-overview` _also_ retains `fileKind: 'overview'`.

  - **Find this approximate logic:**

    ```javascript
    // Inside the file processing loop...
    const parentDirRelative = normalizePath(path.dirname(relativePath));

    if (parentDirRelative === PASTEMAX_DIR) {
      // Special file logic
      if (dirent.name === PROMPT_OVERVIEW_FILENAME) {
        fileData.fileKind = "overview";
        // SECTION ID IS MISSING HERE
      } else {
        fileData.isSkipped = true;
        fileData.error =
          "Only prompt-overview is allowed in .pastemax directory"; // This might need review later if other config files are added
      }
    } else {
      // Assign sectionId for REGULAR files
      fileData.fileKind = "regular";
      // ... existing logic for other sections ...
    }
    ```

  - **Change it to:**

    ```javascript
    // Inside the file processing loop...
    const parentDirRelative = normalizePath(path.dirname(relativePath));

    if (parentDirRelative === PASTEMAX_DIR) {
      // Assign the specific section ID for this directory
      fileData.sectionId = "pastemax_config"; // <-- ASSIGN NEW SECTION ID

      if (dirent.name === PROMPT_OVERVIEW_FILENAME) {
        fileData.fileKind = "overview"; // <-- Keep fileKind
      } else {
        // If other files might exist here later, decide how to handle them.
        // For now, maybe just let them be 'regular' within this section?
        // Or keep skipping them if only overview is expected for now.
        // Let's assume for now we still only care about overview:
        fileData.isSkipped = true; // Keep skipping others for now
        fileData.error =
          "Only prompt-overview is currently processed in .pastemax directory";
        fileData.fileKind = "regular"; // Assign a default kind even if skipped
      }
    } else {
      // Assign sectionId for REGULAR files outside .pastemax
      fileData.fileKind = "regular";
      let assignedSection = false;
      for (const section of PROMPT_SECTIONS) {
        // Make sure to check section.directory is not null before using startsWith
        if (
          section.directory &&
          relativePath.startsWith(section.directory + "/")
        ) {
          fileData.sectionId = section.id;
          assignedSection = true;
          break;
        }
      }
      if (!assignedSection) {
        // Find the default section (directory: null)
        const defaultSection = PROMPT_SECTIONS.find(
          (s) => s.directory === null
        );
        fileData.sectionId = defaultSection
          ? defaultSection.id
          : "project_files"; // Fallback ID if default isn't found (shouldn't happen)
      }
    }
    ```

**Step 3: Update `FileList.tsx` Display Filter**

- **File:** `src/components/FileList.tsx`
- **Locate:** The definition of the `displayableFiles` constant.
- **Action:** Remove the `&& file.fileKind === "regular"` condition.

  - **Change from:**
    ```typescript
    const displayableFiles = files.filter(
      (file) =>
        selectedPathsSet.has(normalizePath(file.path)) &&
        !file.isBinary &&
        !file.isSkipped &&
        file.fileKind === "regular" // <-- REMOVE THIS
    );
    ```
  - **Change to:**
    ```typescript
    const displayableFiles = files.filter(
      (file) =>
        selectedPathsSet.has(normalizePath(file.path)) &&
        !file.isBinary &&
        !file.isSkipped // Keep only these
    );
    ```

**Step 4: Update Copy Button Count in `useAppLogic.ts`**

- **File:** `src/hooks/useAppLogic.ts`
- **Locate:** The `useMemo` hook calculating `selectedContentFilesCount`.
- **Action:** Remove the `&& file.fileKind === "regular"` condition.

  - **Change from:**
    ```typescript
    const count = allFiles.filter(
      (file) =>
        selectedPathsSet.has(normalizePath(file.path)) &&
        !file.isBinary &&
        !file.isSkipped &&
        file.fileKind === "regular" // <-- REMOVE THIS
    ).length;
    ```
  - **Change to:**
    ```typescript
    const count = allFiles.filter(
      (file) =>
        selectedPathsSet.has(normalizePath(file.path)) &&
        !file.isBinary &&
        !file.isSkipped // Keep only these
    ).length;
    ```

**Step 5: Adjust Logic in `promptUtils.ts`**

- **File:** `src/utils/promptUtils.ts`
- **Locate:** The `generatePromptContent` function.
- **Action 1:** Modify the condition for generating the `overviewBlock`. It should _only_ check `includePromptOverview` and the existence/content of the file with `fileKind === 'overview'`. Remove the `selectedPathSet.has(...)` check.

  - **Find the `if` statement for `overviewBlock`:** (It might still have the check from the previous iteration)
    ```typescript
    // Might look like this:
    if (
      includePromptOverview &&
      overviewFile &&
      selectedPathSet.has(normalizePath(overviewFile.path)) && // <-- Definitely remove this
      overviewContent
    ) { ... }
    // Or like this:
    if (includePromptOverview && overviewContent) { ... } // This is closer
    ```
  - **Ensure it becomes:**

    ```typescript
    // Construct the overview block - Depends ONLY on the toggle and file existence/content
    let overviewBlock = "";
    // Find the overview file first (if not already done)
    const overviewFile = allFiles.find((file) => file.fileKind === "overview");
    const overviewContent = overviewFile ? overviewFile.content : null;

    if (
      includePromptOverview &&
      overviewFile && // Check if the file object exists
      overviewContent // Check if it has content
    ) {
      overviewBlock += "%%%%_PROMPT_OVERVIEW_START\n"; // Consider using formatMarker if needed later
      overviewBlock += String(overviewContent).trim();
      // ... (keep dynamic explanations logic) ...
      overviewBlock += "\n%%%%_PROMPT_OVERVIEW_END\n\n";
    }
    ```

- **Action 2:** Ensure the definition of `contentFiles` (for the main loop) correctly includes _all_ selected, valid files, including `prompt-overview` if it's selected. The grouping logic later will use the `sectionId`.

  - **Replace the existing `contentFiles` definition with:**
    ```typescript
    // Get all selected files that are not binary or skipped
    const contentFiles = allFiles.filter(
      (file: FileData) =>
        selectedPathSet.has(normalizePath(file.path)) &&
        !file.isBinary &&
        !file.isSkipped
    );
    ```

- **Action 3 (Verification):** Double-check that the code block sorting `contentFiles` (`sortedContentFiles = [...contentFiles].sort(...)`) and the subsequent loop (`filesBySection` creation and the final loop generating `FILE_START`/`END` blocks based on `sectionId`) remain functionally the same. They will now naturally handle the `prompt-overview` file if it's in `contentFiles` and place it under the `PASTEMAX_CONFIG` section based on its assigned `sectionId`.

---

**Summary of Expected Outcome:**
With these changes, the `.pastemax/prompt-overview` file will:

- Be assigned `sectionId: 'pastemax_config'` and `fileKind: 'overview'` by the backend.
- Be selectable in the `TreeItem` and display its "Overview" badge.
- Appear in the `FileList` under a new "PasteMax Config" section header when selected.
- Be counted towards the total selected files on the "COPY" button.
- Have its raw content included in the main prompt output (between `PASTEMAX_CONFIG_START`/`END` markers and `FILE_START`/`END` markers) _if selected_.
- Have its content prepended to the _entire_ prompt output (as `overviewBlock`) _if the "Include Overview" toggle is ON_, regardless of whether the file itself was selected for raw content copying.
