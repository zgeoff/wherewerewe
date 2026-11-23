// Starts a process that exits at once and waits for it, so its pid names no running process.
export async function runGoneProcess(): Promise<number> {
  const gone = Bun.spawn(['bun', '-e', '']);

  await gone.exited;

  return gone.pid;
}
