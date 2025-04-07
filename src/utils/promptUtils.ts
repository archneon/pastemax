import { FileData } from "../types/FileTypes";
import { formatMarker, categorizeFile } from "./formatUtils";
import {
  generateAsciiFileTree,
  getRelativePath,
  normalizePath,
  comparePathsStructurally,
} from "./pathUtils";
import logger from "./logger";
import { PROMPT_SECTIONS, PROMPT_MARKERS } from "../constants";

// Define the structure for the input state needed by the generator
interface PromptDataArgs {
  allFiles: FileData[];
  selectedFiles: string[];
  selectedFolder: string | null;
  sortOrder: string;
  includeFileTree: boolean;
  includePromptOverview: boolean;
}

/**
 * Generates the final prompt string based on selected files and settings.
 * @param args - Object containing all necessary state slices.
 * @returns The generated prompt string.
 */
export const generatePromptContent = (args: PromptDataArgs): string => {
  const {
    allFiles,
    selectedFiles,
    selectedFolder,
    sortOrder,
    includeFileTree,
    includePromptOverview,
  } = args;

  logger.debug(
    `Generating prompt content. Selected files: ${selectedFiles.length}`
  );
  const selectedPathSet = new Set(selectedFiles.map(normalizePath));

  const contentFiles = allFiles.filter(
    (file: FileData) =>
      selectedPathSet.has(normalizePath(file.path)) &&
      !file.isBinary &&
      !file.isSkipped &&
      file.fileKind === "regular"
  );

  // Find the overview file
  const overviewFile = allFiles.find((file) => file.fileKind === "overview");
  const overviewContent = overviewFile ? overviewFile.content : null;

  if (contentFiles.length === 0 && !includeFileTree && !includePromptOverview) {
    return "No text files selected, or tree/overview not included.";
  }

  const [sortKey, sortDir] = sortOrder.split("-");
  const sortedContentFiles = [...contentFiles].sort((a, b) => {
    let comparison = 0;
    if (sortKey === "name") comparison = a.name.localeCompare(b.name);
    else if (sortKey === "tokens")
      comparison = (a.tokenCount || 0) - (b.tokenCount || 0);
    else if (sortKey === "size") comparison = (a.size || 0) - (b.size || 0);
    else if (sortKey === "path")
      comparison = comparePathsStructurally(a.path, b.path, selectedFolder);
    return sortDir === "asc" ? comparison : -comparison;
  });

  // Initialize main output and track what sections are present
  let mainOutput = "";
  const presentSectionNames = new Set<string>();

  // Generate the file tree if requested
  if (includeFileTree && selectedFolder) {
    mainOutput +=
      formatMarker(PROMPT_MARKERS.section_open, {
        section_name: "PROJECT_TREE",
      }) + "\n";
    mainOutput += ".\n";
    const asciiTree = generateAsciiFileTree(sortedContentFiles, selectedFolder);
    mainOutput += asciiTree + "\n";
    mainOutput +=
      formatMarker(PROMPT_MARKERS.section_close, {
        section_name: "PROJECT_TREE",
      }) + "\n\n";
    presentSectionNames.add("PROJECT_TREE");
  }

  // Process files by section
  const filesBySection: Record<string, FileData[]> = {};
  sortedContentFiles.forEach((file) => {
    const sectionId =
      file.sectionId || categorizeFile(file, selectedFolder, PROMPT_SECTIONS);
    if (!filesBySection[sectionId]) filesBySection[sectionId] = [];
    filesBySection[sectionId].push(file);
  });

  // Add sections to the output
  for (const section of PROMPT_SECTIONS) {
    const sectionFiles = filesBySection[section.id];
    if (!sectionFiles || sectionFiles.length === 0) continue;

    // Mark this section as present
    presentSectionNames.add(section.name);

    // Add section start marker
    mainOutput +=
      formatMarker(PROMPT_MARKERS.section_open, {
        section_name: section.name,
      }) + "\n\n";

    // Add files in this section
    sectionFiles.forEach((file) => {
      const relativePath = getRelativePath(file.path, selectedFolder);
      mainOutput +=
        formatMarker(PROMPT_MARKERS.file_open, { file_path: relativePath }) +
        "\n";
      mainOutput += file.content || "";
      if (file.content && !file.content.endsWith("\n")) mainOutput += "\n";
      mainOutput +=
        formatMarker(PROMPT_MARKERS.file_close, { file_path: relativePath }) +
        "\n\n";
    });

    // Add section end marker
    mainOutput +=
      formatMarker(PROMPT_MARKERS.section_close, {
        section_name: section.name,
      }) + "\n\n";
  }

  // Generate dynamic explanations for structure
  let dynamicExplanations = "";

  // Explain file tree if present
  if (presentSectionNames.has("PROJECT_TREE")) {
    dynamicExplanations +=
      "- PROJECT_TREE: Shows the directory structure of included files.\n";
  }

  // Explain present sections
  for (const section of PROMPT_SECTIONS) {
    if (presentSectionNames.has(section.name)) {
      dynamicExplanations += `- ${section.name}: Contains files from the ${
        section.directory || "project"
      } directory.\n`;
    }
  }

  // Add header to explanations if not empty
  if (dynamicExplanations) {
    dynamicExplanations = "\n\nStructure Explanation:\n" + dynamicExplanations;
  }

  // Construct the overview block
  let overviewBlock = "";
  if (includePromptOverview && overviewContent) {
    overviewBlock += "%%%%_PROMPT_OVERVIEW_START\n";
    overviewBlock += String(overviewContent).trim();

    // Add the dynamic explanations if present
    if (dynamicExplanations) {
      overviewBlock += dynamicExplanations;
    }

    overviewBlock += "\n%%%%_PROMPT_OVERVIEW_END\n\n";
  }

  // Combine everything
  const finalOutput = overviewBlock + mainOutput.trim();

  return (
    finalOutput ||
    "No content to copy. Please select files or enable file tree/overview."
  );
};
