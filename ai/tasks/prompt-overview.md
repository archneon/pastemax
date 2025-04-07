Okay, here are the step-by-step instructions for your Cursor Agent to implement "Option 2", allowing the `.pastemax/prompt-overview` file to be selectable while respecting the "Include Overview" toggle.

---

**Objective:** Modify the application to allow the `.pastemax/prompt-overview` file to be selected in the sidebar file tree, but only include its content in the final copied output if _both_ the "Include Overview" toggle switch is enabled _and_ the file itself has been explicitly selected by the user.

**Plan:**

1.  **Modify `src/components/TreeItem.tsx`:** Remove the condition that disables the checkbox specifically for the `prompt-overview` file based on its `fileKind`.
2.  **Modify `src/utils/promptUtils.ts`:** Update the `generatePromptContent` function to check if the `prompt-overview` file is _selected_ in addition to checking the `includePromptOverview` flag before adding its content to the output. Ensure the overview file is not processed within the main file sections.
3.  **Modify `src/store/projectStore.ts`:** Add a safety check to the `toggleFolderSelection` action to prevent it from affecting the `prompt-overview` file if a user somehow selects the `.pastemax` directory.

**Step-by-Step Instructions:**

**Step 1: Enable Checkbox in `TreeItem.tsx`**

- **File:** `src/components/TreeItem.tsx`
- **Locate:** The `useMemo` hook calculating the `isDisabled` constant.
- **Action:** Modify the condition inside the `useMemo` hook. Remove the check `fileData.fileKind === "overview"`. The file should only be disabled if it's binary or skipped for other reasons.

  - **Find this code:**
    ```typescript
    const isDisabled = useMemo(
      () =>
        !!(
          (
            fileData &&
            (fileData.isBinary ||
              fileData.isSkipped ||
              fileData.fileKind === "overview")
          ) // <-- REMOVE THIS PART
        ),
      [fileData]
    );
    ```
  - **Change it to:**
    ```typescript
    const isDisabled = useMemo(
      () =>
        !!(
          (fileData && (fileData.isBinary || fileData.isSkipped)) // Only check for binary or skipped
        ),
      [fileData]
    );
    ```

**Step 2: Update Content Generation Logic in `promptUtils.ts`**

- **File:** `src/utils/promptUtils.ts`
- **Locate:** The `generatePromptContent` function.
- **Action 1:** Modify the `if` condition that determines whether to add the `overviewBlock`. It should now check `includePromptOverview`, the existence of `overviewFile`, _and_ whether the `overviewFile.path` is present in the `selectedPathSet`.

  - **Find this code block (or similar):**
    ```typescript
    // Construct the overview block
    let overviewBlock = "";
    if (includePromptOverview && overviewContent) {
      // ... (block content generation) ...
    }
    ```
  - **Change the `if` condition to:**

    ```typescript
    // Construct the overview block - MODIFIED Condition
    let overviewBlock = "";
    // Check toggle AND if the file exists AND if it's in the selected set AND has content
    if (
      includePromptOverview &&
      overviewFile &&
      selectedPathSet.has(normalizePath(overviewFile.path)) &&
      overviewContent
    ) {
      overviewBlock += "%%%%_PROMPT_OVERVIEW_START\n";
      overviewBlock += String(overviewContent).trim();

      if (dynamicExplanations) {
        // Keep dynamic explanations logic
        overviewBlock += dynamicExplanations;
      }

      overviewBlock += "\n%%%%_PROMPT_OVERVIEW_END\n\n";
    }
    ```

- **Action 2:** Ensure the filter creating `contentFiles` explicitly excludes the overview file by checking `file.fileKind === "regular"`. (This should already be the case, but double-check).

  - **Verify this line exists and is correct:**
    ```typescript
    const contentFiles = allFiles.filter(
      (file: FileData) =>
        selectedPathSet.has(normalizePath(file.path)) &&
        !file.isBinary &&
        !file.isSkipped &&
        file.fileKind === "regular" // <-- Ensures overview isn't processed here
    );
    ```

**Step 3: Add Safety Check in `projectStore.ts`**

- **File:** `src/store/projectStore.ts`
- **Locate:** The `toggleFolderSelection` action within the `create` function.
- **Action:** Add a condition `file.fileKind !== 'overview'` to the `filter` method used to find `filesToToggle`.

  - **Find this code block:**
    ```typescript
    const filesToToggle = state.allFiles
      .filter(
        (file: FileData) =>
          !file.isBinary &&
          !file.isSkipped &&
          // fileKind check might be missing here
          normalizePath(file.path).startsWith(normalizedFolderPath + "/") &&
          normalizePath(file.path) !== normalizedFolderPath
      )
      .map((file: FileData) => normalizePath(file.path));
    ```
  - **Ensure it looks like this (add the `file.fileKind` check):**
    ```typescript
    const filesToToggle = state.allFiles
      .filter(
        (file: FileData) =>
          !file.isBinary &&
          !file.isSkipped &&
          file.fileKind !== "overview" && // <-- ADD THIS CHECK
          normalizePath(file.path).startsWith(normalizedFolderPath + "/") &&
          normalizePath(file.path) !== normalizedFolderPath
      )
      .map((file: FileData) => normalizePath(file.path));
    ```

---

**Summary:** After applying these changes, the `.pastemax/prompt-overview` file will have an enabled checkbox in the sidebar. If the user checks it, it will be added to the `selectedFiles` state. The final copied output will only contain the overview block if the "Include Overview" toggle is on _and_ the user has selected the overview file in the sidebar. The `toggleFolderSelection` action will safely ignore this specific file.
