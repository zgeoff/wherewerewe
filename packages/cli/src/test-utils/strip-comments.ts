const transpiler = new Bun.Transpiler({
  loader: 'ts',
  deadCodeElimination: false,
  trimUnusedImports: false,
});

// The code with every comment and type cut out by Bun's tokenizer, so a name in a comment is no use.
// The reprint moves lines, double-quotes strings and inlines `process.env.NODE_ENV`: a check that
// needs source lines or `process.env` reads marks them before it calls this.
export function stripComments(source: string): string {
  return transpiler.transformSync(source);
}
