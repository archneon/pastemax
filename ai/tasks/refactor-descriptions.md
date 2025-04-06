**Instructions for Cursor Agent: Simplifying Description Files in PasteMax**

**1. Introduction & Goal:**

Hello Cursor Agent! We are working on the PasteMax project. Currently, the application supports description files for _each_ prompt section (like `rules.txt`, `prompts.txt`) located in `ai/.descriptions/`, plus a separate `overview.txt` and `project_tree.txt`.

**Problem:** This system has become a bit complex, leading to bugs:
a) Users can incorrectly select these special description files in the file tree, even though they shouldn't be treated as regular content files.
b) The logic to include the content of these description files (and the overview) in the final copied output is currently broken or missing after recent refactoring.

**Task:** Your goal is to **simplify this system significantly** and fix the related bugs. We will **remove the individual description files for sections and the project tree**, keeping **only the `ai/.descriptions/overview.txt` file**. All necessary context and instructions for the AI should be placed within this single `overview.txt` file by the user.

**Why?**

- **Simpler Code:** Reduces complexity in file processing, prompt generation, and UI components.
- **Simpler User Experience:** Users only need to manage one overview file for instructions.
- **Sufficient for AI:** A well-written overview is usually enough context for AI models.

**2. Summary of Core Changes:**

- Remove configuration related to section/tree description filenames.
- Simplify file identification in the main process (`fileProcessor.js`) to only recognize `overview.txt` as special. Other files will be 'regular'.
- Update TypeScript types.
- Remove logic for processing and including section/tree descriptions in the final prompt output (`promptUtils.ts`).
- Prevent selection of the `overview.txt` file in the UI (`TreeItem.tsx`).
- Ensure only 'regular' files are displayed in the main file list (`FileList.tsx`) and counted for the "Copy" button enablement (`useAppLogic.ts`).

**3. Step-by-Step Implementation:**

**Step 1: Modify Constants Files**

- **File:** `constants.js` (for the main process)
  - Find the `PROMPT_SECTIONS` array.
  - Inside each object within the array, **remove** the `descriptionFilename` property (e.g., remove `"descriptionFilename": "rules.txt"`).
  - **Remove** the entire `PROJECT_TREE_CONFIG` object.
- **File:** `src/constants.ts` (for the renderer process)
  - Find the `PROMPT_SECTIONS` array definition (`PromptSectionDefinition[]`).
  - Inside each object within the array, **remove** the `descriptionFilename` property.
  - **Remove** the entire `PROJECT_TREE_CONFIG` object definition.

**Step 2: Simplify `electron/fileProcessor.js`**

- **Imports:** Remove imports related to `PROJECT_TREE_CONFIG` if they exist at the top (they might be destructured from `../constants`).
- **`readFilesRecursively` Function:**
  - Locate the section within the `dirent.isFile()` block that handles files inside the `DESCRIPTIONS_DIR`.
  - **Modify the logic:**
    - Remove the check for `dirent.name === PROJECT_TREE_CONFIG.descriptionFilename`.
    - Remove the code block that does `PROMPT_SECTIONS.find(...)` to match section description filenames.
    - The logic should now _only_ check if `dirent.name === OVERVIEW_FILENAME`.
      - If it matches `OVERVIEW_FILENAME`, set `fileData.fileKind = 'overview';`.
      - If it's any _other_ file within `DESCRIPTIONS_DIR`, treat it as an unknown/unwanted file. Set `fileData.fileKind = 'regular';`, `fileData.isSkipped = true;`, and `fileData.error = 'Only overview.txt is supported in descriptions directory';`.
  - **`sectionId` Assignment:** Ensure the logic that assigns `sectionId` to `regular` files (based on their path relative to section directories like `ai/rules/`) **remains unchanged**. This is still needed for categorizing regular files.
- **Check Dependencies:** Make sure the code no longer references the removed `PROJECT_TREE_CONFIG` or the `descriptionFilename` properties from `PROMPT_SECTIONS`.

**Step 3: Update TypeScript Types (`src/types/FileTypes.ts`)**

- **`FileData` Interface:**
  - Find the `fileKind` property. Change its type definition to be only `"overview" | "regular"`. (Example: `fileKind: "overview" | "regular";`)
  - **Remove** the following properties if they still exist:
    - `isOverviewTemplate?: boolean;`
    - `descriptionForSectionId?: string | null;`
    - `isProjectTreeDescription?: boolean;`
- **`TreeNode` Interface:**
  - Ensure the `fileData` property within `TreeNode` uses the updated `FileData` interface (this should happen automatically if it's typed correctly).

**Step 4: Simplify `src/utils/promptUtils.ts` (`generatePromptContent`)**

- **`descriptionMap`:** Remove the entire logic block dedicated to creating the `descriptionMap`. This includes the `forEach` loop that populates it based on the old flags or `fileKind` values we are removing.
- **`overviewContent`:** Modify the logic that finds `overviewContent`. It should now simply find the one file where `file.fileKind === 'overview'`.
  ```javascript
  // Example of finding overviewContent
  const overviewFile = allFiles.find((file) => file.fileKind === "overview");
  const overviewContent = overviewFile ? overviewFile.content : null;
  ```
- **Remove Section Descriptions from Output:** Find the loop that iterates through `PROMPT_SECTIONS`. Inside this loop, **remove** the code block that checks for and adds the section description using `descriptionMap` and the `%%%% DESCRIPTION_START/END %%%%` markers. The loop should now only iterate through `sectionFiles` and add the file content markers (`>>>> FILE_START/END <<<<`) and the actual `file.content`.
- **Remove Project Tree Description:** Find the block that handles `includeFileTree`. **Remove** the part within that block which checks for and includes the project tree description (`treeDescription = descriptionMap["project_tree"];` and its usage). The ASCII tree generation should remain.
- **Filter `contentFiles`:** Ensure the initial filtering of `allFiles` to get `contentFiles` correctly uses `file.fileKind === 'regular'`. (It might already be doing this based on our previous changes).
  ```javascript
  // Verify or update this filter
  const contentFiles = allFiles.filter(
    (file: FileData) =>
      selectedPathSet.has(normalizePath(file.path)) &&
      file.fileKind === "regular" && // <<< Ensure this check is used
      !file.isBinary &&
      !file.isSkipped
  );
  ```

**Step 5: Adjust `src/components/TreeItem.tsx`**

- **Prevent Selecting Overview:**
  - Find the `handleCheckboxChange` function (or the logic setting the `disabled` prop on the checkbox input).
  - Add a check for `fileData.fileKind === 'overview'`. If it's the overview file, the checkbox should be disabled, and the `toggleFileSelection` action should _not_ be called.
  - Update the `isDisabled` calculation:
    ```typescript
    const isDisabled = useMemo(
      () =>
        !!(
          fileData &&
          (fileData.isBinary ||
            fileData.isSkipped ||
            fileData.fileKind === "overview")
        ), // Add check for overview
      [fileData]
    );
    ```
  - Ensure the `onChange` handler for the checkbox also respects this `isDisabled` state or explicitly checks `fileKind` before calling `toggleFileSelection`.

**Step 6: Adjust `src/components/FileList.tsx`**

- **Filter `displayableFiles`:**
  - Find the `.filter()` call that creates `displayableFiles`.
  - Ensure this filter _only_ includes files where `file.fileKind === 'regular'`. Remove checks for the old flags (`!file.descriptionForSectionId`, `!file.isOverviewTemplate`, `!file.isProjectTreeDescription`).
  ```typescript
  const displayableFiles = files.filter(
    (file) =>
      selectedPathsSet.has(normalizePath(file.path)) &&
      file.fileKind === "regular" && // <<< Use fileKind here
      !file.isBinary &&
      !file.isSkipped
    // Removed checks for old flags
  );
  ```

**Step 7: Verify `src/hooks/useAppLogic.ts`**

- **`selectedContentFilesCount`:** Double-check the `useMemo` hook that calculates this count. Ensure it correctly filters `allFiles` based on `file.fileKind === 'regular'` and the `selectedPathsSet`. The existing logic should be correct if it was updated in previous steps, but verify it.
  ```typescript
  const selectedContentFilesCount = useMemo(() => {
    // ... logger ...
    const selectedPathsSet = new Set(selectedFiles.map(normalizePath));
    const count = allFiles.filter(
      (file) =>
        selectedPathsSet.has(normalizePath(file.path)) &&
        file.fileKind === "regular" && // <<< Verify this check
        !file.isBinary &&
        !file.isSkipped
    ).length;
    // ... logger ...
    return count;
  }, [selectedFiles, allFiles]);
  ```

**4. Final Check:**

After implementing all these steps, please:

- Run `npx tsc --noEmit` to check for any TypeScript errors.
- Run the application (`npm run dev:electron`).
