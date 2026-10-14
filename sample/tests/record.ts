import { appendFileSync } from 'node:fs';

export function hit(name: string): void {
  appendFileSync(process.env.RAN_FILE ?? 'ran.txt', name + '\n');
}
