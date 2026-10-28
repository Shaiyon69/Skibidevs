document.addEventListener('DOMContentLoaded', async () => {
    const SD = window.SD;
    const { esc } = SD;
    const FILTERS = ['All', 'Windows', 'Android', 'Linux', 'Web', 'Game'];
    const storeView = document.getElementById('storeView');
    const appView = document.getElementById('appView');
    const grid = document.getElementById('appGrid');

    let apps = [];
    try {
        apps = await SD.loadApps();
    } catch (error) {
        grid.innerHTML = '<div class="empty">Couldn\'t load the app list. Refresh to try again.</div>';
        return;
    }

    const renderStore = (missingId) => {
        const filters = document.getElementById('appFilters');
        // Only offer filters that match at least one app.
        const names = FILTERS.filter((name) => name === 'All' || apps.some((app) => SD.platformsOf(app).includes(name)));
        filters.innerHTML = names.map((name) =>
            `<button class="filter" type="button" aria-pressed="${name === 'All'}" data-filter="${name}">${name}</button>`).join('');

        if (missingId) {
            filters.insertAdjacentHTML('beforebegin', `<div class="empty notice" role="status">There's no app called &ldquo;${esc(missingId)}&rdquo; here. Here are all the apps.</div>`);
        }

        const draw = (active) => {
            const shown = apps.filter((app) => active === 'All' || SD.platformsOf(app).includes(active));
            grid.innerHTML = shown.length
                ? shown.map(SD.appCard).join('')
                : '<div class="empty">Nothing for that platform yet.</div>';
            SD.hydrateCards(shown);
        };

        // Buttons stay in place and only flip aria-pressed, so keyboard focus survives a filter change.
        filters.addEventListener('click', (event) => {
            const button = event.target.closest('[data-filter]');
            if (!button) return;
            SD.transition(() => {
                filters.querySelectorAll('[data-filter]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
                draw(button.dataset.filter);
            });
        });
        draw('All');
    };

    // Builds are unsigned, so each platform's guide walks through the warning it will show.
    const INSTALL_STEPS = {
        windows: ['Windows', [
            'Download the installer (<code>.exe</code>).',
            'Open it. Windows may say &ldquo;Windows protected your PC&rdquo; because the installer isn\'t signed. Choose <b>More info</b>, then <b>Run anyway</b>.',
            'Finish the setup, then open the app from the Start menu.'
        ]],
        android: ['Android', [
            'Download the <code>.apk</code> on your phone.',
            'Open it. Android asks to allow installs from your browser: allow it for this download.',
            'Tap <b>Install</b>, then <b>Open</b>.'
        ]],
        linux: ['Linux', [
            'Download the <code>.AppImage</code>.',
            'Make it executable: right-click &rarr; Properties &rarr; Allow executing, or run <code>chmod +x</code> on the file.',
            'Double-click it to run. Nothing else to install.'
        ]],
        web: ['Browser', ['Open it in any modern browser. Nothing to install: sign in and you\'re in.']],
        play: ['Browser', ['Open the Playroom and press <b>Play in browser</b>.', 'The game loads about 70 MB once, so Wi-Fi helps.', 'Plays best with a keyboard and mouse.']]
    };

    // Right panel guide; the visitor's own platform starts open.
    const showGuide = (app) => {
        const systems = [...Object.keys(app.assets || {}), ...(app.web ? ['web'] : []), ...(app.play ? ['play'] : [])]
            .filter((os) => INSTALL_STEPS[os]);
        if (!systems.length) return;
        const mine = systems.includes(SD.platform()) ? SD.platform() : systems[0];
        document.getElementById('installList').innerHTML = systems.map((os) => `
            <details${os === mine ? ' open' : ''}>
                <summary>${INSTALL_STEPS[os][0]}</summary>
                <ol class="steps">${INSTALL_STEPS[os][1].map((step) => `<li>${step}</li>`).join('')}</ol>
            </details>`).join('');
        document.getElementById('installPanel').hidden = false;
    };

    // Right panel downloads: one row per platform. Once the latest release is known each row is a
    // direct link to that platform's file. state: 'loading', 'ready', 'none' (nothing published yet)
    // or 'offline' (GitHub unreachable: send the visitor to the release page instead).
    const showDownloads = (app, release, state) => {
        const files = release ? SD.downloadsFor(app, release) : [];
        // Prefixed apps share the Skibidevs repo's releases, so its release page is no help to a visitor.
        const releasesPage = app.repo && !app.tagPrefix ? `https://github.com/${app.repo}/releases/latest` : '';
        const rows = Object.keys(app.assets || {}).map((os) => {
            const file = files.find((item) => item.os === os);
            const label = INSTALL_STEPS[os] ? INSTALL_STEPS[os][0] : os;
            if (file) return { os, href: file.url, label, detail: [release.tag, SD.formatSize(file.size)].filter(Boolean).join(' · '), action: 'Download' };
            if (state === 'loading') return { os, label, detail: 'Checking the latest release…' };
            if (state === 'offline' && releasesPage) return { os, href: releasesPage, label, detail: 'From GitHub releases', action: 'Download', external: true };
            return { os, label, detail: 'Not released yet', muted: 'Soon' };
        });
        if (app.web) rows.push({ os: 'web', href: app.web, label: 'Browser', detail: 'No install', action: 'Open', external: true });
        if (app.play) rows.push({ os: 'web', href: app.play, label: 'Browser', detail: 'About 70 MB, no install', action: 'Play' });
        const text = (row) => `<span class="dl-text">${SD.osIcon(row.os)}<span><strong>${esc(row.label)}</strong><span class="meta">${esc(row.detail)}</span></span></span>`;
        document.getElementById('downloadList').innerHTML = rows.length
            ? rows.map((row) => (row.href ? `
                <a class="dl-row" href="${esc(row.href)}"${row.external ? ' rel="noopener"' : ''}>
                    ${text(row)}<span class="get">${row.action}</span>
                </a>` : `
                <div class="dl-row">${text(row)}${row.muted ? `<span class="get is-muted">${row.muted}</span>` : ''}</div>`)).join('')
            : '<p class="meta">Coming soon. Downloads show up here once the first build is published.</p>';
        document.getElementById('downloadPanel').hidden = false;
    };

    // The strip holds three copies so it can keep moving right forever; only the middle copy is
    // exposed to screen readers and the Tab key.
    const shotHtml = (shot, clone) => `
        <figure${clone ? ' aria-hidden="true"' : ''}>
            <a href="${esc(shot.src)}" target="_blank" rel="noopener"${clone ? ' tabindex="-1"' : ''}><img src="${esc(shot.src)}" alt="${clone ? '' : esc(shot.caption)}" loading="lazy"></a>
            <figcaption>${esc(shot.caption)}</figcaption>
        </figure>`;

    // What the app looks like: a swipeable strip of captioned screenshots; each opens full size.
    const previewHtml = (app) => (app.screenshots || []).length ? `
        <section class="block preview">
            <div class="preview-head">
                <h2>Preview</h2>
                <div class="preview-ctl">
                    <button class="icon-btn" type="button" data-shot="prev" aria-label="Previous screenshot"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button>
                    <button class="icon-btn" type="button" data-shot="pause" aria-label="Pause slideshow" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5v14M15 5v14"/></svg></button>
                    <button class="icon-btn" type="button" data-shot="next" aria-label="Next screenshot"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button>
                </div>
            </div>
            <div class="shots" tabindex="0" aria-label="${esc(app.name)} screenshots">
                ${[0, 1, 2].map((copy) => app.screenshots.map((shot) => shotHtml(shot, copy !== 1)).join('')).join('')}
            </div>
            <div class="shot-dots">${app.screenshots.map((shot, i) => `<button type="button" data-dot="${i}" aria-label="Screenshot ${i + 1}: ${esc(shot.caption)}"></button>`).join('')}</div>
        </section>` : '';

    // Slideshow: advances to the right every few seconds, forever. Hover, focus or touch pauses it,
    // the pause button stops it for good, and reduced motion never starts it.
    const startSlideshow = () => {
        const strip = document.querySelector('.shots');
        if (!strip) return;
        const figures = [...strip.children];
        const count = figures.length / 3;
        const dots = [...document.querySelectorAll('.shot-dots button')];
        const pauseBtn = document.querySelector('[data-shot="pause"]');
        const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
        let pos = count;
        let held = false;
        let stopped = still;
        let settle;

        // The current screenshot is the one centered in the strip; its dot and frame light up.
        const offset = (fig) => {
            const box = fig.getBoundingClientRect();
            const frame = strip.getBoundingClientRect();
            return box.left + box.width / 2 - (frame.left + frame.width / 2);
        };
        const mark = () => {
            dots.forEach((dot, i) => dot.setAttribute('aria-current', String(i === pos % count)));
            figures.forEach((fig, i) => fig.classList.toggle('on', i === pos));
        };
        const center = (instant) => {
            strip.scrollBy({ left: offset(figures[pos]), behavior: instant || still ? 'instant' : 'smooth' });
            mark();
        };
        // Once a move settles in an outer copy, jump to the same shot in the middle copy. The copies
        // match, and transitions are off for that frame, so the jump can't be seen.
        const recenter = () => {
            if (pos >= count && pos < 2 * count) return;
            pos = count + (pos % count);
            strip.classList.add('no-anim');
            center(true);
            requestAnimationFrame(() => requestAnimationFrame(() => strip.classList.remove('no-anim')));
        };
        const go = (next) => {
            pos = Math.max(0, Math.min(figures.length - 1, next));
            center(false);
        };
        // Track the centered shot while swiping, and recenter once scrolling stops.
        strip.addEventListener('scroll', () => {
            pos = figures.reduce((best, fig, i) => (Math.abs(offset(fig)) < Math.abs(offset(figures[best])) ? i : best), 0);
            mark();
            clearTimeout(settle);
            settle = setTimeout(recenter, 150);
        }, { passive: true });
        document.querySelector('.shot-dots').addEventListener('click', (event) => {
            const dot = event.target.closest('[data-dot]');
            if (dot) go(pos - (pos % count) + Number(dot.dataset.dot));
        });
        center(true);

        const setStopped = (value) => {
            stopped = value;
            pauseBtn.setAttribute('aria-pressed', String(value));
            pauseBtn.setAttribute('aria-label', value ? 'Play slideshow' : 'Pause slideshow');
            pauseBtn.innerHTML = value
                ? '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>'
                : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 5v14M15 5v14"/></svg>';
        };
        setStopped(stopped);

        document.querySelector('.preview-ctl').addEventListener('click', (event) => {
            const action = event.target.closest('[data-shot]')?.dataset.shot;
            if (action === 'prev') go(pos - 1);
            if (action === 'next') go(pos + 1);
            if (action === 'pause') setStopped(!stopped);
        });
        ['pointerenter', 'focusin', 'touchstart'].forEach((type) => strip.addEventListener(type, () => { held = true; }, { passive: true }));
        ['pointerleave', 'focusout'].forEach((type) => strip.addEventListener(type, () => { held = false; }));

        if (count > 1) setInterval(() => { if (!stopped && !held && !document.hidden) go(pos + 1); }, 4000);
    };

    // Right panel on an app page: every version with its files, newest first; older ones fold away.
    const showVersions = (app, releases) => {
        const item = (release, i) => {
            const files = SD.downloadsFor(app, release);
            return `
                <li class="ver">
                    <div class="ver-head"><b>${esc(release.tag)}</b><span class="meta">${esc(SD.formatDate(release.date))}</span>${i === 0 ? '<span class="tag">Latest</span>' : ''}</div>
                    <div class="ver-files">${files.length
                        ? files.map((file) => `<a class="file" href="${esc(file.url)}">${esc(file.label)}${file.size ? ` <span class="size">${esc(SD.formatSize(file.size))}</span>` : ''}</a>`).join('')
                        : `<a class="file" href="${esc(release.url)}" rel="noopener">Release page</a>`}</div>
                </li>`;
        };
        const shown = releases.slice(0, 5).map(item).join('');
        const older = releases.slice(5).map((release, i) => item(release, i + 5)).join('');
        document.getElementById('versionList').innerHTML = shown;
        document.getElementById('olderVersions').innerHTML = older
            ? `<details class="more"><summary>${releases.length - 5} older</summary><ol class="version-list">${older}</ol></details>` : '';
        document.getElementById('versionPanel').hidden = false;
    };

    // Phones get a docked copy of the primary button once the real one scrolls out of view.
    const dockPrimary = (app) => {
        const primary = document.querySelector('#getBox .btn');
        if (!primary || !('IntersectionObserver' in window)) return;
        const bar = document.createElement('div');
        bar.className = 'get-bar';
        bar.hidden = true;
        bar.innerHTML = `${SD.appIcon(app)}<strong>${esc(app.name)}</strong>`;
        const copy = primary.cloneNode(true);
        copy.querySelector('.size')?.remove();
        bar.append(copy);
        document.body.append(bar);
        new IntersectionObserver(([entry]) => {
            bar.hidden = entry.isIntersecting;
            document.body.classList.toggle('has-getbar', !entry.isIntersecting);
        }).observe(primary);
    };

    const renderApp = async (app) => {
        storeView.hidden = true;
        appView.hidden = false;
        document.body.classList.add('is-detail');
        document.title = `${app.name} · Apps · Skibidevs`;

        // Apps with a tag prefix publish binaries in the Skibidevs repo; their source is private.
        const source = app.repo && !app.tagPrefix ? `https://github.com/${app.repo}` : '';
        // The whole page takes the app's hue: back link, buttons, notes and the tab bar pill.
        if (/^#[0-9a-f]{3,8}$/i.test(app.color || '')) document.body.style.setProperty('--app', app.color);
        appView.innerHTML = `
            <a class="back" href="/Skibidevs/apptic/">&larr; All apps</a>
            <header class="app-hero">
                ${SD.appIcon(app, 'lg')}
                <div>
                    <p class="eyebrow">Apptic</p>
                    <h1>${esc(app.name)}</h1>
                    <p class="tagline">${esc(app.tagline)}</p>
                    <p class="meta" id="releaseMeta">${esc(SD.platformsOf(app).join(' · ') || 'In the works')}</p>
                    <div class="get-box" id="getBox" aria-live="polite"></div>
                </div>
            </header>
            ${previewHtml(app)}
            <div class="detail-grid">
                <div>
                    <section class="block">
                        <h2>What it does</h2>
                        <p>${esc(app.description)}</p>
                    </section>
                    <div id="notes" hidden></div>
                </div>
                <div>
                    ${source ? `<section class="block"><h2>Source</h2><p>Free and open source. <a href="${esc(source)}" rel="noopener">View on GitHub</a></p></section>` : ''}
                </div>
            </div>`;
        startSlideshow();
        showDownloads(app, null, 'loading');
        showGuide(app);

        const getBox = document.getElementById('getBox');
        const extras = [
            app.play ? `<a class="btn btn-lg" href="${esc(app.play)}">Play in browser</a>` : '',
            app.web ? `<a class="btn${app.repo ? ' btn-ghost' : ''} btn-lg" href="${esc(app.web)}" rel="noopener">Open in browser</a>` : ''
        ].join('');

        if (!app.repo) {
            getBox.innerHTML = extras
                ? `<div class="actions">${extras}</div>${app.web ? '<p class="meta">Desktop and phone downloads are coming soon.</p>' : ''}`
                : '<p class="meta">Coming soon. Downloads show up here once the first build is published.</p>';
            dockPrimary(app);
            return;
        }

        getBox.innerHTML = '<p class="meta">Checking the latest release&hellip;</p>';
        try {
            const releases = await SD.releasesOf(app.repo, app.tagPrefix);
            const release = releases[0];
            const downloads = SD.downloadsFor(app, release);
            const os = SD.platform();
            const primary = downloads.find((item) => item.os === os) || downloads[0];
            const others = downloads.filter((item) => item !== primary);

            getBox.innerHTML = `
                <div class="actions">
                    ${primary
                        ? `<a class="btn btn-lg" href="${esc(primary.url)}">${SD.osIcon(primary.os)}Download for ${esc(primary.label)}${primary.size ? ` <span class="size">${esc(SD.formatSize(primary.size))}</span>` : ''}</a>`
                        : `<a class="btn btn-lg" href="${esc(release.url)}" rel="noopener">See release files</a>`}
                    ${extras}
                </div>
                ${others.length ? `
                    <div class="other-slot">
                        <button class="other-toggle" type="button" aria-expanded="false" aria-controls="otherList">Other platforms</button>
                        <div class="other-list" id="otherList" inert>
                            ${others.map((item, i) => `<a class="btn btn-ghost" href="${esc(item.url)}" style="--i:${i}">${SD.osIcon(item.os)}${esc(item.label)}${item.size ? ` <span class="size">${esc(SD.formatSize(item.size))}</span>` : ''}</a>`).join('')}
                        </div>
                    </div>` : ''}`;
            // The toggle and the buttons share one grid cell, so swapping them never resizes the box.
            const slot = getBox.querySelector('.other-slot');
            slot?.querySelector('.other-toggle').addEventListener('click', (event) => {
                event.currentTarget.setAttribute('aria-expanded', 'true');
                event.currentTarget.inert = true;
                slot.querySelector('.other-list').inert = false;
                slot.classList.add('open');
                slot.querySelector('.other-list a').focus();
            });
            document.getElementById('releaseMeta').textContent =
                [release.tag, `Released ${SD.formatDate(release.date)}`, ...SD.platformsOf(app)].join(' · ');

            const notes = SD.notesHtml(release.notes);
            if (notes) {
                document.getElementById('notes').hidden = false;
                document.getElementById('notes').innerHTML = `
                    <section class="block">
                        <h2>What's new in ${esc(release.tag)}</h2>
                        <div class="notes">${notes}</div>
                        <div class="row-links"><a href="${esc(release.url.replace(/\/tag\/.*$/, ''))}" rel="noopener">All releases</a></div>
                    </section>`;
            }
            showDownloads(app, release, 'ready');
            showVersions(app, releases);
        } catch (error) {
            const offline = !error.unreleased && !app.tagPrefix;
            getBox.innerHTML = offline ? `
                <div class="actions">
                    <a class="btn btn-lg" href="https://github.com/${esc(app.repo)}/releases/latest" rel="noopener">Download from GitHub</a>
                    ${extras}
                </div>
                <p class="meta">Couldn't reach GitHub just now, so this opens the release page instead.</p>` : `
                ${extras ? `<div class="actions">${extras}</div>` : ''}
                <p class="meta">Not released yet. Downloads show up here as soon as the first build is published.</p>`;
            showDownloads(app, null, offline ? 'offline' : 'none');
        }
        dockPrimary(app);
    };

    const id = new URLSearchParams(location.search).get('app');
    const app = id && apps.find((item) => item.id === id);
    if (app) renderApp(app);
    else renderStore(id);
});
