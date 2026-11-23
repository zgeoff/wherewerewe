export function stripCarriageReturn(cell: string): string {
  return cell.replaceAll('\r', '');
}
