Cilj torej **popolna poenostavitev**:

1.  `.pastemax/prompt-overview` naj bo obravnavana kot **navadna (`regular`) datoteka**.
2.  **Ne bo imela posebnega `sectionId`**; samodejno naj pade pod privzeto sekcijo ("Project Files").
3.  **Odstranimo definicijo sekcije `PASTEMAX_CONFIG`** iz konstant.
4.  Funkcionalnost stikala **"Include Overview" mora še vedno delovati**, vendar bo morala datoteko najti po njeni **točni poti**, ne več po `fileKind` ali `sectionId`.
5.  Checkboxi za mapo `.pastemax` in datoteko `prompt-overview` morajo delovati kot pri vseh ostalih mapah/datotekah.

S tem pristopom bo `prompt-overview` v UI videti in se obnašati kot katerakoli druga datoteka v projektu, ločena pa ostane samo logika, ki jo uporabi stikalo "Include Overview".

---

**Navodila za agenta (v angleščini):**

**Objective:** Simplify the handling of the `.pastemax/prompt-overview` file by treating it entirely as a 'regular' file within the default 'Project Files' section, while ensuring the "Include Overview" toggle functionality still works by identifying the file via its path. Remove the previously added `PASTEMAX_CONFIG` section.

**Reasoning:** This approach maximizes simplicity and consistency for UI interactions (selection, FileList display, checkbox behavior for the `.pastemax` folder) by removing special `fileKind` and `sectionId` handling for the overview file. The responsibility for identifying the file for the "Include Overview" toggle's specific action is shifted to the prompt generation logic, which will use the file's known path.

**Plan:**

1.  **Remove Section Definition:** Remove the `PASTEMAX_CONFIG` section definition completely from `src/constants.ts` and `constants.js`.
2.  **Modify Backend File Processing:** In `electron/fileProcessor.js`, ensure `.pastemax/prompt-overview` gets `fileKind: 'regular'` and no specific `sectionId` (allowing it to fall back to the default, likely `'project_files'`).
3.  **Modify Frontend Prompt Generation:** In `src/utils/promptUtils.ts`, refactor the logic for the prepended `overviewBlock`. It must now find the overview file **solely based on its expected path**, derived from `selectedFolder` and constants. The main `contentFiles` loop will naturally include the (now 'regular') overview file if selected.
4.  **Simplify TreeItem Display:** Remove any remaining logic in `src/components/TreeItem.tsx` that specifically checked for `fileKind === 'overview'` for badge display. The file will render as a normal, non-disabled item.
5.  **Verify Frontend Filters/Counts:** Ensure filters in `src/components/FileList.tsx` (`displayableFiles`) and `src/hooks/useAppLogic.ts` (`selectedContentFilesCount`) correctly handle the overview file now that it's 'regular' (they should already be correct after previous steps, just verify they only exclude binary/skipped).
6.  **Verify Store Actions:** Ensure `toggleFolderSelection` in `src/store/projectStore.ts` works correctly for the `.pastemax` directory (the previous removal of the `fileKind !== 'overview'` filter should ensure this).

**Step-by-Step Instructions:**

**Step 1: Remove Section Definition from Constants**

- **File 1:** `src/constants.ts`
- **Locate:** The `PROMPT_SECTIONS` array.
- **Action:** Delete the entire object defining the `pastemax_config` section.

  ```typescript
  // src/constants.ts
  export const PROMPT_SECTIONS: PromptSectionDefinition[] = [
    // { // <-- DELETE THIS ENTIRE BLOCK
    //   id: "pastemax_config",
    //   name: "PASTEMAX_CONFIG",
    //   label: "PasteMax Config",
    //   directory: PASTEMAX_DIR,
    //   color: "var(--text-secondary)",
    // }, // <-- END DELETE
    {
      id: "rules",
      // ... rest of the sections remain ...
    },
    // ...
  ];
  ```

- **File 2:** `constants.js`
- **Locate:** The `PROMPT_SECTIONS` array.
- **Action:** Delete the entire object defining the `pastemax_config` section.

  ```javascript
  // constants.js
  const PROMPT_SECTIONS = [
    // { // <-- DELETE THIS ENTIRE BLOCK
    //  id: "pastemax_config",
    //  name: "PASTEMAX_CONFIG",
    //  label: "PasteMax Config",
    //  directory: PASTEMAX_DIR,
    // }, // <-- END DELETE
    {
      id: "rules",
      // ... rest of the sections remain ...
    },
    // ...
  ];
  ```

**Step 2: Modify Backend File Processing (`fileProcessor.js`)**

- **File:** `electron/fileProcessor.js`
- **Locate:** Inside `readFilesRecursively`, the logic block handling files within `PASTEMAX_DIR`.
- **Action:** Set `fileKind` to `'regular'` for `prompt-overview` and remove any explicit assignment of `sectionId` (let it fall back to the default logic).

  - **Find this block:**
    ```javascript
    if (parentDirRelative === PASTEMAX_DIR) {
      // fileData.sectionId = 'pastemax_config'; // <-- REMOVE or comment out
      if (dirent.name === PROMPT_OVERVIEW_FILENAME) {
        fileData.fileKind = "overview"; // <-- CHANGE THIS
      } else {
        fileData.isSkipped = true;
        fileData.error = "...";
        fileData.fileKind = "regular";
      }
    } else {
      fileData.fileKind = "regular";
      // ... logic to assign sectionId based on directory (e.g., 'rules', 'docs') ...
      // Ensure this correctly assigns the default ('project_files') if no other rule matches
      // ... find default section logic ...
      fileData.sectionId = defaultSection ? defaultSection.id : "project_files";
    }
    ```
  - **Change it to:**

    ```javascript
    if (parentDirRelative === PASTEMAX_DIR) {
      // No special sectionId assignment here anymore
      if (dirent.name === PROMPT_OVERVIEW_FILENAME) {
        fileData.fileKind = "regular"; // <-- SET TO REGULAR
        // Let sectionId be determined by the fallback logic below
      } else {
        fileData.isSkipped = true;
        fileData.error = "Only prompt-overview is currently processed...";
        fileData.fileKind = "regular"; // Keep regular
      }
      // Allow prompt-overview to fall through to default section assignment
    }
    // Always assign fileKind and sectionId AFTER the PASTEMAX_DIR check (if not already assigned)
    if (fileData.fileKind === null) {
      // Should be already set, but for safety
      fileData.fileKind = "regular";
    }

    // Assign sectionId if not already assigned (e.g., if it fell through the PASTEMAX_DIR check)
    if (fileData.sectionId === null) {
      let assignedSection = false;
      for (const section of PROMPT_SECTIONS) {
        // Check section.directory before using startsWith
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
          : "project_files";
      }
    }
    ```

    _(Self-correction: The logic needs restructuring slightly to ensure the default `sectionId` ('project_files') is assigned correctly after checking specific directories and after handling the `.pastemax` case where no specific ID is now set)_.

**Step 3: Modify Frontend Prompt Generation (`promptUtils.ts`)**

- **File:** `src/utils/promptUtils.ts`
- **Locate:** The `generatePromptContent` function.
- **Action 1:** Change how `overviewFile` and `overviewContent` are found. Use the file's **path**.

  - **Replace the `fileKind` based finding:**

    ```typescript
    // OLD: const overviewFile = allFiles.find((file) => file.fileKind === "overview");
    // OLD: const overviewContent = overviewFile ? overviewFile.content : null;

    // NEW: Find by path
    const overviewExpectedPath = selectedFolder
      ? normalizePath(
          `${selectedFolder}/${PASTEMAX_DIR}/${PROMPT_OVERVIEW_FILENAME}`
        )
      : null;
    const overviewFile = overviewExpectedPath
      ? allFiles.find(
          (file) => normalizePath(file.path) === overviewExpectedPath
        )
      : null;
    const overviewContent = overviewFile ? overviewFile.content : null;
    ```

- **Action 2:** Verify the condition for `overviewBlock` only checks `includePromptOverview`, `overviewFile` existence, and `overviewContent`. (This should be correct from the previous step).

  ```typescript
  // Verify this condition:
  if (
    includePromptOverview &&
    overviewFile && // Check if the file object was found by path
    overviewContent // Check if it has content
  ) {
    // ... generate overviewBlock ...
  }
  ```

- **Action 3:** Verify the definition of `contentFiles` includes all selected, non-binary, non-skipped files. (This should also be correct from the previous step).

  ```typescript
  // Verify this definition:
  const contentFiles = allFiles.filter(
    (file: FileData) =>
      selectedPathSet.has(normalizePath(file.path)) &&
      !file.isBinary &&
      !file.isSkipped
  );
  ```

**Step 4: Simplify `TreeItem.tsx` Badge Display**

- **File:** `src/components/TreeItem.tsx`
- **Locate:** The JSX block rendering status badges.
- **Action:** Remove the logic checking for `fileKind === 'overview'`. Only display badges for `isDisabled` (Binary/Skipped) or `isExcludedByDefault`.

  - **Replace the badge rendering block:**

    ```typescript
    // OLD complex block:
    // {(isDisabled || (fileData && fileData.fileKind === "overview")) &&
    //   fileData && ( ... )}
    // {!isDisabled && ... && isExcludedByDefault && ( ... )}

    // NEW Simplified block:
    {
      /* Display badge if disabled (Binary/Skipped) */
    }
    {
      isDisabled && fileData && (
        <span className="tree-item-badge">
          {fileData.isBinary ? "Binary" : "Skipped"}
        </span>
      );
    }
    {
      /* Display 'Excluded' badge only if NOT disabled and excluded by default */
    }
    {
      !isDisabled && isExcludedByDefault && (
        <span className="tree-item-badge excluded">Excluded</span>
      );
    }
    ```

**Step 5 & 6: Verify Frontend Filters and Store Actions**

- No code changes required here _if_ the previous steps involving removing `fileKind` filters were done correctly. Just mentally verify:
  - `FileList.tsx` filter for `displayableFiles` only checks `isSelected`, `!isBinary`, `!isSkipped`.
  - `useAppLogic.ts` filter for `selectedContentFilesCount` only checks `isSelected`, `!isBinary`, `!isSkipped`.
  - `projectStore.ts` filter in `toggleFolderSelection` only checks `!isBinary`, `!isSkipped`, and path conditions (no `fileKind` check).
  - `TreeItem.tsx` helper `getAllSelectableFilePaths` only checks `!isBinary`, `!isSkipped`, and path conditions (no `fileKind` check).

---

**Summary of Expected Outcome:**
After these changes:

- `.pastemax/prompt-overview` will be treated as `fileKind: 'regular'` and get the default `sectionId: 'project_files'`.
- It will appear in the `FileList` under the "Project" section when selected.
- It will not have a special "Overview" badge in the `TreeItem`.
- Checkboxes for the `.pastemax` directory and the file itself will function correctly like any other directory/file.
- The "Include Overview" toggle will still correctly find the file _by its path_ and prepend its content when activated.
- If the file is selected, its raw content will be included in the main "Project Files" section of the output.
