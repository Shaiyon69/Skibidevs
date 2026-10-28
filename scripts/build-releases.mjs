// Writes data/releases.json: every app's published releases (newest first) with their download files.
// Runs in GitHub Actions with the workflow token, so visitors never hit the GitHub API rate limit.
// Usage: GITHUB_TOKEN=... node scripts/build-releases.mjs
import { readFile, writeFile } from 'node:fs/promises';

const KEEP = 10;
const root = new URL('../', import.meta.url);
const { apps } = JSON.parse(await readFile(new URL('data/apptic.json', root), 'utf8'));

const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'skibidevs-releases' };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const out = {};
for (const app of apps.filter((item) => item.repo)) {
    const prefix = app.tagPrefix || '';
    const key = `${app.repo}:${prefix}`;
    if (key in out) continue;
    const response = await fetch(`https://api.github.com/repos/${app.repo}/releases?per_page=50`, { headers });
    // A missing repo (not created yet) just means no releases; anything else should fail the run.
    if (response.status === 404) { out[key] = []; continue; }
    if (!response.ok) throw new Error(`${response.status} for ${app.repo}`);
    out[key] = (await response.json())
        .filter((item) => !item.draft && !item.prerelease && item.tag_name.startsWith(prefix))
        .slice(0, KEEP)
        .map((item) => ({
            tag: item.tag_name.slice(prefix.length),
            date: item.published_at,
            notes: item.body || '',
            url: item.html_url,
            assets: (item.assets || []).map((asset) => ({ name: asset.name, url: asset.browser_download_url, size: asset.size }))
        }));
}

// No timestamp in the file: an unchanged release list must produce an unchanged file, so the workflow commits nothing.
await writeFile(new URL('data/releases.json', root), `${JSON.stringify({ releases: out }, null, 2)}\n`);
console.log(Object.entries(out).map(([key, list]) => `${key} ${list.length} (${list[0]?.tag ?? 'none'})`).join('\n'));
