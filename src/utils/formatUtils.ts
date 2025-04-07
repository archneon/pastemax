import { FileData } from "../types/FileTypes";
import { PromptSectionDefinition } from "../types/promptConfigTypes";
import { getRelativePath } from "./pathUtils";

/**
 * Format a marker template by replacing placeholders with context values
 * @param template The template string with placeholders
 * @param context Object containing values to replace placeholders
 * @returns Formatted string with placeholders replaced
 */
export const formatMarker = (
  template: string,
  context: { section_name?: string; file_path?: string }
): string => {
  let result = template;
  if (context.section_name !== undefined)
    result = result.replace("{section_name}", context.section_name);
  if (context.file_path !== undefined)
    result = result.replace("{file_path}", context.file_path);
  return result;
};

/**
 * Categorize a file into a section based on its path and the defined sections
 * @param file The file data object to categorize
 * @param currentSelectedFolder The current selected folder
 * @param sections Array of section definitions
 * @returns The section ID for the file
 */
export const categorizeFile = (
  file: FileData,
  currentSelectedFolder: string | null,
  sections: PromptSectionDefinition[]
): string => {
  const defaultSection = sections.find((s) => s.directory === null);
  const defaultSectionId = defaultSection?.id || "project_files";

  if (!currentSelectedFolder) {
    return defaultSectionId;
  }

  const relativePath = getRelativePath(file.path, currentSelectedFolder);
  if (!relativePath) {
    return defaultSectionId;
  }

  // Za vse datoteke preverimo sekcije
  for (const section of sections) {
    if (
      section.directory &&
      (relativePath === section.directory ||
        relativePath.startsWith(section.directory + "/"))
    ) {
      return section.id;
    }
  }

  return defaultSectionId;
};
