import { isRecord } from '../utils/is-record.ts';
import type { Json } from './types.ts';

const allowRules = ['Bash(www *)', 'Bash(wherewerewe *)'];

export function withAllowRules(settings: Json): Json {
  const found = settings['permissions'];
  const permissions: Json = isRecord(found) ? found : {};
  const current = permissions['allow'];
  const allow: unknown[] = Array.isArray(current) ? current : [];
  const missing = allowRules.filter((rule) => !allow.includes(rule));

  return { ...settings, permissions: { ...permissions, allow: [...allow, ...missing] } };
}
