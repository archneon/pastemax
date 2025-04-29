/**
 * Seznam datotek ali vzorcev (glob), ki naj bodo VEDNO vključeni v pregled,
 * četudi so navedeni v .gitignore datoteki projekta.
 * Ta pravila imajo prednost pred .gitignore.
 */
const allowedGitignoredPatterns = [
  // Natančne poti do datotek, ki jih želiš vedno vključiti:
  ".env.development",
  ".env.production",
  ".env.test",
  ".env.live",

  // Lahko dodaš tudi druge vzorce, npr.:
  // 'config/secrets.yml',
  // 'private_docs/**/*.md'
];

module.exports = {
  allowedGitignoredPatterns,
};
