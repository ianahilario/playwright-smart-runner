export function formatArgs(args: string[], list: boolean): string {
  if (args.length === 0) return '';
  const quoted = args.map(quoteShell);
  return list ? `${quoted.join('\n')}\n` : `${quoted.join(' ')}\n`;
}

export function quoteShell(arg: string): string {
  if (/^[A-Za-z0-9_./:@+-]+$/.test(arg)) return arg;
  return `'${arg.replaceAll("'", `'\\''`)}'`;
}
