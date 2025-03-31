MOJ PROMPT GEMINI 2.5 MODELU:

V App.tsx imam to kodo:
{!selectedFolder && (
<div className="initial-prompt">
<div className="initial-prompt-content">
<div>
<h2>PasteMax</h2>
<button
                  className="select-folder-btn large"
                  onClick={openFolder}
                >
Select Folder
</button>
</div>

              {recentFolders.length > 0 && (
                <div className="recent-folders-section">
                  <div className="recent-folders-title">Recent folders</div>
                  <ul className="recent-folders-list">
                    {recentFolders.map((folderPath: string, index: number) => (
                      <button
                        key={index}
                        className="recent-folder-item"
                        onClick={() => selectRecentFolder(folderPath)}
                        title={folderPath}
                      >
                        <span className="recent-folder-name">
                          {basename(folderPath)}
                        </span>
                        <span className="recent-folder-path">{folderPath}</span>
                      </button>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

Ta blok kode se pojavi na zacetku, ce folder ni izbran. Ko pa enkrat izberem folder se pojavi drugi del kode, torej celoten interface:
{selectedFolder && (
<div className="main-content">
<Sidebar
...ostala koda

Zdaj nimam nacina, da exitam ta view, da bi prisel nazaj na zacetek, razen ce v dev tools odprem Application / Local Storage in izbrisem "pastemax-selected-folder" in potem kliknem "view / reload". Namesto tega bi si zelel, da bi desno od "Reload" buttona:
<button class="select-folder-btn">Reload</button>

implementirali dodatni gumb "Exit", ki bi moj rocni postopek avtomatiziral, da spet pridem nazaj na zacetek. Pripravi prompt za cursor agenta za implementacijo prosim.

ODGOVOR GEMINI 2.5 MODELA:

Jasno, razumem. Želiš gumb "Exit", ki te vrne na začetni zaslon za izbiro mape, tako da počisti trenutno izbrano mapo in povezano stanje.

Tukaj je prompt za Cursor Agent, ki opisuje nalogo:

````prompt
Subject: Implement "Exit Folder" Button in PasteMax UI

Hi Cursor Agent,

**Context:**
In the `src/App.tsx` component of my Electron application (PasteMax), there are two main conditional rendering blocks:
1.  An initial prompt screen displayed when `!selectedFolder`. This screen shows a "Select Folder" button and recent folders.
2.  The main application interface (Sidebar, FileList, etc.) displayed when `selectedFolder` has a value.

Currently, once a folder is selected, there is no direct UI element to go back to the initial prompt screen. The only way is to manually clear the `pastemax-selected-folder` key from Local Storage via DevTools and reload the application.

**Objective:**
Add an "Exit" button to the main application interface, positioned next to the existing "Reload" button. Clicking this "Exit" button should programmatically:
1.  Clear the currently selected folder state (`selectedFolder`).
2.  Remove the `pastemax-selected-folder` key from Local Storage.
3.  Reset any other relevant state variables (like `allFiles`, `selectedFiles`, `searchTerm`, `displayedFiles`, `processingStatus`) to their initial empty/default values to ensure a clean state upon returning to the initial prompt.
4.  This should result in the UI automatically switching back to the initial prompt screen (`!selectedFolder` condition becomes true).

**Target File:**
`src/App.tsx`

**Implementation Steps:**

1.  **Locate the "Reload" button:** Find the `<button>` element responsible for the "Reload" action within the JSX block that renders when `selectedFolder` is truthy. It likely looks similar to this (inside the `.header-actions` or `.folder-info` div):
    ```jsx
    {selectedFolder && (
      <button
        className="select-folder-btn"
        onClick={reloadFolder} // Or similar handler
        disabled={processingStatus.status === 'processing'}
      >
        Reload
      </button>
    )}
    ```
2.  **Add the "Exit" Button:** Immediately after the "Reload" button (or logically grouped with it), add a new `<button>` element:
    *   Label it "Exit".
    *   Give it appropriate styling, likely using the same `className="select-folder-btn"`.
    *   Ensure it's also conditionally rendered only when `selectedFolder` is set.
    *   It should *not* be disabled based on `processingStatus`.
3.  **Define Handler Function:** Create a new asynchronous function within the `App` component, for example, `handleExitFolder`.
4.  **Implement Exit Logic:** Inside `handleExitFolder`:
    *   Set the `selectedFolder` state to `null`: `setSelectedFolder(null);`
    *   Remove the folder path from Local Storage: `localStorage.removeItem(STORAGE_KEYS.SELECTED_FOLDER);`
    *   Reset other relevant states:
        *   `setAllFiles([]);`
        *   `setSelectedFiles([]);`
        *   `setSearchTerm('');`
        *   `setDisplayedFiles([]);`
        *   `setProcessingStatus({ status: 'idle', message: '' });`
        *   *(Consider resetting `expandedNodes = {}` as well if desired)*
5.  **Attach Handler:** Assign the `handleExitFolder` function to the `onClick` prop of the newly created "Exit" button.

**Improvements:**
Feel free to adjust the implementation slightly (e.g., state reset details, function naming) if you see a more robust or cleaner way, but the core goal is to provide a one-click mechanism to return to the initial state.

**Goal:**
After implementation, when a folder is selected and the main UI is visible, clicking the new "Exit" button should immediately clear the selection and display the initial "Select Folder" prompt screen without requiring a manual page reload or DevTools intervention.

Thanks!
````
