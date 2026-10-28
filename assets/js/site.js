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

    // Unauthenticated GitHub API allows 60 requests/hour per visitor, so cache each release for an hour.
    // Apps sharing one repo (apptic-releases) tag releases "<app>-v1.2.3"; their newest matching release wins.
    const latestRelease = async (repo, tagPrefix = '') => {
        const key = `release:${repo}:${tagPrefix}`;
        const cached = store.get(key);
        if (cached && Date.now() - cached.at < RELEASE_TTL) return cached.release;

        const data = tagPrefix
            ? (await fetchJson(`https://api.github.com/repos/${repo}/releases?per_page=50`))
                .find((item) => !item.draft && !item.prerelease && item.tag_name.startsWith(tagPrefix))
            : await fetchJson(`https://api.github.com/repos/${repo}/releases/latest`);
        if (!data) throw new Error(`No ${tagPrefix} release in ${repo}`);
        const release = {
            tag: data.tag_name.slice(tagPrefix.length),
            date: data.published_at,
            notes: data.body || '',
            url: data.html_url,
            assets: (data.assets || []).map((asset) => ({ name: asset.name, url: asset.browser_download_url, size: asset.size }))
        };
        store.set(key, { at: Date.now(), release });
        return release;
    };

    const platform = () => {
        const agent = navigator.userAgent;
        if (/Android/i.test(agent)) return 'android';
        if (/Windows/i.test(agent)) return 'windows';
        if (/iPhone|iPad|Macintosh/i.test(agent)) return 'apple';
        if (/Linux/i.test(agent)) return 'linux';
        return 'other';
    };

    const PLATFORM_LABEL = { windows: 'Windows', linux: 'Linux', android: 'Android' };

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

    // The pill is part of the row link: downloads always go through the app page, which explains unsigned installers first.
    const appCard = (app) => {
        let action = '<span class="get is-muted">Soon</span>';
        if (app.repo) action = '<span class="get">Get</span>';
        else if (app.play) action = '<span class="get">Play</span>';
        else if (app.web) action = '<span class="get">Open</span>';
        const chips = platformsOf(app).map((name) => `<span class="chip">${esc(name)}</span>`).join('');

        return `
            <a class="app-row" href="${esc(appUrl(app))}">
                ${appIcon(app)}
                <span class="app-text">
                    <span class="app-name">${esc(app.name)} <span class="version" data-version="${esc(app.id)}"></span></span>
                    <span class="tagline">${esc(app.tagline)}</span>
                    <span class="chips">${chips || '<span class="chip">In the works</span>'}</span>
                </span>
                ${action}
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

    const initNav = () => {
        const path = location.pathname;
        document.querySelectorAll('.tabs a').forEach((link) => {
            if (!path.startsWith(new URL(link.href).pathname)) return;
            link.setAttribute('aria-current', 'page');
        });
    };

    document.addEventListener('DOMContentLoaded', () => {
        initTheme();
        initNav();
    });

    return { esc, fetchJson, formatDate, latestRelease, platform, downloadsFor, platformsOf, appIcon, formatSize, appUrl, appCard, hydrateCards, notesHtml };
}());
