// The brief's limit on each host, in UTF-8 bytes: 20% under the measured limit, rounded down,
// or 20,000 estimated tokens, whichever is smaller (brief.md, decision record 0016).
export const briefLimits = {
  // Claude Code 2.1.331 returned 30,000 characters of shell output whole, and a file path with a
  // 2,000-character preview at 31,000 and at 80,000. A character is never fewer bytes.
  claude: 24_000,

  // Codex 0.169.1 returned 39,000 bytes whole when the call's max_output_tokens was 10,000 or
  // absent, and cut the middle from 39,500.
  codex: 30_000,

  // no host cuts it: 20,000 estimated tokens
  none: 60_000,
} as const;

export const bytesPerToken = 3;
