import { isRecord } from '../hooks/is-record.ts';
import type { Harness } from '../hooks/types.ts';

// Whether a hook handler runs `wherewerewe hook <harness>`: its command ends so, with the binary
// quoted or not and with any runtime before it, as an older entry's did. The binary's own name must
// be `wherewerewe`, so a program such as `elsewherewerewe` is never taken for it.
export function isOurHandler(handler: unknown, harness: Harness): boolean {
  if (!isRecord(handler) || typeof handler['command'] !== 'string') {
    return false;
  }

  return new RegExp(`(?:^|[\\s/'"])wherewerewe['"]? hook ${harness}$`, 'u').test(
    handler['command'],
  );
}
