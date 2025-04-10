export interface PromptSectionDefinition {
  id: string; // Internal identifier (e.g., 'rules', 'docs', 'project_files') - Used as key
  name: string; // Name for markers (e.g., 'RULES', 'DOCUMENTATION')
  label: string; // Name for UI display (e.g., 'Rules', 'Docs')
  directory: string | null; // Relative path from project root for categorization (null for default)
  color: string; // CSS color string for UI
  removeMdcMetadata?: boolean; // If true, removes YAML frontmatter from .mdc files
  concatenateContent?: boolean; // If true, combines all files in the section into one block
  description?: string; // Optional description for the section intro
}
