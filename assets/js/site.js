// Shared helpers for every page: escaping, data loading, theme, nav state, Apptic releases and notes.
window.SD = (function () {
    const RELEASE_TTL = 60 * 60 * 1000;

    const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));

    const fetchJson = async (url) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`${response.status} loading ${url}`);
        return response.json();
    };

    const formatDate = (value) => {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value || '');
        return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
    };

    const store = {
        get(key) {
            try { return JSON.parse(localStorage.getItem(key)); } catch (error) { return null; }
        },
        set(key, value) {
            try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { /* storage blocked: skip caching */ }
        }
    };

    // data/releases.json is rebuilt by the "Refresh releases" workflow with its own token, so it always
    // loads; the live API below is only a fallback for apps the file doesn't list yet.
    let manifest;
    const loadManifest = () => {
        manifest ||= fetchJson('/Skibidevs/data/releases.json').then((data) => data.releases || {}).catch(() => ({}));
        return manifest;
    };

    // Thrown when an app has no published release (as opposed to GitHub being unreachable).
    const unreleased = (repo, tagPrefix) => Object.assign(new Error(`No ${tagPrefix} release in ${repo}`), { unreleased: true });

    // Unauthenticated GitHub API allows 60 requests/hour per visitor, so each app's release list is cached for an hour.
    // Private-source apps publish to the Skibidevs repo with tags "<app>-v1.2.3"; only matching tags count. Newest first.
    const releasesOf = async (repo, tagPrefix = '') => {
        const listed = (await loadManifest())[`${repo}:${tagPrefix}`];
        if (listed) {
            if (!listed.length) throw unreleased(repo, tagPrefix);
            return listed;
        }

        const key = `releases:${repo}:${tagPrefix}`;
        const cached = store.get(key);
        if (cached && Date.now() - cached.at < RELEASE_TTL) return cached.releases;

        const releases = (await fetchJson(`https://api.github.com/repos/${repo}/releases?per_page=50`))
            .filter((item) => !item.draft && !item.prerelease && item.tag_name.startsWith(tagPrefix))
            .map((data) => ({
                tag: data.tag_name.slice(tagPrefix.length),
                date: data.published_at,
                notes: data.body || '',
                url: data.html_url,
                assets: (data.assets || []).map((asset) => ({ name: asset.name, url: asset.browser_download_url, size: asset.size }))
            }));
        if (!releases.length) throw unreleased(repo, tagPrefix);
        store.set(key, { at: Date.now(), releases });
        return releases;
    };

    const latestRelease = async (repo, tagPrefix = '') => (await releasesOf(repo, tagPrefix))[0];

    const platform = () => {
        const agent = navigator.userAgent;
        if (/Android/i.test(agent)) return 'android';
        if (/Windows/i.test(agent)) return 'windows';
        if (/iPhone|iPad|Macintosh/i.test(agent)) return 'apple';
        if (/Linux/i.test(agent)) return 'linux';
        return 'other';
    };

    const PLATFORM_LABEL = { windows: 'Windows', linux: 'Linux', android: 'Android' };

    // Small line icons for each platform, drawn in currentColor so they follow buttons and themes.
    const OS_ICONS = {
        windows: '<path d="M4 5.6 10.5 4.7v6.6H4zM12 4.5 20 3.4v7.9h-8zM4 12.8h6.5v6.6L4 18.4zM12 12.8h8v7.8l-8-1.1z" fill="currentColor" stroke="none"/>',
        linux: '<path d="M12 3c-2.1 0-3.4 1.8-3.4 4.3 0 1.5-.6 2.7-1.6 4.1C5.8 13.2 5 15 5 16.8 5 19 6.6 21 9 21h6c2.4 0 4-2 4-4.2 0-1.8-.8-3.6-2-5.4-1-1.4-1.6-2.6-1.6-4.1C15.4 4.8 14.1 3 12 3z"/><path d="M10.3 8.2h.01M13.7 8.2h.01M10.8 10.6c.8.5 1.6.5 2.4 0"/>',
        android: '<path d="M5 17.5a7 7 0 0 1 14 0z"/><path d="m7.6 11-1.8-2.9M16.4 11l1.8-2.9M9.5 14.6h.01M14.5 14.6h.01"/>',
        web: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z"/>'
    };
    const osIcon = (os) => OS_ICONS[os]
        ? `<svg class="os-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${OS_ICONS[os]}</svg>`
        : '';

    // Matches each platform's file-name pattern against the release assets.
    const downloadsFor = (app, release) => Object.entries(app.assets || {}).flatMap(([os, pattern]) => {
        const asset = release && release.assets.find((item) => new RegExp(pattern, 'i').test(item.name));
        return asset ? [{ os, label: PLATFORM_LABEL[os] || os, ...asset }] : [];
    });

    const platformsOf = (app) => [
        ...Object.keys(app.assets || {}).map((os) => PLATFORM_LABEL[os] || os),
        ...(app.web ? ['Web'] : []),
        ...(app.play ? ['Game'] : [])
    ];

    const appIcon = (app, size = '') => app.icon
        ? `<img class="app-icon ${size}" src="${esc(app.icon)}" alt="" loading="lazy" width="64" height="64">`
        : `<span class="app-icon app-icon-mono ${size}" aria-hidden="true">${esc(app.name.charAt(0))}</span>`;

    const appUrl = (app) => `/Skibidevs/apptic/?app=${encodeURIComponent(app.id)}`;

    // Only plain hex colors from the data file reach a style attribute.
    const tint = (color, extra = '') => {
        const hue = /^#[0-9a-f]{3,8}$/i.test(color || '') ? `--app:${color};` : '';
        return hue || extra ? ` style="${hue}${extra}"` : '';
    };

    // Matching names let a tile glide to its new spot when filters change or across pages.
    const tileName = (app) => `view-transition-name:tile-${String(app.id).replace(/[^a-z0-9-]/gi, '')};`;

    let appsPromise;
    const loadApps = () => {
        appsPromise ||= fetchJson('/Skibidevs/data/apptic.json').then((data) => data.apps);
        return appsPromise;
    };

    // The pill is part of the tile link: downloads always go through the app page, which explains unsigned installers first.
    const appCard = (app, extraClass = '') => {
        let action = '<span class="get is-muted">Soon</span>';
        if (app.repo) action = '<span class="get">Download</span>';
        else if (app.play) action = '<span class="get">Play</span>';
        else if (app.web) action = '<span class="get">Open</span>';
        const chips = platformsOf(app).map((name) => `<span class="chip">${esc(name)}</span>`).join('');

        return `
            <a class="tile tint ${extraClass}" href="${esc(appUrl(app))}"${tint(app.color, tileName(app))}>
                <span class="tile-top">${appIcon(app)}${action}</span>
                <span>
                    <span class="app-name">${esc(app.name)} <span class="version" data-version="${esc(app.id)}"></span></span>
                    <span class="tagline">${esc(app.tagline)}</span>
                </span>
                <span class="chips">${chips || '<span class="chip">In the works</span>'}</span>
            </a>`;
    };

    // Add the latest version to each row once its release is known.
    const hydrateCards = (apps) => {
        apps.filter((app) => app.repo).forEach(async (app) => {
            try {
                const release = await latestRelease(app.repo, app.tagPrefix);
                document.querySelectorAll(`[data-version="${CSS.escape(app.id)}"]`).forEach((node) => { node.textContent = release.tag; });
            } catch (error) {
                // Row keeps its platform chips; the app page falls back to GitHub's releases page.
            }
        });
    };

    const NOTE_TAGS = { feat: 'New', fix: 'Fix' };

    // Release notes are commit subjects ("- feat(ui): ..."). Only headings, bullets, bold and code
    // are rendered, always from already-escaped text; items past `limit` fold into "Show all".
    const notesHtml = (text, limit = 8) => {
        const inline = (line) => esc(line)
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        const blocks = String(text || '').split(/\r?\n/).map((raw) => raw.trim())
            // GitHub's auto-added compare link duplicates the "All releases" link under the notes.
            .filter((line) => line && !/^\*\*Full Changelog\*\*/i.test(line)).map((line) => {
            const item = line.match(/^[-*]\s+(.*)/);
            if (item) {
                const commit = item[1].match(/^([a-z]+)(\([^)]*\))?!?:\s*(.*)/i);
                const tag = commit && NOTE_TAGS[commit[1].toLowerCase()];
                const body = commit ? commit[3] : item[1];
                return { li: true, html: `<li>${tag ? `<span class="tag">${tag}</span> ` : ''}${inline(body)}</li>` };
            }
            if (/^#{1,6}\s/.test(line)) return { html: `<h3>${inline(line.replace(/^#+\s*/, ''))}</h3>` };
            return { html: `<p>${inline(line)}</p>` };
        });
        const render = (list) => list.reduce((html, block, i) => {
            const open = block.li && !(list[i - 1] || {}).li ? '<ul>' : '';
            const close = block.li && !(list[i + 1] || {}).li ? '</ul>' : '';
            return html + open + block.html + close;
        }, '');
        let seen = 0;
        const cut = blocks.findIndex((block) => block.li && ++seen > limit);
        if (cut < 0) return render(blocks);
        return `${render(blocks.slice(0, cut))}<details class="more"><summary>Show all</summary>${render(blocks.slice(cut))}</details>`;
    };

    const formatSize = (bytes) => bytes ? `${(bytes / 1048576).toFixed(bytes < 10485760 ? 1 : 0)} MB` : '';

    const initTheme = () => {
        const toggle = document.getElementById('themeToggle');
        if (!toggle) return;
        toggle.addEventListener('click', () => {
            const current = document.documentElement.dataset.theme
                || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
            const next = current === 'dark' ? 'light' : 'dark';
            document.documentElement.dataset.theme = next;
            try { localStorage.setItem('theme', next); } catch (error) { /* storage blocked: theme lasts this visit only */ }
        });
    };

    // Left nav app shortcuts and the right panel's latest releases. The panel stays hidden unless a release loads.
    const initSide = async () => {
        const quick = document.getElementById('quickApps');
        const panel = document.getElementById('releasePanel');
        let apps;
        try { apps = await loadApps(); } catch (error) { return; }

        if (quick) {
            quick.querySelector('ul').innerHTML = apps.map((app) => `
                <li><a class="tint" href="${esc(app.play || appUrl(app))}"${tint(app.color)}>${appIcon(app)}<span>${esc(app.name)}</span><span class="dot" aria-hidden="true"></span></a></li>`).join('');
            quick.hidden = false;
        }
        if (!panel) return;
        const list = document.getElementById('releaseList');
        const released = await Promise.all(apps.filter((app) => app.repo).map(async (app) => {
            try { return { app, release: await latestRelease(app.repo, app.tagPrefix) }; } catch (error) { return null; }
        }));
        const rows = released.filter(Boolean).sort((a, b) => new Date(b.release.date) - new Date(a.release.date));
        if (!rows.length) return;
        list.innerHTML = rows.map(({ app, release }) => `
            <li><a class="release tint" href="${esc(appUrl(app))}"${tint(app.color)}>${appIcon(app)}<span><strong>${esc(app.name)}</strong><span class="tag-line"><b>${esc(release.tag)}</b> &middot; ${esc(formatDate(release.date))}</span></span></a></li>`).join('');
        panel.hidden = false;
    };

    // Feeds the tile spotlight; fine pointers only, since touch has no hover.
    const initPointer = () => {
        if (!matchMedia('(pointer: fine)').matches) return;
        document.addEventListener('pointermove', (event) => {
            const tile = event.target.closest && event.target.closest('.tile');
            if (!tile) return;
            const box = tile.getBoundingClientRect();
            tile.style.setProperty('--mx', `${event.clientX - box.left}px`);
            tile.style.setProperty('--my', `${event.clientY - box.top}px`);
        }, { passive: true });
    };

    // Same-document swaps (filters) get an animated transition where supported and motion is welcome.
    const transition = (update) => {
        if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) update();
        else document.startViewTransition(update);
    };

    document.addEventListener('DOMContentLoaded', () => {
        initTheme();
        initSide();
        initPointer();
    });

    return { esc, fetchJson, formatDate, latestRelease, releasesOf, platform, osIcon, downloadsFor, platformsOf, appIcon, formatSize, appUrl, appCard, hydrateCards, notesHtml, loadApps, tint, tileName, transition };
}());
