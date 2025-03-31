Okay, here is a prompt for the Cursor agent, explaining the context, the goal, and the proposed implementation for the improved welcome screen with recent folders.

````prompt
**Project:** PasteMax (Electron + React with Vite)

**Goal:** Enhance the initial welcome screen shown when no folder is selected. The current screen (implemented with a basic `div.initial-prompt`) should be improved to resemble the VS Code welcome screen, specifically by adding a list of recently opened folders that the user can click to quickly reopen them. The welcome screen should be centered vertically and horizontally.

**Current Situation:**
The React component `src/App.tsx` currently renders the following basic welcome message when the `selectedFolder` state is null or empty:

```jsx
{!selectedFolder && (
  <div className="initial-prompt">
    <h2>Welcome to PasteMax!</h2>
    <p>Please select a project folder to begin.</p>
    <button className="select-folder-btn large" onClick={openFolder}>
      Select Folder
    </button>
  </div>
)}
````

The main application logic, including state management (`useState`) for `selectedFolder`, `allFiles`, `selectedFiles`, etc., and IPC communication, resides in `src/App.tsx`. State is persisted using `localStorage` under keys defined in `STORAGE_KEYS`. The `openFolder` function triggers an IPC call to `main.js` to show the folder selection dialog.

**Requested Enhancement: Implement Recent Folders Functionality**

**1. State Management:**

- Introduce a new state variable in `App.tsx` to store an array of recent folder paths (strings), e.g., `recentFolders`.
- Initialize this state by reading from `localStorage` using a new key (e.g., `STORAGE_KEYS.RECENT_FOLDERS = "pastemax-recent-folders"`). Handle potential JSON parsing errors.
- Persist the `recentFolders` state back to `localStorage` whenever it changes using a `useEffect` hook.

**2. Updating Recent Folders:**

- Create a helper function, e.g., `updateRecentFolders(newPath: string)`, inside `App.tsx`.
- This function should:
  - Take the newly selected folder path as input.
  - Remove the `newPath` from the existing `recentFolders` array (if it exists) to avoid duplicates and ensure it moves to the top.
  - Prepend the `newPath` to the beginning of the array.
  - Limit the array length to a reasonable maximum (e.g., `MAX_RECENT_FOLDERS = 10`).
  - Update the `recentFolders` state with the new array.
- Call this `updateRecentFolders` function in two places:
  - Inside `handleFolderSelected` after a folder is successfully chosen via the dialog.
  - Inside the initial data loading `useEffect` (the one dependent on `[isElectron, selectedFolder]`) to ensure the folder loaded from `localStorage` on startup is also marked as recent.

**3. Welcome Screen JSX Structure:**

- Modify the JSX rendered when `!selectedFolder` is true.
- Use a main container div (`.initial-prompt`) styled to center its content both vertically and horizontally within the available space (use Flexbox).
- Inside, have a content div (`.initial-prompt-content`) for the welcome message, main "Select Folder" button, and the recent folders list.
- Conditionally render the "Recent Folders" section only if the `recentFolders` state array is not empty.
- Use a `ul` (`.recent-folders-list`) to display the recent folders.
- Map over the `recentFolders` array. For each `folderPath`:
  - Render an `li` containing a clickable element (e.g., a `<button>`).
  - Display the folder name nicely (using the `basename` utility function from `src/utils/pathUtils.ts` - ensure it's imported).
  - Display the full `folderPath` below the name (perhaps smaller and greyed out).
  - Set the `title` attribute of the button to the full `folderPath` for tooltip hover.

**4. Handling Clicks on Recent Folders:**

- Create a new function in `App.tsx`, e.g., `selectRecentFolder(folderPath: string)`.
- When a recent folder item (the button created in step 3) is clicked, it should call `selectRecentFolder` with the corresponding `folderPath`.
- This function should:
  - Set the `selectedFolder` state to the clicked `folderPath`.
  - Clear related states (`allFiles`, `displayedFiles`, `selectedFiles`, `searchTerm`, `expandedNodes`).
  - Set the `processingStatus` to indicate loading.
  - Send the `request-file-list` IPC message to `main.js` with the `folderPath`.
  - Call `updateRecentFolders(folderPath)` to move the selected recent folder to the top of the list.

**5. Styling (CSS):**

- Add CSS rules to `src/styles/index.css` for:
  - `.initial-prompt`: To achieve full-height flex container with `align-items: center` and `justify-content: center`. Add `overflow-y: auto` in case content exceeds height.
  - `.initial-prompt-content`: To set a `max-width` and use flex column layout with appropriate `gap`.
  - `.recent-folders-section`: To add spacing and a top border.
  - `.recent-folders-list`: Basic list styling (remove bullets), potentially `max-height` and `overflow-y: auto`.
  - `.recent-folder-item`: Style as a clickable list item/button (full width, padding, borders, hover effects).
  - `.recent-folder-name`, `.recent-folder-path`: Styling for text elements within the list item.

**Implementation Notes & Suggestions:**

- The proposed plan outlines a solid approach.
- Feel free to use slightly different state names or function names if it makes more sense contextually.
- Ensure error handling is included, especially when parsing JSON from `localStorage`.
- Consider edge cases, like what happens if a recent folder path no longer exists on the filesystem (currently, selecting it might just result in an empty file list, which is acceptable, but something to be aware of).
- Pay attention to imports (like `basename` from `pathUtils`).
- If you see opportunities for further refinement or a more elegant solution while implementing, please proceed with the better approach. The core goal is a functional and visually appealing welcome screen with a working recent folders list.

Please implement these changes in `src/App.tsx` and add the necessary styles to `src/styles/index.css`.

```

```
