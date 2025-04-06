/**
 * Defines a list of common file extensions that should typically be treated as binary
 * and excluded from content processing like token counting.
 * This list complements any binary detection logic based on file content.
 */
const BINARY_EXTENSIONS = [
  // Images (ensure SVG is included as it might not be detected as binary by content)
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".bmp",
  ".tiff",
  ".tif",
  ".ico",
  ".webp",
  ".svg",

  // Audio
  ".mp3",
  ".wav",
  ".ogg",
  ".flac",
  ".aac",
  ".m4a",
  ".wma",

  // Video
  ".mp4",
  ".mkv",
  ".avi",
  ".mov",
  ".wmv",
  ".flv",
  ".webm",

  // Archives
  ".zip",
  ".rar",
  ".tar",
  ".gz",
  ".tgz",
  ".7z",
  ".bz2",
  ".xz",

  // Documents
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".odt",
  ".ods",
  ".odp",

  // Fonts
  ".ttf",
  ".otf",
  ".woff",
  ".woff2",
  ".eot",

  // Compiled Code / Executables / Libraries
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".app",
  ".jar",
  ".war",
  ".ear",
  ".class", // Java bytecode
  ".pyc",
  ".pyo",
  ".pyd", // Python bytecode/compiled
  ".o", // Object files
  ".a",
  ".lib", // Static libraries

  // Databases
  ".db",
  ".sqlite",
  ".sqlite3",
  ".mdb",
  ".accdb",
  ".sqlitedb",

  // Disk Images / Virtual Machines
  ".iso",
  ".img",
  ".vmdk",
  ".vdi",
  ".hdd",

  // Other common binary formats
  ".bin",
  ".dat",
  ".data",
  ".dump",
  ".psd", // Photoshop
  ".ai", // Illustrator
  ".indd", // InDesign
  ".swf", // Flash
];

// Make the list available for import
module.exports = {
  BINARY_EXTENSIONS,
};
