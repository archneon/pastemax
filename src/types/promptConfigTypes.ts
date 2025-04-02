export interface PromptSectionDefinition {
  id: string; // Internal identifier (e.g., 'rules', 'docs', 'project_files') - Used as key
  name: string; // Name for markers (e.g., 'RULES', 'DOCUMENTATION')
  label: string; // Name for UI display (e.g., 'Rules', 'Docs')
  directory: string | null; // Relative path from project root for categorization (null for default)
  descriptionFilename: string | null; // Filename within DESCRIPTIONS_DIR (e.g., "rules.txt") or null
  color: string; // CSS color string for UI
}
