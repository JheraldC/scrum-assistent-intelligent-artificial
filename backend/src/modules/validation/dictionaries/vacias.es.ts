// Palabras vacías del español: se descartan al comparar vocabulario entre textos (rules-catalog.md).
export const STOP_WORDS: ReadonlySet<string> = new Set([
  'a', 'al', 'ante', 'con', 'contra', 'de', 'del', 'desde', 'durante', 'e', 'el', 'ella', 'ellos', 'en', 'entre',
  'es', 'esa', 'ese', 'eso', 'esta', 'este', 'esto', 'la', 'las', 'le', 'les', 'lo', 'los', 'mas', 'me', 'mi',
  'muy', 'ni', 'no', 'nos', 'o', 'para', 'pero', 'por', 'que', 'se', 'sea', 'ser', 'si', 'sin', 'sobre', 'su',
  'sus', 'tambien', 'tiene', 'un', 'una', 'uno', 'unos', 'unas', 'y', 'ya', 'como', 'cada', 'hay', 'puede',
  'pueden', 'poder', 'quiero', 'quiere', 'queremos', 'cuando', 'donde', 'todo', 'todos', 'toda', 'todas',
]);
