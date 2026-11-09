// Search folding (ported from the POC). Browser-safe, no imports.

const LETTERS: Record<string, string> = {
  'ي': 'ی', 'ى': 'ی', 'ے': 'ی', 'ې': 'ی', 'ۍ': 'ی', // ye forms
  'ك': 'ک', 'ګ': 'گ',                               // kaf forms
  'ه': 'ہ', 'ھ': 'ہ', 'ة': 'ہ', 'ۃ': 'ہ', 'ە': 'ہ', 'ۀ': 'ہ', // he forms
  'ں': 'ن',                                          // noon ghunna
};
const LETTER_RE = new RegExp(`[${Object.keys(LETTERS).join('')}]`, 'g');
const ROMAN: Record<string, string> = { ee: 'i', oo: 'u', aa: 'a', q: 'k', ph: 'f' };
const ARABIC_ZERO = 0x0660;
const URDU_ZERO = 0x06f0;

function asciiDigit(d: string): string {
  const code = d.charCodeAt(0);
  if (code >= ARABIC_ZERO && code < ARABIC_ZERO + 10) return String(code - ARABIC_ZERO);
  if (code >= URDU_ZERO && code < URDU_ZERO + 10) return String(code - URDU_ZERO);
  return d;
}

/**
 * Folds Urdu letter variants and diacritics, and common Roman spelling variants,
 * so that a query and the text it should match compare equal.
 */
export function fold(text: unknown): string {
  return String(text ?? '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[\p{Cf}ـء]/gu, '')
    .replace(LETTER_RE, (c) => LETTERS[c])
    .replace(/\p{Nd}/gu, asciiDigit)
    .toLowerCase()
    .replace(/['’‘ʼʻ`´\-‐‑‒–—]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/ee|oo|aa|q|ph/g, (m) => ROMAN[m])
    .trim();
}
