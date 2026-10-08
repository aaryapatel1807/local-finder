/**
 * Question detection for the /api/answer flow.
 *
 * Pure, client-safe: decides whether a submitted search string looks like a
 * natural-language question ("What's the best pharmacy near me?") rather than
 * a keyword query ("pharmacy"). Leading interrogatives plus a trailing
 * question mark, case-insensitive.
 */

const LEADING_INTERROGATIVE =
  /^(what|what's|whats|where|where's|wheres|which|how|who|whose|when|why|is|are|can|could|does|do|did|would|should|will|has|have|tell)\b/i

export function isQuestionLike(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (t.endsWith('?')) return true
  return LEADING_INTERROGATIVE.test(t)
}
