Okay, Agent, let's embark on this refactoring mission for PasteMax.

**Project Goal & Refactoring Strategy**

The primary goal is to significantly improve the state management within the PasteMax application by migrating from a combination of component-level `useState`, `useEffect` for manual persistence, and prop drilling to a centralized approach using the **Zustand** library.

**Why Refactor?**

- **Complexity:** The main `App.tsx` component has become overly complex, managing too much state and logic.
- **Prop Drilling:** State and update functions are passed down through multiple component layers, making the code harder to follow and maintain.
- **Manual Persistence:** State persistence to `localStorage` is handled manually using `useEffect` and utility functions (`storageUtils.ts`), which is verbose and error-prone.

**Chosen Strategy: Single Zustand Store with Persistence**

1.  **Single Store (`useAppStore`):** We will create _one_ central Zustand store to manage the application's state.
2.  **Unified State:** This store will hold _all_ relevant state, including:
    - Global UI settings (like the color `theme`).
    - Global application state (like `lastSelectedFolder`, `recentFolders`).
    - Project-specific states (like `selectedFiles`, `sortOrder`, `expandedNodes`, etc., nested within a `projectStates` object keyed by folder path).
    - Transient state needed during runtime (like `allFiles`, `processingStatus`).
3.  **Zustand `persist` Middleware:** We will leverage Zustand's built-in `persist` middleware to automatically save and rehydrate the necessary parts of the store (`theme`, `lastSelectedFolder`, `recentFolders`, `projectStates`) to/from `localStorage` under a _single key_. This eliminates the need for manual saving/loading logic and the `storageUtils.ts` file.
4.  **Immutability:** All state updates, especially within the nested `projectStates` object, _must_ be performed immutably.
5.  **TypeScript:** Utilize strong typing for the store's state and actions.
6.  **Component Refactoring:** Components will be updated to read state and call actions directly from the Zustand store, significantly reducing the props they receive.

**Let's Begin!**

---

**Step 1: Create the Zustand Store (`src/store/useAppStore.ts`)**

1.  **Create File:** `src/store/useAppStore.ts`.
2.  **Import Dependencies:** Import `create` from `zustand`, `persist`, `createJSONStorage` from `zustand/middleware`, relevant types (`FileData`, etc.), constants (`DEFAULT_SORT_ORDER`, `MAX_RECENT_FOLDERS`, `ThemeValue`, etc. - **ensure `ThemeValue` is defined, e.g., `'light' | 'dark' | 'system'`**), and `normalizePath`.
3.  **Define Interfaces:**
    - `ProcessingStatus`: `{ status: 'idle' | 'processing' | 'complete' | 'error'; message: string; }`
    - `ProjectSpecificState`: Define this interface containing fields like `selectedFiles: string[]`, `expandedNodes: string[]`, `sortOrder: SortOrderValue`, `searchTerm: string`, `fileListView: FileListViewValue`, `includeFileTree: boolean`, `includePromptOverview: boolean`, `lastAccessed?: number`.
    - `AppState`: Define the main state interface. Include:
      - `theme: ThemeValue;`
      - `lastSelectedFolder: string | null;`
      - `recentFolders: string[];`
      - `projectStates: Record<string, ProjectSpecificState>;`
      - `allFiles: FileData[];` (Transient)
      - `processingStatus: ProcessingStatus;` (Transient)
      - Signatures for _all_ actions listed below.
4.  **Define `initialProjectState`:** Create a constant holding the default values for a `ProjectSpecificState` object.
5.  **Implement `create(persist(...))`:**
    - Use `create<AppState>()(persist((set, get) => ({ ... }), { ... }))`.
    - **Initial State:** Define the initial values for the store (e.g., `theme: 'system'`, `lastSelectedFolder: null`, `recentFolders: []`, `projectStates: {}`, `allFiles: []`, `processingStatus: { status: 'idle', message: '' }`).
    - **Helper Action `getStateForCurrentFolder`:** Implement a getter action `getStateForCurrentFolder: () => ProjectSpecificState` that reads `get().lastSelectedFolder` and returns `get().projectStates[folder] || initialProjectState`. This centralizes access to the current project's settings.
    - **Implement Actions:** Define the implementation for _all_ necessary actions within the `set/get` callback.
      - `setTheme: (theme: ThemeValue) => void;` (Simple `set({ theme })`)
      - `setActiveProject: (folderPath: string | null) => void;` (Updates `lastSelectedFolder`, ensures `projectStates[folderPath]` exists, updates `recentFolders` immutably, clears `allFiles`, resets `processingStatus`).
      - `resetStateForExit: () => void;` (Sets `lastSelectedFolder` to `null`, clears `allFiles`, resets `processingStatus`).
      - `setAllFiles: (files: FileData[]) => void;`
      - `setProcessingStatus: (status: ProcessingStatus) => void;`
      - **Project-State Modifying Actions:** For actions like `toggleFileSelection`, `toggleFolderSelection`, `selectAllFiles`, `deselectAllFiles`, `setSortOrder`, `setSearchTerm`, `setFileListView`, `toggleExpandedNode`, `setIncludeFileTree`, `setIncludePromptOverview`:
        - Get the `folder = get().lastSelectedFolder`. Return early if `!folder`.
        - Get the `projectState = get().getStateForCurrentFolder();`.
        - Calculate the new value for the specific property (e.g., `newSelection`, `newSortOrder`).
        - Use `set(state => ({ projectStates: { ...state.projectStates, [folder]: { ...projectState, propertyToChange: newValue, lastAccessed: Date.now() } } }))` for **immutable updates**.
      - `removeRecentFolder: (folderPath: string) => void;` (Use `set(state => ({ recentFolders: state.recentFolders.filter(...) }))`).
    - **Configure `persist` Middleware:** Pass the configuration object as the second argument to `persist`.
      - `name: 'pastemax-storage'` (Single key for localStorage).
      - `storage: createJSONStorage(() => localStorage)`.
      - `partialize: (state) => ({ theme: state.theme, lastSelectedFolder: state.lastSelectedFolder, recentFolders: state.recentFolders, projectStates: state.projectStates })` (Specify exactly what gets saved).
      - `onRehydrateStorage`: Add basic logging for success/error during rehydration.
      - `version`: (Optional) Set to `1`.
6.  **Define `useCurrentProjectState` Hook:** Export a custom hook `export const useCurrentProjectState = () => { ... }` that uses `useAppStore` to select `lastSelectedFolder` and `projectStates` and returns `projectStates[lastSelectedFolder] || initialProjectState`.

---

**Step 2: Remove ThemeContext**

1.  **Delete File:** Delete `src/context/ThemeContext.tsx`.
2.  **Remove Provider:** Find where `<ThemeProvider>` wraps your application (likely in `src/App.tsx` or potentially `src/main.tsx`) and remove the wrapper component.
3.  **Remove Imports:** Search the project for any imports from `ThemeContext.tsx` and remove them.

---

**Step 3: Refactor `App.tsx`**

1.  **Remove Imports:** Remove imports for `useState`, most `useEffect`, most `useCallback`, all functions from `storageUtils.ts`, `ThemeContext`, `useTheme`.
2.  **Import Zustand:** Import `useAppStore`, `useCurrentProjectState`, and `shallow`.
3.  **Remove State:** Delete all `useState` declarations for state now managed by Zustand. Keep `useState` only for local UI state (like `sortDropdownOpen`).
4.  **Access Zustand State:** Use `useAppStore` (often with `shallow` for object selectors) to get `lastSelectedFolder`, `allFiles`, `processingStatus`, `recentFolders`, `theme`. Use `useCurrentProjectState` to get `selectedFiles`, `sortOrder`, `searchTerm`, `fileListView`, `expandedNodes`, `includeFileTree`, `includePromptOverview`.
5.  **Access Zustand Actions:** Get all necessary action functions (e.g., `setActiveProject`, `setAllFiles`, `setProcessingStatus`, `setTheme`, etc.) from `useAppStore`.
6.  **Implement Theme Effect:** Create a new `useEffect` hook that:
    - Depends on the `theme` state from `useAppStore`.
    - Inside the effect:
      - Determine the actual theme to apply ('light' or 'dark'), checking system preference if `theme` is 'system'. Use `window.matchMedia('(prefers-color-scheme: dark)')`.
      - Add or remove the `dark-mode` class from `document.body`.
      - If `theme` is 'system', add a listener for changes to the system preference media query. Return a cleanup function to remove this listener.
7.  **Refactor IPC `useEffect`:**
    - Keep the effect that sets up IPC listeners (`window.electron.ipcRenderer.on`).
    - Modify the callback handlers (`handleFolderSelected`, `handleFileListData`, `handleProcessingStatus`) to call the corresponding Zustand _actions_ (`setActiveProject`, `setAllFiles`, `setProcessingStatus`) instead of `setState`. Ensure `handleFolderSelected` calls `setActiveProject` _before_ sending the `request-file-list` IPC message. Ensure `handleFileListData` correctly uses the _current_ `lastSelectedFolder` (possibly via `useAppStore.getState().lastSelectedFolder`) when calling `categorizeFile`.
8.  **Refactor Initial Load `useEffect`:**
    - Keep the effect that runs on mount.
    - It should _synchronously_ check `useAppStore.getState().lastSelectedFolder` (this value is available immediately after hydration from `persist`).
    - If a folder exists, set the `initialLoadTriggered` ref and send the `request-file-list` IPC message (checking the `__force_refresh_requested` localStorage flag as before). Call `setProcessingStatus`.
    - If no folder exists, simply set the `initialLoadTriggered` ref.
9.  **Remove Persistence `useEffect`s:** Delete all `useEffect` hooks that were previously used only to call `saveLastSelectedFolder`, `saveRecentFolders`, or `updateProjectProperty`. Persistence is now handled by Zustand.
10. **Refactor Callbacks:** Update all other callback functions (`openFolder`, `refreshOrReloadFolder`, `handleSortChange`, `handleSearchChange`, `handleViewChange`, `selectAllFiles`, `deselectAllFiles`, `toggleExpanded`, `handleSelectRecentFolder`, `handleRemoveRecentFolder`, `handleExitFolder`) to:
    - Read necessary current state (like `lastSelectedFolder`) directly using `useAppStore.getState()` if needed within the callback scope.
    - Call the appropriate Zustand actions (e.g., `setSortOrder`, `setSearchTerm`, `resetStateForExit`).
11. **Calculate Derived State:** Keep the `useMemo` hooks for `displayedFiles` and `totalTokens`. Ensure they read their input state correctly from Zustand (using `allFiles` and the results of `useCurrentProjectState`). Update their dependency arrays.
12. **Update `getSelectedFilesContent`:** Keep this `useCallback`. Update it to read all necessary inputs (`allFiles`, `lastSelectedFolder`, and specific project settings like `selectedFiles`, `sortOrder`, `include...` via `useAppStore.getState()` or `get().getStateForCurrentFolder()` if defined inside the store) to generate the output string.
13. **Update Rendering:**
    - Remove the `<ThemeProvider>` wrapper.
    - Pass fewer props to child components (`Sidebar`, `FileList`).
    - Ensure components like `FileListToggle`, `FileTreeToggle`, and the header buttons read the correct state from Zustand/`useCurrentProjectState` and call the correct Zustand actions via their props (`view`, `checked`, `onChange`).

---

**Step 4: Refactor Child Components**

For _each_ relevant child component (`ThemeToggle`, `Sidebar`, `TreeItem`, `FileCard`, `FileList`, potentially others):

1.  **Imports:** Add imports for `useAppStore`, `useCurrentProjectState` (where needed), and `shallow`. Remove imports like `useTheme` if applicable (`ThemeToggle`).
2.  **Props:** Analyze the component's props. Remove any props that provide state values or action functions now available directly from the Zustand store. Update the component's `Props` interface accordingly.
3.  **State/Action Access:** Use `useAppStore` or `useCurrentProjectState` hooks to get the required state slices or specific action functions. Use `shallow` for object selectors from `useAppStore`.
4.  **Update Logic/Handlers:** Modify the component's internal logic and event handlers:
    - Read state values directly from the hooks.
    - Call action functions obtained from the hooks in event handlers (e.g., `onClick`, `onChange`).
    - For components like `TreeItem` or `FileCard`, recalculate derived state like `isSelected` based on the state from the store.

**Specific Component Notes:**

- **`ThemeToggle`:** Remove `useTheme`. Use `useAppStore` to get `theme` and `setTheme`. Update buttons' `onClick` handlers.
- **`Sidebar`:** Remove most props. Use store hooks for `allFiles`, `lastSelectedFolder`, `searchTerm`, `expandedNodes`, `setSearchTerm`, `selectAllFiles`, `deselectAllFiles`. Keep tree building logic but adapt inputs. Pass only `node` prop to `TreeItem`.
- **`TreeItem`:** Remove most props. Use `useCurrentProjectState` for `selectedFiles`/`expandedNodes`. Use `useAppStore` for actions (`toggleFileSelection`, `toggleFolderSelection`, `toggleExpandedNode`). Update selection/expansion logic.
- **`FileCard`:** Remove `isSelected`/`toggleSelection` props. Use `useCurrentProjectState` for `selectedFiles`. Use `useAppStore` for `toggleFileSelection`. Update selection logic and button handler.
- **`FileList`:** Change props to receive `files={displayedFiles}` from `App.tsx`. Use `useAppStore` for `fileListView` and `lastSelectedFolder`. Update props passed to `FileCard`.

---

**Step 5: Clean up `storageUtils.ts`**

1.  **Delete File:** Delete the `src/utils/storageUtils.ts` file.
2.  **Remove Imports:** Search the entire project and remove any remaining imports from `storageUtils.ts`.

---

**Step 6: Verification & Testing**

1.  **Lint & Build:** Run `npm run lint` and `npm run build`. Fix any errors.
2.  **Run:** Start the app using `npm run dev:electron`.
3.  **Test Thoroughly:** Perform comprehensive manual testing covering all aspects:
    - Initial load (with/without last folder).
    - Folder switching.
    - File/Folder selection persistence _per project_.
    - Sorting/Filtering/View persistence _per project_.
    - Include Toggles persistence _per project_.
    - Theme switching and persistence (including 'system' preference).
    - Recent folders functionality (add, select, remove).
    - Copy functionality (main button and file buttons).
    - Refresh/Reload functionality.
    - Edge cases (empty folders, etc.).
    - Check developer console for errors.

---

This detailed plan provides the necessary steps and considerations. Focus on implementing one step at a time, ensuring immutability, and testing frequently. Good luck!
