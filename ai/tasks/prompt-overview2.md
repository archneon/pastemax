**Zakaj je značka izginila:**

Značka "Overview" (skupaj z "Binary" in "Skipped") se je v komponenti `TreeItem.tsx` izrisala samo pod pogojem, da je bila konstanta `isDisabled` nastavljena na `true`. Ker smo iz pogoja za `isDisabled` odstranili `fileData.fileKind === 'overview'`, je `isDisabled` za to datoteko postala `false` (kar je omogočilo checkbox), ampak hkrati skrilo značko.

**Popravek:**

Želimo, da je značka "Overview" vidna, čeprav datoteka ni več onemogočena (`isDisabled` je `false`). Moramo prilagoditi logiko izrisa značk v `TreeItem.tsx`.

**Navodila za agenta (v angleščini):**

---

**Objective:** Restore the visibility of the "Overview" badge next to the `.pastemax/prompt-overview` file in the sidebar file tree, even though the item is no longer disabled (checkbox is enabled).

**Problem:** The previous change correctly enabled the checkbox for the overview file by setting its `isDisabled` state to `false`. However, the badge rendering logic was tied to `isDisabled` being `true`, causing the "Overview" badge to disappear.

**Plan:** Modify the badge rendering logic in `src/components/TreeItem.tsx` to show the badge block if the item is either disabled _or_ if it's the specific `prompt-overview` file.

**Step-by-Step Instruction:**

1.  **Modify `src/components/TreeItem.tsx`:**

    - **File:** `src/components/TreeItem.tsx`
    - **Locate:** The JSX code block responsible for rendering the status badges (`<span className="tree-item-badge">...</span>`). It's likely inside the `tree-item-content` div, near the end.
    - **Action:** Adjust the outer conditional logic (`{isDisabled && fileData && ...}`) that wraps the main status badge (`Overview`/`Binary`/`Skipped`). The condition should now be true if `isDisabled` is true **OR** if `fileData.fileKind === 'overview'`. Keep the separate logic for the "Excluded" badge.

    - **Find this approximate code block:**
      ```typescript
      {
        isDisabled &&
          fileData && ( // This condition needs adjustment
            <span className="tree-item-badge">
              {/* ... logic for Overview/Binary/Skipped ... */}
            </span>
          );
      }
      {
        /* ... potentially other badges like 'excluded' ... */
      }
      ```
    - **Change it to the following:**

      ```typescript
      {
        /* Badge Logic: Show if the item is disabled OR if it's the special overview file */
      }
      {
        (isDisabled || fileData?.fileKind === "overview") && fileData && (
          <span className="tree-item-badge">
            {fileData.fileKind === "overview" // Check for overview first
              ? "Overview"
              : fileData.isBinary // Then check disabled reasons
              ? "Binary"
              : "Skipped"}
          </span>
        );
      }

      {
        /* Separate handling for 'Excluded' badge (only shown if NOT disabled) */
      }
      {
        !isDisabled && isExcludedByDefault && (
          <span className="tree-item-badge excluded">Excluded</span>
        );
      }
      ```

---

**Summary of Change:** This modification ensures the main status badge container is rendered not only for genuinely disabled items (binary/skipped) but _also_ specifically for the overview file (even though it's not disabled anymore). The logic _inside_ the span correctly determines whether to display "Overview", "Binary", or "Skipped". The "Excluded" badge logic remains separate as it only applies to non-disabled items.
