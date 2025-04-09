MOJ PROMPT ZA GEMINI 2.5:

Razmisljam da bi v constants.ts v PROMPT_SECTIONS dodali 2 dodatna flaga v vse objekte v arrayu:
enega za removanje meta data from mdc files: Torej ce je flag na true in ce je se prebere mdc datoteka, bi imeli neki posebni util (v loceni. ts datoteki), ki bi odstranil meta data
drugi flag pa bi bil za zdruzevanje vseh pravil: Kot vidis imam pravila v razlicnih datotekah. To tebi kot AI-ju predstavlja verjetno samo balast, ti bi verjetno raje imel pravila assemblana skupaj iz vseh datotek in potem zlistana skupaj. Kaj menis o tem?

GEMINI 2.5 JE ODGOVORIL:

1.  **Metapodatki v `.mdc` datotekah:** Ti YAML bloki na vrhu (`--- ... ---`) so dejansko namenjeni Cursorju (ali podobnim orodjem), da razumejo, kako uporabiti pravilo (opis, kdaj ga uporabiti - `globs`, ali vedno - `alwaysApply`). Zame kot splošni AI model ti metapodatki dejansko _so_ balast. Ne vem, kaj pomenijo `globs` ali `alwaysApply` v kontekstu Cursorja, in samo povečujejo število tokenov in potencialno vnašajo šum v razumevanje _dejanskih_ pravil, ki sledijo. Odstranjevanje tega bloka pred kopiranjem bi bilo koristno.

2.  **Združevanje pravil:** Tudi tu imaš prav. Čeprav je prikaz vsake datoteke posebej s `FILE_START`/`FILE_END` markerji na splošno dobra praksa za večino izvorne kode, ker ohranja kontekst datoteke, je za _pravila_ verjetno bolj smiselno, da jih dobi model kot enoten, združen seznam. Lažje jih je prebrati in upoštevati kot celoto, namesto da skače med mnogimi majhnimi `FILE_START`/`FILE_END` bloki znotraj `RULES` ali `CURSOR_RULES` sekcije. Združevanje bi zmanjšalo število markerjev in naredilo pravila bolj direktna.

**Predlog Rešitve: Konfigurabilne Sekcije**

Tvoj predlog z dodajanjem flagov v definicijo `PROMPT_SECTIONS` je odličen način za implementacijo tega. Omogoča fleksibilnost, da se odločiš za vsako sekcijo posebej, kako naj se obnaša.

**Implementacijski Načrt**

Tukaj je podroben načrt, kako bi to lahko implementirali:

1.  **Definiraj Nove Flage v Tipu (`src/types/promptConfigTypes.ts`):**

    - Razširi interface `PromptSectionDefinition`, da vključuje nova _opcijska_ boolean flaga. Opcijska sta zato, da ne rabiš posodabljati vseh obstoječih definicij, če zanje ne želiš tega obnašanja.

    ```typescript
    // src/types/promptConfigTypes.ts
    export interface PromptSectionDefinition {
      id: string;
      name: string;
      label: string;
      directory: string | null;
      color: string;
      removeMdcMetadata?: boolean; // <-- NOVO: true za odstranitev --- bloka iz .mdc
      concatenateContent?: boolean; // <-- NOVO: true za združitev vsebine datotek v sekciji
    }
    ```

2.  **Posodobi Definicije Sekcij (`src/constants.ts`):**

    - Pojdi v `src/constants.ts` in dodaj nova flaga k definicijam za `RULES` in `CURSOR_RULES` (ali katerokoli drugo sekcijo, kjer želiš to obnašanje).

    ```typescript
    // src/constants.ts
    // ...
    export const PROMPT_SECTIONS: PromptSectionDefinition[] = [
      {
        id: "cursor_rules",
        name: "CURSOR_RULES",
        label: "Cursor Rules",
        directory: ".cursor/rules",
        color: "var(--accent-green)",
        removeMdcMetadata: true, // <-- DODANO
        concatenateContent: true, // <-- DODANO
      },
      {
        id: "rules",
        name: "RULES",
        label: "Rules",
        directory: "ai/rules",
        color: "var(--warning-color)",
        removeMdcMetadata: true, // <-- DODANO (če so tudi tukaj .mdc ali podobne datoteke)
        concatenateContent: true, // <-- DODANO (če želiš združiti tudi ta pravila)
      },
      // ... ostale sekcije (verjetno brez teh flagov, da ostanejo nespremenjene) ...
      {
        id: "project_files",
        name: "PROJECT_FILES",
        label: "Project",
        directory: null,
        color: "var(--accent-blue)",
        // removeMdcMetadata: false, // Ni potrebno, default je false/undefined
        // concatenateContent: false, // Ni potrebno, default je false/undefined
      },
      // ...
    ];
    // ...
    ```

3.  **Posodobi Definicije Sekcij (`constants.js`):**

    - Za konsistentnost dodaj flage tudi v `constants.js`. Backend jih sicer ne bo direktno uporabljal, a je dobra praksa.

    ```javascript
    // constants.js
    // ...
    const PROMPT_SECTIONS = [
      {
        id: "cursor_rules",
        name: "CURSOR_RULES",
        directory: ".cursor/rules",
        removeMdcMetadata: true, // Za konsistenco
        concatenateContent: true, // Za konsistenco
      },
      {
        id: "rules",
        name: "RULES",
        directory: "ai/rules",
        removeMdcMetadata: true, // Za konsistenco
        concatenateContent: true, // Za konsistenco
      },
      // ... ostale sekcije ...
    ];
    // ...
    ```

4.  **Ustvari Utility Funkcijo za Odstranjevanje Metapodatkov (`src/utils/formatUtils.ts` ali nova datoteka):**

    - Potrebujemo funkcijo, ki prejme vsebino datoteke in vrne vsebino brez YAML frontmatter bloka.

    ```typescript
    // src/utils/formatUtils.ts (ali npr. src/utils/metadataUtils.ts)

    // ... ostale funkcije ...

    /**
     * Odstrani YAML frontmatter (med ---) iz začetka stringa.
     * @param content Vsebina datoteke
     * @returns Vsebina brez frontmatter bloka.
     */
    export const removeMdcFrontmatter = (content: string): string => {
      if (!content || !content.startsWith("---")) {
        return content; // Nič za odstranit ali ni frontmatterja
      }

      const endOfFrontmatter = content.indexOf("\n---", 4); // Išči drugi '---' po prvem

      if (endOfFrontmatter === -1) {
        return content; // Ni našel končnega markerja, vrni original
      }

      // Najdi prvi prelom vrstice *po* končnem markerju
      let startOfContent = content.indexOf("\n", endOfFrontmatter + 4); // +4 za preskok '\n---'

      // Če ni preloma vrstice po markerju (morda je konec datoteke)
      if (startOfContent === -1) {
        // Preveri, ali je sploh kaj vsebine za markerjem
        if (content.length > endOfFrontmatter + 4) {
          startOfContent = endOfFrontmatter + 4; // Vzemi vse za markerjem
        } else {
          return ""; // Ni vsebine za markerjem
        }
      } else {
        startOfContent += 1; // Premakni se na začetek naslednje vrstice
      }

      return content.substring(startOfContent);
    };
    ```

    - **Ne pozabi importati** te nove funkcije v `src/utils/promptUtils.ts`.

5.  **Prilagodi Generiranje Vsebine (`src/utils/promptUtils.ts`):**

    - V funkciji `generatePromptContent` moraš prilagoditi zanko, ki iterira čez sekcije in datoteke.

    ```typescript
    // src/utils/promptUtils.ts
    import { FileData } from "../types/FileTypes";
    // --- DODAJ IMPORT ZA NOVO FUNKCIJO ---
    import {
      formatMarker,
      categorizeFile,
      removeMdcFrontmatter,
    } from "./formatUtils";
    // --- KONEC DODANEGA IMPORTA ---
    import {
      generateAsciiFileTree,
      getRelativePath,
      normalizePath,
      comparePathsStructurally,
    } from "./pathUtils";
    import logger from "./logger";
    import {
      PROMPT_SECTIONS, // <-- Ta že mora biti importan
      PROMPT_MARKERS,
      PASTEMAX_DIR,
      PROMPT_OVERVIEW_FILENAME,
    } from "../constants";
    import { PromptSectionDefinition } from "../types/promptConfigTypes"; // <-- Importaj tudi tip

    // ... interface PromptDataArgs ...

    export const generatePromptContent = (args: PromptDataArgs): string => {
      const {
        allFiles,
        selectedFiles,
        selectedFolder,
        sortOrder,
        includeFileTree,
        includePromptOverview,
      } = args;

      // ... (koda za selectedPathSet, contentFiles, overviewFile, sortiranje ostane enaka) ...

      // Initialize main output and track what sections are present
      let mainOutput = "";
      const presentSectionNames = new Set<string>();

      // ... (koda za PROJECT_TREE ostane enaka) ...

      // Process files by section
      const filesBySection: Record<string, FileData[]> = {};
      sortedContentFiles.forEach((file) => {
        // --- UPORABI DEFINICIJO IZ src/constants.ts ZA ISKANJE sectionId ---
        // Poišči ustrezno definicijo sekcije iz frontend konstant
        const sectionConfig = PROMPT_SECTIONS.find((sectionDef) => {
          if (sectionDef.directory === null) return false; // Preskoči default
          const relativePath = getRelativePath(file.path, selectedFolder);
          return relativePath.startsWith(sectionDef.directory + "/");
        });
        // Če ne najde posebne sekcije, uporabi default
        const defaultSectionConfig = PROMPT_SECTIONS.find(
          (s) => s.directory === null
        );
        const sectionId =
          sectionConfig?.id ?? defaultSectionConfig?.id ?? "project_files";
        // --- KONEC SPREMEMBE ZA sectionId ---

        if (!filesBySection[sectionId]) filesBySection[sectionId] = [];
        filesBySection[sectionId].push(file);
      });

      // Add sections to the output
      // --- SPREMENJENA ZANKA ZA OBDELAVO SEKCIJ ---
      for (const sectionConfig of PROMPT_SECTIONS) {
        // Iteriraj čez konfiguracijo
        const sectionFiles = filesBySection[sectionConfig.id];
        if (!sectionFiles || sectionFiles.length === 0) continue; // Preskoči prazne sekcije

        // Mark this section as present
        presentSectionNames.add(sectionConfig.name);

        // Add section start marker
        mainOutput +=
          formatMarker(PROMPT_MARKERS.section_open, {
            section_name: sectionConfig.name, // Uporabi ime iz konfiguracije
          }) + "\n\n";

        // Preveri, ali je treba vsebino združiti
        if (sectionConfig.concatenateContent) {
          logger.debug(
            `Concatenating content for section: ${sectionConfig.name}`
          );
          let combinedContent = "";
          sectionFiles.forEach((file) => {
            let fileContent = file.content || "";
            // Preveri, ali je treba odstraniti metapodatke
            if (sectionConfig.removeMdcMetadata && file.name.endsWith(".mdc")) {
              logger.debug(`Removing MDC metadata from: ${file.name}`);
              fileContent = removeMdcFrontmatter(fileContent);
            }
            // Dodaj separator med datotekami (npr. nova vrstica ali kaj bolj izrazitega)
            if (combinedContent.length > 0) {
              combinedContent += "\n\n---\n\n"; // Separator med pravili/vsebino
            }
            combinedContent += fileContent.trim(); // Trim za odstranitev odvečnih presledkov/vrstic
          });

          // Dodaj združeno vsebino (brez FILE_START/END)
          if (combinedContent.length > 0) {
            // Dodaj le, če ni prazno
            mainOutput += combinedContent + "\n\n";
          }
        } else {
          // Standardno obnašanje: vsaka datoteka posebej
          sectionFiles.forEach((file) => {
            let fileContent = file.content || "";
            // Preveri, ali je treba odstraniti metapodatke (tudi če ne združujemo)
            if (sectionConfig.removeMdcMetadata && file.name.endsWith(".mdc")) {
              logger.debug(`Removing MDC metadata from: ${file.name}`);
              fileContent = removeMdcFrontmatter(fileContent);
            }

            const relativePath = getRelativePath(file.path, selectedFolder);
            mainOutput +=
              formatMarker(PROMPT_MARKERS.file_open, {
                file_path: relativePath,
              }) + "\n";
            mainOutput += fileContent; // Uporabi (potencialno očiščeno) vsebino
            if (fileContent && !fileContent.endsWith("\n")) mainOutput += "\n";
            mainOutput +=
              formatMarker(PROMPT_MARKERS.file_close, {
                file_path: relativePath,
              }) + "\n\n";
          });
        }

        // Add section end marker
        mainOutput +=
          formatMarker(PROMPT_MARKERS.section_close, {
            section_name: sectionConfig.name, // Uporabi ime iz konfiguracije
          }) + "\n\n";
      }
      // --- KONEC SPREMENJENE ZANKE ---

      // ... (koda za dynamicExplanations in overviewBlock ostane podobna, a morda prilagodiš opis?) ...
      // Generate dynamic explanations for structure
      let dynamicExplanations = "";
      if (presentSectionNames.has("PROJECT_TREE")) {
        dynamicExplanations +=
          "- PROJECT_TREE: Shows the directory structure of included files.\n";
      }
      for (const section of PROMPT_SECTIONS) {
        if (presentSectionNames.has(section.name)) {
          let description = `Contains files from the ${
            section.directory || "project"
          } directory.`;
          if (section.concatenateContent) {
            description = `Contains combined content from files in the ${
              section.directory || "project"
            } directory.`;
          }
          dynamicExplanations += `- ${section.name}: ${description}\n`;
        }
      }
      if (dynamicExplanations) {
        dynamicExplanations =
          "\n\nStructure Explanation:\n" + dynamicExplanations;
      }

      // ... (koda za overviewBlock in finalOutput) ...

      const finalOutput = (overviewBlock + mainOutput.trim()).trim(); // Trim končni output

      return (
        finalOutput ||
        "No content to copy. Please select files or enable file tree/overview."
      );
    };
    ```

NALOGA ZA CURSOR AI AGENTA:

Implementiraj nacrt, ki ga je predlagal GEMINI 2.5.
