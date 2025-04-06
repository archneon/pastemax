// electron/tokenUtils.js
const log = require("electron-log"); // Use electron-log via console override

let encoder = null; // Singleton encoder instance
let tiktokenLib = null;

/**
 * Attempts to load the tiktoken library.
 * Logs success or failure.
 * @returns {boolean} True if the library was loaded successfully, false otherwise.
 */
function loadTiktokenLibrary() {
  if (tiktokenLib) return true; // Already loaded

  try {
    tiktokenLib = require("tiktoken");
    log.debug("Successfully loaded tiktoken library.");
    return true;
  } catch (err) {
    log.error("Failed to load tiktoken library:", err.message);
    log.warn("Token counting will use a fallback estimation method.");
    tiktokenLib = null;
    return false;
  }
}

/**
 * Initializes and returns the tiktoken encoder instance (singleton).
 * Uses 'o200k_base' encoding (suitable for GPT-4o).
 * Logs success or failure.
 * @returns {object | null} The encoder instance or null if initialization failed.
 */
function getEncoder() {
  if (encoder) return encoder; // Return cached instance

  if (!tiktokenLib && !loadTiktokenLibrary()) {
    return null; // Library failed to load
  }

  try {
    // Attempt to get the specific encoding
    encoder = tiktokenLib.get_encoding("o200k_base");
    log.debug("Tiktoken encoder ('o200k_base') initialized successfully.");
    return encoder;
  } catch (err) {
    log.error(
      "Failed to initialize tiktoken 'o200k_base' encoder:",
      err.message
    );
    log.warn("Falling back to simpler token counting estimation.");
    encoder = null; // Ensure encoder is null on failure
    return null;
  }
}

/**
 * Counts tokens in the given text using the initialized tiktoken encoder.
 * If the encoder is not available, uses a fallback estimation method (chars / 4).
 *
 * @param {string} text - The text content to count tokens for.
 * @returns {number} The estimated or calculated token count.
 */
function countTokens(text) {
  const currentEncoder = getEncoder(); // Ensure encoder is loaded/attempted

  if (!currentEncoder) {
    // Fallback estimation if encoder failed
    return Math.ceil((text || "").length / 4);
  }

  try {
    const tokens = currentEncoder.encode(text || ""); // Ensure text is not null/undefined
    return tokens.length;
  } catch (err) {
    log.error(
      `Error counting tokens for text snippet (length ${text?.length}):`,
      err.message
    );
    // Fallback to character-based estimation on specific encoding error
    return Math.ceil((text || "").length / 4);
  }
}

// Ensure the library is loaded at least once when the module is required
loadTiktokenLibrary();

module.exports = {
  countTokens,
  getEncoder, // Export getEncoder if direct access is needed elsewhere, though countTokens usually suffices
};
