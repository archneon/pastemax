MOJ PROMPT GEMINI 2.5 MODELU, DA PRIPRAVI PLAN ZA IMPLEMENTACJO ZA TEBE:

Pozdravljen! Rabim tvojo pomoc ;)
Ali lahko v electron appu, torej v user interface-u kliknes neki gumb ,recimo desni gumb in inspect element? Ker trenutno mi sicer dev tools odpre v locenem oknu ampak se zafrkavam ves cas, da odprem vse dive rocno, da pridem do zeljenega elementa? To bi rabil samo v dev nacinu, tako da mi bo lazje in hitreje dostopati. Ideja je, da bi bilo enako oz. podobno kot v Chrome browserju, ko lahko kliknes desni gumb in izberes inspect element in ti potem v "element" tabu expanda tocno tisti element, ki si ga inspectal.
Prilozil sem ti vso relevantno kodo projekta, prosim analiziraj in pripravi plan za implementacjio za Cursor Agent.

ODGOVOR GEMINI 2.5 MODELA JE BIL SLEDECI:

Okay, here is a prompt you can use for your Cursor Agent. It clearly outlines the goal, the proposed solution, and invites the agent to improve upon it if possible.

```prompt
Subject: Implement "Inspect Element" Context Menu for Development in Electron App

Hi Cursor Agent,

**Context:**
I'm working on an Electron application (project structure and relevant files provided). Currently, during development (`NODE_ENV === 'development'`), the DevTools open in a separate window (as configured in `main.js` and initiated by `dev.js`). However, there's no way to right-click on a specific UI element and have the DevTools jump directly to that element in the "Elements" tab, similar to how it works in standard web browsers. This makes debugging the UI layout and styles less efficient.

**Objective:**
Implement a right-click context menu option labeled "Inspect Element" that appears *only* when the application is running in development mode (`process.env.NODE_ENV === 'development'`). Clicking this option should open the DevTools (if not already open) and automatically select the clicked element in the DevTools "Elements" panel.

**Proposed Implementation (in `main.js`):**

1.  **Import necessary modules:** Ensure `Menu` and `MenuItem` are imported from the `electron` module at the top of `main.js`.
2.  **Locate insertion point:** Inside the `createWindow` function, find the section *after* the `mainWindow` `BrowserWindow` instance has been created.
3.  **Add `context-menu` listener:** Attach an event listener to `mainWindow.webContents` for the `'context-menu'` event.
4.  **Check environment:** Inside the listener callback, check if `process.env.NODE_ENV === 'development'`.
5.  **Create dynamic menu:** If in development mode:
    *   Instantiate a new `Menu`.
    *   Append a `MenuItem` with the `label: 'Inspect Element'`.
    *   The `click` handler for this `MenuItem` should execute `mainWindow.webContents.inspectElement(params.x, params.y)`, where `params` is the second argument received by the `'context-menu'` event listener, containing the click coordinates.
    *   *(Optional but recommended enhancement)*: Inside the `click` handler, add a check: `if (mainWindow.webContents.isDevToolsOpened()) { mainWindow.webContents.devToolsWebContents?.focus(); }` to bring already opened DevTools to the foreground.
6.  **Display the menu:** Call `menu.popup({ window: mainWindow, x: params.x, y: params.y });` to show the created context menu at the click location.
7.  **No default menu in production:** Ensure that if not in development mode, no custom context menu (or the default one, unless desired) appears on right-click due to this specific listener.

**Task:**
Please analyze the provided project files (especially `main.js` and `dev.js` for context) and implement the "Inspect Element" functionality as described above.

**Improvements:**
If you identify any potential issues with this approach or see opportunities for refinement or better integration with the existing codebase while achieving the same goal, please feel free to implement your improved solution and briefly explain the changes.

**Goal:**
The final result should allow me to right-click any element in the application's UI during development, select "Inspect Element", and have the DevTools focus on that specific element, significantly speeding up UI debugging.

Thanks!
```
