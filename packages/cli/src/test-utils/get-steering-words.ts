const steering =
  /\b(?:ask|confirm|check with|hold back|wait for|only if|only when|before you|do not|don't)\b/giu;

// The steering words in a text, in the order they appear: a word that tells the agent to hold back,
// to ask, or to act only inside a limit.
export function getSteeringWords(text: string): string[] {
  return [...text.matchAll(steering)].map((found) => found[0].toLowerCase());
}
