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

  let output = "";
  const markers = PROMPT_MARKERS;

  if (includePromptOverview && overviewContent) {
    output +=
      "==== SYSTEM_PROMPT_OVERVIEW ====\n" +
      String(overviewContent).trim() +
      "\n\n";
  }

  if (includeFileTree && selectedFolder) {
    output +=
      formatMarker(markers.section_open, { section_name: "PROJECT_TREE" }) +
      "\n";
    output += ".\n";
    const asciiTree = generateAsciiFileTree(sortedContentFiles, selectedFolder);
    output += asciiTree + "\n";
    output +=
      formatMarker(markers.section_close, { section_name: "PROJECT_TREE" }) +
      "\n\n";
  }

  const filesBySection: Record<string, FileData[]> = {};
  sortedContentFiles.forEach((file) => {
    const sectionId =
      file.sectionId || categorizeFile(file, selectedFolder, PROMPT_SECTIONS);
    if (!filesBySection[sectionId]) filesBySection[sectionId] = [];
    filesBySection[sectionId].push(file);
  });

  for (const section of PROMPT_SECTIONS) {
    const sectionFiles = filesBySection[section.id];
    if (!sectionFiles || sectionFiles.length === 0) continue;
    output +=
      formatMarker(markers.section_open, { section_name: section.name }) +
      "\n\n";

    sectionFiles.forEach((file) => {
      const relativePath = getRelativePath(file.path, selectedFolder);
      output +=
        formatMarker(markers.file_open, { file_path: relativePath }) + "\n";
      output += file.content || "";
      if (file.content && !file.content.endsWith("\n")) output += "\n";
      output +=
        formatMarker(markers.file_close, { file_path: relativePath }) + "\n\n";
    });
    output +=
      formatMarker(markers.section_close, { section_name: section.name }) +
      "\n\n";
  }
  return output.trim();
};
