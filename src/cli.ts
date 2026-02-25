import { runReport } from './adapters/cli/report.js';

const VERSION = '0.0.2';

function printHelp(): void {
  console.log(
    [
      "devvalue — The VibeCoder's Cognitive & Value Tracker",
      '',
      'Usage:',
      '  devvalue <command> [options]',
      '',
      'Commands:',
      '  report    Show token cost report for the current workspace',
      '',
      'Options (report):',
      '  --branch <name>         Show only the specified branch',
      '  --rate <n>              Hourly rate in USD (default: 75)',
      '  --json                  Output as JSON',
      '  --include-background    Include sidechain / background token usage',
      '  -h, --help              Show this help',
      '  -v, --version           Show version',
    ].join('\n'),
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('-v') || args.includes('--version')) {
    console.log(`devvalue v${VERSION}`);
    return;
  }

  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    printHelp();
    return;
  }

  const command = args[0];
  if (command !== 'report') {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
  }

  let branch: string | undefined;
  let hourlyRate = 75;
  let jsonOutput = false;
  let includeBackground = false;

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--json') {
      jsonOutput = true;
    } else if (arg === '--include-background') {
      includeBackground = true;
    } else if ((arg === '--branch' || arg === '-b') && args[i + 1]) {
      branch = args[++i];
    } else if (arg.startsWith('--branch=')) {
      branch = arg.slice('--branch='.length);
    } else if ((arg === '--rate' || arg === '-r') && args[i + 1]) {
      hourlyRate = parseRate(args[++i]);
    } else if (arg.startsWith('--rate=')) {
      hourlyRate = parseRate(arg.slice('--rate='.length));
    } else {
      console.error(`Unknown option: ${arg}`);
      process.exit(1);
    }
  }

  await runReport({
    workspaceRoot: process.cwd(),
    hourlyRate,
    jsonOutput,
    branch,
    includeBackground,
  });
}

function parseRate(s: string): number {
  const n = Number(s);
  if (isNaN(n) || n <= 0) {
    console.error('--rate must be a positive number');
    process.exit(1);
  }
  return n;
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
