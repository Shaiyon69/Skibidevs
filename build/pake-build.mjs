#!/usr/bin/env node
// pake-build: asks a few questions and turns a website into a desktop app with Pake
// (https://github.com/tw93/Pake). Needs Node 18+ and Pake's build tools (Rust, and on Windows
// the Visual Studio C++ Build Tools).
//
// Two modes:
// - Inside a Pake checkout (this file in Pake/scripts): uses that checkout's CLI, offers the
//   bundled uBlock ad blocker, and writes to shaiyon_ecosystem/shaiyon-apps/<Name>/.
// - Anywhere else: installs or updates the official pake-cli from npm on every run, then
//   writes to ./pake-apps/<Name>/ in the current folder.
//
// Usage: node pake-build.mjs            (build)
//        node pake-build.mjs --dry-run  (ask, print the command, build nothing)
import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DRY = process.argv.includes('--dry-run');
const CHECKOUT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCAL = existsSync(join(CHECKOUT, 'bin', 'helpers', 'merge.ts'));

// Finds the Pake package to build with; in public mode, keeps the global pake-cli up to date.
const findPake = () => {
  if (LOCAL) return CHECKOUT;
  const root = () => join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'pake-cli');
  let dir = root();
  const installed = existsSync(join(dir, 'package.json')) && JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version;
  let latest = '';
  try { latest = execSync('npm view pake-cli version', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { /* offline */ }
  if (latest && latest !== installed) {
    console.log(installed ? `Updating Pake ${installed} -> ${latest}...` : `Installing Pake ${latest} (one time)...`);
    try { execSync('npm install -g pake-cli@latest', { stdio: 'inherit' }); } catch { /* handled below */ }
    dir = root();
  }
  if (!existsSync(join(dir, 'dist', 'cli.js'))) {
    console.error('Pake is not installed and could not be downloaded. Check your connection, then run: npm install -g pake-cli');
    process.exit(1);
  }
  if (!latest) console.log(`Offline: building with the installed Pake ${installed}.`);
  return dir;
};

const PAKE = findPake();
const CLI = join(PAKE, 'dist', 'cli.js');
const OUT_ROOT = LOCAL ? resolve(CHECKOUT, '..', 'shaiyon_ecosystem', 'shaiyon-apps') : resolve('pake-apps');
// prompts and chalk ship with Pake itself, so this script needs no install of its own.
const req = createRequire(join(PAKE, 'package.json'));
const prompts = req('prompts');
const { default: chalk } = await import(pathToFileURL(req.resolve('chalk')).href);

const SIZES = [
  { title: 'Wide', description: '1280 x 800, good for most sites', value: [1280, 800] },
  { title: 'Chat', description: '1100 x 800, narrower, for messengers', value: [1100, 800] },
  { title: 'Large', description: '1440 x 900, for big screens', value: [1440, 900] },
  { title: 'Custom', description: 'type your own size', value: null },
];

// Sign-in pages a site may send you to. Anything not allowed opens in your normal browser instead.
const LOGINS = {
  google: { title: 'Google', domains: ['accounts.google.com', 'google.com'] },
  microsoft: { title: 'Microsoft', domains: ['login.microsoftonline.com', 'login.live.com', 'microsoft.com'] },
  apple: { title: 'Apple', domains: ['appleid.apple.com'] },
  facebook: { title: 'Facebook / Meta', domains: ['facebook.com', 'meta.com'] },
  github: { title: 'GitHub', domains: ['github.com'] },
  discord: { title: 'Discord', domains: ['discord.com'] },
  x: { title: 'X / Twitter', domains: ['x.com', 'twitter.com'] },
};
// Sites we know: pre-tick the sign-in buttons they show.
const KNOWN = {
  youtube: ['google'],
  canva: ['google', 'facebook', 'apple', 'microsoft'],
  messenger: ['facebook'],
  notion: ['google', 'apple', 'microsoft'],
  figma: ['google'],
  spotify: ['google', 'facebook', 'apple'],
  chatgpt: ['google', 'microsoft', 'apple'],
  discord: [],
};

const EXTRAS = [
  { title: 'Start maximized', value: '--maximize' },
  { title: 'Start full screen', value: '--fullscreen' },
  { title: 'Always on top', value: '--always-on-top' },
  { title: 'Force dark mode', value: '--dark-mode' },
  { title: 'Show tray icon', value: '--show-system-tray' },
  { title: 'Incognito', description: 'forget logins when closed', value: '--incognito' },
  { title: 'Hide window frame', value: '--hide-window-decorations' },
];

const accent = chalk.hex('#a78bfa');
const dim = chalk.dim;
const step = (n, total, text) => console.log(`\n${accent.bold(`${n}/${total}`)} ${chalk.bold(text)}`);
const note = (text) => console.log(dim(`    ${text.split('\n').join('\n    ')}`));
// shortcut: last two labels only, wrong for hosts like site.co.uk; add a public-suffix list if that matters.
const baseDomain = (host) => host.replace(/^www\./, '').split('.').slice(-2).join('.');
const DOMAIN_RE = /^([a-z0-9-]+\.)+[a-z]{2,}$/i;

const onCancel = () => {
  console.log(`\n${chalk.yellow('Cancelled.')} Nothing was built.\n`);
  process.exit(0);
};
const ask = async (question) => (await prompts({ name: 'v', ...question }, { onCancel })).v;

if (!existsSync(CLI)) {
  console.error(chalk.red(`Missing ${CLI}`));
  console.error(`Build the CLI first: cd "${PAKE}" && npx cross-env NODE_ENV=production npx rollup -c`);
  process.exit(1);
}
const pakeVersion = JSON.parse(readFileSync(join(PAKE, 'package.json'), 'utf8')).version;

// Test hook: PAKE_BUILD_ANSWERS='["youtube.com", ...]' answers every prompt in order.
if (process.env.PAKE_BUILD_ANSWERS) prompts.inject(JSON.parse(process.env.PAKE_BUILD_ANSWERS));

const TOTAL = 7;
const title = `  ${chalk.bold('Shaiyon Apps')}  ${dim('turn any website into an app')}  `;
const bar = '─'.repeat(2 + 12 + 2 + 28 + 2);
console.log(`\n${accent(`  ╭${bar}╮`)}\n${accent('  │')}${title}${accent('│')}\n${accent(`  ╰${bar}╯`)}`);
note(`Pake ${pakeVersion}${LOCAL ? ' (local checkout)' : ''}. Arrow keys to move, Space to tick, Enter to confirm, Ctrl+C to quit.`);

step(1, TOTAL, 'Website');
const url = await ask({
  type: 'text',
  message: 'Website address',
  hint: 'e.g. youtube.com',
  format: (v) => (/^https?:\/\//i.test(v.trim()) ? v.trim() : `https://${v.trim()}`),
  validate: (v) => {
    try { return Boolean(new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`).hostname.includes('.')) || 'Type a full address like youtube.com'; } catch { return 'Type a full address like youtube.com'; }
  },
});
const host = new URL(url).hostname;
const site = baseDomain(host);
const key = site.split('.')[0];

step(2, TOTAL, 'Name');
const name = (await ask({
  type: 'text',
  message: 'App name',
  initial: key.charAt(0).toUpperCase() + key.slice(1),
  format: (v) => v.replace(/[^\w .-]/g, '').trim(),
  validate: (v) => Boolean(v.replace(/[^\w .-]/g, '').trim()) || 'Use letters or numbers',
}));

step(3, TOTAL, 'Window size');
let size = await ask({ type: 'select', message: 'Size when it opens', choices: SIZES, initial: 0 });
if (!size) {
  const width = await ask({ type: 'number', message: 'Width', initial: 1280, min: 400, max: 7680 });
  const height = await ask({ type: 'number', message: 'Height', initial: 800, min: 300, max: 4320 });
  size = [width, height];
}

step(4, TOTAL, 'Sign-in pages');
note(
  `Links to other websites open in your normal browser, not in the app.\n` +
  `That breaks "Sign in with Google" style buttons: the login page leaves the app.\n` +
  `Tick each sign-in button the site shows, so its login stays inside the app.\n` +
  `${site} itself is always allowed.`,
);
const preset = KNOWN[key] || [];
const logins = await ask({
  type: 'multiselect',
  message: 'Sign-in buttons on this site',
  instructions: false,
  hint: preset.length ? `pre-ticked for ${site}` : 'none ticked = only email/password login',
  choices: Object.entries(LOGINS).map(([id, { title, domains }]) => ({
    title, description: domains.join(', '), value: id, selected: preset.includes(id),
  })),
});
const extraDomains = await ask({
  type: 'list',
  message: 'Any other domains to keep inside? (optional)',
  hint: 'comma list, e.g. cdn.site.com; Enter to skip',
  separator: ',',
  validate: (v) => v.split(',').map((d) => d.trim()).filter(Boolean).every((d) => DOMAIN_RE.test(d)) || 'Use plain domains like example.com, no https:// or paths',
});
const domains = [...new Set([site, ...logins.flatMap((id) => LOGINS[id].domains), ...extraDomains.map((d) => d.toLowerCase()).filter(Boolean)])];

step(5, TOTAL, LOCAL ? 'Icon and ad blocker' : 'Icon');
const icon = await ask({
  type: 'text',
  message: "Icon file (optional)",
  hint: 'Enter to use the site\'s own icon',
  validate: (v) => !v.trim() || (existsSync(resolve(v.trim())) && /\.(ico|icns|png)$/i.test(v.trim())) || 'Give an existing .ico (Windows), .icns (Mac) or .png (Linux) file, or leave empty',
});
// The ad blocker needs the patched local checkout; official pake-cli can't load extensions.
const ublock = LOCAL && await ask({ type: 'toggle', message: 'Bundle uBlock Origin Lite ad blocker?', initial: true, active: 'yes', inactive: 'no' });
// Signed self-updates from Skibidevs; needs the private key, so only on the maintainer's machine.
const KEY = join(homedir(), '.tauri', 'shaiyon-apps.key');
const autoUpdate = LOCAL && existsSync(KEY) && existsSync(`${KEY}.password`) && await ask({ type: 'toggle', message: 'Auto-update from Skibidevs?', initial: true, active: 'yes', inactive: 'no' });

step(6, TOTAL, 'Extras');
const extras = await ask({ type: 'multiselect', message: 'Optional behaviour', instructions: false, hint: 'Enter for none', choices: EXTRAS });

step(7, TOTAL, 'Version');
const version = await ask({
  type: 'text', message: 'App version', initial: '1.0.0',
  validate: (v) => /^\d+\.\d+\.\d+$/.test(v) || 'Use x.y.z, e.g. 1.0.0',
});

const [width, height] = size;
const args = [CLI, url, '--name', name, '--width', String(width), '--height', String(height),
  '--app-version', version, '--safe-domain', domains.join(',')];
if (icon.trim()) args.push('--icon', resolve(icon.trim()));
args.push(...extras);

const outDir = join(OUT_ROOT, name);
const row = (label, value) => console.log(`  ${dim(label.padEnd(10))} ${value}`);
console.log(`\n${accent.bold('Summary')}`);
row('App', chalk.bold(name) + dim(` v${version}`));
row('Site', url);
row('Window', `${width} x ${height}`);
row('In-app', domains.join(', '));
const appId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const tag = `shaiyon-apps-${appId}-v${version}`;
const endpoint = `https://shaiyon69.github.io/Skibidevs/updates/${appId}/latest.json`;
if (LOCAL) row('Ad block', ublock ? chalk.green('uBlock Origin Lite') : dim('off'));
if (LOCAL) row('Updates', autoUpdate ? chalk.green(`auto, release tag ${tag}`) : dim('off'));
row('Icon', icon.trim() ? resolve(icon.trim()) : dim('from the site'));
row('Extras', extras.length ? EXTRAS.filter((e) => extras.includes(e.value)).map((e) => e.title).join(', ') : dim('none'));
row('Output', outDir);
console.log(dim(`\n  node ${args.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' ')}`));

if (DRY) process.exit(0);
if (!(await ask({ type: 'confirm', message: 'Build now?', initial: true }))) onCancel();

console.log(`\n${accent('Building')} ${dim('(about 2 minutes)')}\n`);
mkdirSync(outDir, { recursive: true });
const env = { ...process.env, ...(ublock ? {} : { PAKE_NO_EXTENSIONS: '1' }) };
const started = Date.now();
if (autoUpdate) {
  Object.assign(env, {
    SHAIYON_UPDATER_PUBKEY: readFileSync(`${KEY}.pub`, 'utf8').trim(),
    SHAIYON_UPDATER_ENDPOINT: endpoint,
    TAURI_SIGNING_PRIVATE_KEY: readFileSync(KEY, 'utf8').trim(),
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: readFileSync(`${KEY}.password`, 'utf8').trim(),
  });
}
// The updater manifest the app polls; publish it with the installer under the release tag.
const writeManifest = () => {
  const dir = join(CHECKOUT, 'src-tauri', 'target', 'x86_64-pc-windows-msvc', 'release', 'bundle', 'msi');
  const sig = existsSync(dir) && readdirSync(dir).map((f) => join(dir, f))
    .filter((f) => f.endsWith('.msi.sig') && statSync(f).mtimeMs >= started)[0];
  if (!sig) throw new Error(`No fresh .msi.sig in ${dir}`);
  const manifest = {
    version, notes: `${name} ${version}`, pub_date: new Date().toISOString(),
    platforms: { 'windows-x86_64': {
      signature: readFileSync(sig, 'utf8').trim(),
      url: `https://github.com/Shaiyon69/Skibidevs/releases/download/${tag}/${encodeURIComponent(name)}.msi`,
    } },
  };
  writeFileSync(join(outDir, 'latest.json'), `${JSON.stringify(manifest, null, 2)}
`);
};
const child = spawn(process.execPath, args, { cwd: outDir, env, stdio: 'inherit' });
child.on('exit', (code) => {
  if (code === 0 && autoUpdate) {
    try { writeManifest(); } catch (error) { console.error(chalk.red(`Update manifest not written: ${error.message}`)); code = 1; }
  }
  if (code === 0 && autoUpdate) {
    console.log(`
Publish: gh release create ${tag} -R Shaiyon69/Skibidevs "${join(outDir, `${name}.msi`)}" "${join(outDir, 'latest.json')}"`);
  }
  console.log(code === 0
    ? `\n${chalk.green('✔ Done.')} Installer is in ${chalk.bold(outDir)}\n`
    : `\n${chalk.red(`✖ Build failed (exit ${code}).`)} Scroll up for the error.\n`);
  process.exit(code ?? 1);
});
