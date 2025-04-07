**Objective:** Fix two issues:

1.  The `.pastemax` directory checkbox in the sidebar tree does not correctly select/deselect its child file (`prompt-overview`) and shows an indeterminate state (-) instead of a checked state (✓) when the child is selected.
2.  The file card for `.pastemax/prompt-overview` is not appearing in the main `FileList` component area (under the "Project" section) even when selected.

**Reasoning:**

- **Checkbox Issue:** The functions responsible for folder selection logic (`toggleFolderSelection` in `projectStore.ts`) and for calculating the directory checkbox state (`getAllSelectableFilePaths` in `TreeItem.tsx`) _still contain leftover filters_ that exclude files based on `fileKind !== "overview"`. Since we changed `prompt-overview` to have `fileKind: 'regular'`, these filters are now incorrectly preventing the file from being considered in folder operations and state calculations.
- **Missing Card Issue:** The cause is likely that the `prompt-overview` file data is either not reaching the `FileList` component with the correct `sectionId: 'project_files'`, or the grouping/rendering logic within `FileList` is failing to place it correctly. The logs added previously should help pinpoint this.

**Plan:**

1.  **Fix Checkbox Logic:** Remove the redundant `fileKind !== "overview"` filters from `projectStore.ts` and `TreeItem.tsx`.
2.  **Verify Card Display:** After fixing the checkbox, re-test if the file card appears. If not, analyze the debug logs added in the previous step (`[FileProcessor]`, `[IPC Manager]`, `[FileList Grouping]`) to identify where the `sectionId` is lost or misinterpreted.

**Step-by-Step Instructions:**

**Step 1: Remove Filter in `projectStore.ts`**

- **File:** `src/store/projectStore.ts`
- **Locate:** The `toggleFolderSelection` action. Find the `.filter(...)` call used to create `filesToToggle`.
- **Action:** Remove the condition `file.fileKind !== "overview" &&`.

  - **Change from:**
    ```typescript
    .filter(
      (file: FileData) =>
        !file.isBinary &&
        !file.isSkipped &&
        file.fileKind !== "overview" && // <-- REMOVE THIS LINE
        normalizePath(file.path).startsWith(normalizedFolderPath + "/") &&
        normalizePath(file.path) !== normalizedFolderPath
    )
    ```
  - **Change to:**
    ```typescript
    .filter(
      (file: FileData) =>
        !file.isBinary &&
        !file.isSkipped && // Keep only these checks + path checks
        normalizePath(file.path).startsWith(normalizedFolderPath + "/") &&
        normalizePath(file.path) !== normalizedFolderPath
    )
    ```

**Step 2: Remove Filter in `TreeItem.tsx`**

- **File:** `src/components/TreeItem.tsx`
- **Locate:** The `getAllSelectableFilePaths` useCallback hook. Find the `if (...)` condition inside the loop.
- **Action:** Remove the condition `child.fileData.fileKind !== "overview"`.

  - **Change from:**
    ```typescript
    if (
      child.type === "file" &&
      child.fileData &&
      !child.fileData.isBinary &&
      !child.fileData.isSkipped &&
      child.fileData.fileKind !== "overview" // <-- REMOVE THIS LINE
    ) {
      paths.push(normalizePath(child.path));
    }
    ```
  - **Change to:**
    ```typescript
    if (
      child.type === "file" &&
      child.fileData &&
      !child.fileData.isBinary &&
      !child.fileData.isSkipped // Keep only these checks
    ) {
      paths.push(normalizePath(child.path));
    }
    ```
