#!/usr/bin/env node
/**
 * Stopwatch for the install-time claim (INSTALL.md, "Time to install").
 *
 * Pure Node: no servers, no network, no dependencies. It runs the protocol with a
 * person at the keyboard, times it, asks the checks the protocol requires, and
 * prints a verdict. With --out it appends one JSON line per attempt.
 *
 *   node scripts/measure-install.mjs --out timings.jsonl
 *
 * It records no names and no install ids: only a label you type (P1, P2, ...),
 * the date, the minutes and the check answers. Failed attempts are recorded too.
 */
import fs from 'node:fs';
import readline from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { stdin as input, stdout as output, argv, exit } from 'node:process';

const TARGET_MINUTES = 15;

const HELP = `usage: node scripts/measure-install.mjs [--out FILE]

Runs the stopwatch protocol in INSTALL.md ("Time to install"). Press Enter to start and
to stop the timer, answer the checks, and read the verdict. --out appends one JSON line.
`;

function parseOptions(list) {
  const { values } = parseArgs({
    args: list,
    options: { out: { type: 'string' }, help: { type: 'boolean', short: 'h' } },
    strict: true,
  });
  return { file: values.out ?? null, help: values.help === true };
}

const PROTOCOL = `
Stopwatch protocol (target: under ${TARGET_MINUTES} minutes, non-developer, no help)

  Before GO   The participant has not written code professionally in the last two years.
              Hand over only INSTALL.md, the install id and the Desk token, prepared in advance.
  GO          Press Enter. The timer starts when the participant begins step 1 of INSTALL.md.
  During      The developer does not type, paste, point or explain. Errors are recorded, not fixed.
  DONE        The participant says the Desk shows their count. Press Enter. The timer stops.
  Checks      Answered after the timer stops, so answering does not add to the time.
`;

const CHECKS = [
  ['helperTouches', 'How many times did the developer type, paste or point at the screen? (0 = none)', 'int'],
  ['usedOnlyInstallMd', 'Did the participant use only INSTALL.md and the console messages? (y/n)', 'yn'],
  ['triggerVisible', 'Did a trigger show a visible response on the test page? (y/n)', 'yn'],
  ['deskCountRose', 'Did the Desk count for the install go up by one? (y/n)', 'yn'],
];

async function main() {
  const args = parseOptions(argv.slice(2));
  if (args.help) {
    output.write(HELP);
    return 0;
  }
  const rl = readline.createInterface({ input, output });
  try {
    output.write(PROTOCOL);
    const label = (await rl.question('Participant label (P1, P2 ... no names): ')).trim();
    if (!label) throw new Error('a label is required');
    const developer = (await rl.question('Has the participant written code professionally in the last two years? (y/n): ')).trim().toLowerCase();
    if (developer !== 'n') {
      output.write('Not a valid attempt: the protocol needs a non-developer. Nothing recorded.\n');
      return 2;
    }
    await rl.question('Install id and Desk token handed over in advance? Press Enter to say GO: ');
    const start = performance.now();
    const startedAt = new Date().toISOString();
    await rl.question('Participant says DONE (Desk shows their count). Press Enter to stop: ');
    const minutes = (performance.now() - start) / 60000;

    const answers = {};
    for (const [key, question, kind] of CHECKS) {
      for (;;) {
        const raw = (await rl.question(`${question} `)).trim().toLowerCase();
        if (kind === 'int' && /^\d+$/.test(raw)) { answers[key] = Number(raw); break; }
        if (kind === 'yn' && (raw === 'y' || raw === 'n')) { answers[key] = raw === 'y'; break; }
        output.write('  please answer ' + (kind === 'int' ? 'a whole number' : 'y or n') + '\n');
      }
    }

    const inTime = minutes <= TARGET_MINUTES;
    const pass = inTime && answers.helperTouches === 0 && answers.usedOnlyInstallMd && answers.triggerVisible && answers.deskCountRose;
    const record = {
      label,
      date: startedAt.slice(0, 10),
      minutes: Number(minutes.toFixed(2)),
      target: TARGET_MINUTES,
      role: 'non-developer',
      ...answers,
      pass,
    };
    output.write(`\nMinutes: ${record.minutes} (target under ${TARGET_MINUTES}). Verdict: ${pass ? 'PASS' : 'FAIL'}\n`);
    output.write(`Sample size: one attempt. One attempt is not a rate; report every attempt, including failures.\n`);
    if (args.file) {
      fs.appendFileSync(args.file, JSON.stringify(record) + '\n');
      output.write(`Appended to ${args.file}\n`);
    }
    return pass ? 0 : 1;
  } finally {
    rl.close();
  }
}

main().then(
  (code) => exit(code),
  (err) => {
    console.error(`measure-install: ${err.message}`);
    exit(2);
  },
);
