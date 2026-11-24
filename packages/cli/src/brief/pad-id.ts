// An item id padded to 12 columns, or followed by two spaces when it is longer.
export function padID(id: string): string {
  return id.length < 12 ? id.padEnd(12) : `${id}  `;
}
