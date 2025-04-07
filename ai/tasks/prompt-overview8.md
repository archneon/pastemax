**Objective:** Fix the "Include Overview" toggle switch in `App.tsx` which is always disabled, even when the `.pastemax/prompt-overview` file exists and is not empty.

**Reasoning:** The `disabled` state of the toggle is controlled by the `hasOverviewFile` variable calculated in the `useAppLogic` hook. This calculation currently tries to find the overview file using `allFiles.find((file) => file.fileKind === "overview")`. Since we changed the `fileKind` of this file to `'regular'` in the backend, this `find` method no longer works, always resulting in `hasOverviewFile` being `false`.

**Plan:** Modify the calculation of `hasOverviewFile` in `src/hooks/useAppLogic.ts` to find the overview file based on its expected **path** instead of its `fileKind`.

**Step-by-Step Instructions:**

**Step 1: Update `hasOverviewFile` Calculation in `useAppLogic.ts`**

- **File:** `src/hooks/useAppLogic.ts`
- **Locate:** The `useMemo` hook that calculates the `hasOverviewFile` constant.
- **Action:** Change the logic inside the `useMemo` hook to find the file using `normalizePath` and its expected path, similar to how it's done in `promptUtils.ts`. Import necessary constants (`PASTEMAX_DIR`, `PROMPT_OVERVIEW_FILENAME`) if not already imported.

  - **Find this block:**
    ```typescript
    const hasOverviewFile = useMemo(() => {
      const overviewFile = allFiles.find(
        (file) => file.fileKind === "overview"
      ); // <-- PROBLEM HERE
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
  - **Change it to:**

    ```typescript
    // Import these at the top if needed
    import { PASTEMAX_DIR, PROMPT_OVERVIEW_FILENAME } from "../constants";
    // ... other imports ...

    // Inside useAppLogic hook...
    const hasOverviewFile = useMemo(() => {
      // Find by path now
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

      // The rest of the logic remains the same
      const existsAndNotEmpty = !!(
        overviewFile &&
        overviewFile.content &&
        overviewFile.content.trim().length > 0
      );
      logger.debug(
        `useAppLogic: Calculated hasOverviewFile: ${existsAndNotEmpty}`
      );
      return existsAndNotEmpty;
      // Dependencies should now include selectedFolder as the path depends on it
    }, [allFiles, selectedFolder]); // <-- ADD selectedFolder to dependencies
    ```

This change aligns the logic for finding the overview file in `useAppLogic` with the approach now used in `promptUtils`, relying on the file's path rather than the `fileKind` property which we repurposed.
