MOJ PROMPT ZA GEMINI 2.5 MODEL:

Zgoraj sem ti prilepil project code mojega electron app-a.

1. V App.tsx , v "initial-prompt" containerju (div-u) ,kjer imamo izpisan spisek zadnjih recent importanih projektov sem ugotovil, da ne preverjamo ce direktorij se sploh obstaja. Pomoje bi vedno, ko se ta view nalozi (oz ko izberemo "view / reload" sistemsko opcijo ali pa na novo zazenemo projekt) morali preveriti obstoj vseh direktorijev (pastemax-recent-folders) in bi tiste ,ki ne obstajajo izbrisali.

2. Hkrati bi morali izlociti duplicated records iz pastemax-recent-folders v locale storage-u.

Naredi plan za implementacijo in napisi prompt za mojega Cursor agenta. Daj mu navodila kako naj to implementira v angleskem jeziku.

ODGOVOR GEMINI 2.5 MODEL:

Odlično, prijatelj! To sta dobri izboljšavi za robustnost aplikacije.

**Plan Implementacije**

1.  **Deduplikacija (Renderer - `App.tsx`):**

    - Pri branju `recentFolders` iz `localStorage` ob zagonu aplikacije bomo uporabili `Set` za takojšnjo odstranitev duplikatov.
    - Funkcija `updateRecentFolders` že implicitno skrbi za deduplikacijo med posodabljanjem (ker najprej odstrani obstoječo pot), tako da tukaj ni potrebna sprememba, razen da zagotovimo, da je začetno stanje že deduplicirano.

2.  **Validacija Obstojnosti Direktorijev (Renderer <-> Main):**
    - **`preload.js`:** Definirali bomo dva nova IPC kanala:
      - `validate-recent-folders`: Za pošiljanje seznama poti iz rendererja v main proces.
      - `validated-recent-folders`: Za prejemanje očiščenega seznama (samo obstoječe poti) iz main procesa nazaj v renderer.
      - Posodobili bomo `validChannels` v `contextBridge.exposeInMainWorld`.
    - **`main.js`:**
      - Dodali bomo nov `ipcMain.on('validate-recent-folders', ...)` listener.
      - Ta listener bo prejel seznam poti.
      - Asinhrono (z uporabo `fs.promises.stat` ali `fs.promises.access`) bo preveril obstojnost vsakega direktorija. Uporaba `existsSync` ni priporočljiva, ker blokira main proces.
      - Filtriral bo seznam in obdržal samo poti do obstoječih direktorijev.
      - Poslal bo filtriran seznam nazaj v renderer preko `event.sender.send('validated-recent-folders', validPaths)`.
      - Dodali bomo osnovno obravnavo napak (`try...catch`).
    - **`App.tsx`:**
      - V `useEffect` kaveljčku, ki se zažene ob zagonu (ali v ločenem kaveljčku za `recentFolders`), ko se naloži stanje iz `localStorage`:
        - Preberemo in dedupliciramo seznam poti.
        - Če `isElectron`, pošljemo dedupliciran seznam v main proces preko `window.electron.ipcRenderer.send('validate-recent-folders', paths)`.
        - Nastavimo listener `window.electron.ipcRenderer.on('validated-recent-folders', ...)`:
          - Ko prejmemo odgovor (filtriran seznam obstoječih poti), posodobimo stanje `recentFolders`.
          - Posodobimo `localStorage` z očiščenim seznamom.
        - Listener počistimo v `return` funkciji `useEffect`.
      - To validacijo bomo izvedli samo, ko se komponenta prvič naloži ali ko se uporabnik vrne na začetni zaslon (`initial-prompt`).

---

**Prompt za Cursor Agenta (v angleščini):**

```prompt
Okay, let's improve the "Recent Folders" functionality in the PasteMax Electron/React application. We need to implement two main enhancements:

1.  **Deduplicate Recent Folders:** Ensure that the list of recent folders stored in `localStorage` (`pastemax-recent-folders`) does not contain duplicate entries.
2.  **Validate Directory Existence:** Before displaying the recent folders list in the `initial-prompt` view, verify that each directory path actually exists on the filesystem. Remove entries for non-existent directories from the state and `localStorage`.

**Files to Modify:**

*   `src/App.tsx` (Renderer Process)
*   `main.js` (Main Process)
*   `preload.js` (Bridge)

**Implementation Steps:**

**1. `preload.js`:**
    *   Define two new IPC channels:
        *   `validate-recent-folders`: For sending paths from renderer to main.
        *   `validated-recent-folders`: For receiving the validated list back from main.
    *   Add these channel names to the `validChannels` arrays within the `contextBridge.exposeInMainWorld('electron', { ... })` block for both `send` and `receive`/`ipcRenderer.on`.

**2. `main.js`:**
    *   Import the `fs` module, specifically `fs.promises` for asynchronous operations.
    *   Add a new IPC handler using `ipcMain.on('validate-recent-folders', async (event, folderPaths) => { ... })`.
    *   Inside the handler:
        *   Receive the `folderPaths` array.
        *   Use a `try...catch` block for error handling.
        *   Iterate through the `folderPaths` asynchronously. For each path, use `fs.promises.stat(path)` (or `fs.promises.access(path)`) to check if it exists *and is a directory*. Catch errors for non-existent paths.
        *   Filter the original `folderPaths` array, keeping only the paths that were successfully validated (exist and are directories).
        *   Send the filtered array (`validPaths`) back to the renderer using `event.sender.send('validated-recent-folders', validPaths)`.
        *   Log any errors encountered during validation.

**3. `src/App.tsx`:**
    *   **Initial Load/State Initialization:**
        *   When reading the initial `recentFolders` from `localStorage` (using `STORAGE_KEYS.RECENT_FOLDERS`), immediately deduplicate the array. You can use `Array.from(new Set(parsedFolders))` after parsing the JSON. Store this deduplicated list temporarily.
    *   **Validation Logic (within a `useEffect` hook):**
        *   Add a `useEffect` hook that runs when the component mounts or when the user returns to the initial view (e.g., when `selectedFolder` becomes `null`).
        *   Inside this effect, check if `isElectron` is true and if there are recent folders to validate.
        *   If yes, send the deduplicated list of paths (obtained during initial load) to the main process: `window.electron.ipcRenderer.send('validate-recent-folders', deduplicatedPaths)`.
        *   Set up an IPC listener *within the same effect*: `window.electron.ipcRenderer.on('validated-recent-folders', (validatedPaths) => { ... })`.
            *   Inside the listener callback:
                *   Update the `recentFolders` state with the `validatedPaths` received from the main process.
                *   Update `localStorage` (`STORAGE_KEYS.RECENT_FOLDERS`) with the stringified `validatedPaths`.
        *   **Crucially:** The listener should be set up *before* sending the request, and it *must* be cleaned up in the return function of the `useEffect` hook using `window.electron.ipcRenderer.removeListener('validated-recent-folders', handlerFunction)`. This prevents memory leaks and duplicate listeners.
    *   **`updateRecentFolders` Function:**
        *   Ensure this function correctly handles adding a *new* folder. It already removes the path if it exists before adding it to the front, which inherently handles deduplication *during updates*. No major change is likely needed here, but double-check that it operates on the potentially validated state. The core cleanup (validation and initial deduplication) happens on load/view change.

**Summary of Changes:**

*   Deduplicate the recent folders list upon reading from `localStorage` in `App.tsx`.
*   Implement an IPC round trip for directory existence validation:
    *   `App.tsx` sends paths to `main.js`.
    *   `main.js` checks paths asynchronously using `fs.promises` and sends back the valid ones.
    *   `App.tsx` receives the valid paths, updates its state, and updates `localStorage`.
*   Ensure the validation logic runs at appropriate times (e.g., app start, return to welcome screen).
*   Add necessary channels to `preload.js`.
*   Use asynchronous file system operations in `main.js`.
*   Include error handling.

Please implement these changes.
```
