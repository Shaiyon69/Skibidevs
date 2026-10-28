document.addEventListener('DOMContentLoaded', async () => {
    const SD = window.SD;
    const { esc } = SD;
    const FILTERS = ['All', 'Windows', 'Android', 'Linux', 'Web', 'Game'];
    const storeView = document.getElementById('storeView');
    const appView = document.getElementById('appView');
    const grid = document.getElementById('appGrid');

    let apps = [];
    try {
        apps = (await SD.fetchJson('/Skibidevs/data/apptic.json')).apps;
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
            filters.querySelectorAll('[data-filter]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
            draw(button.dataset.filter);
        });
        draw('All');
    };

    // Builds are unsigned, so each platform shows a warning on first install.
    const INSTALL_HELP = {
        windows: ['Windows', 'Windows may say &ldquo;Windows protected your PC&rdquo; because the installer isn\'t signed. Choose <b>More info</b>, then <b>Run anyway</b>.'],
        android: ['Android', 'Android will ask you to allow installs from your browser. Allow it for this download, then open the APK.'],
        linux: ['Linux', 'Make the AppImage executable (Properties &rarr; Allow executing, or <code>chmod +x</code>), then run it.']
    };

    const installHelp = (systems) => {
        const tips = [...new Set(systems)].filter((os) => INSTALL_HELP[os]);
        return tips.length ? `
            <section class="block install">
                <h2>Installing</h2>
                ${tips.map((os) => `<details><summary>${INSTALL_HELP[os][0]}</summary><p>${INSTALL_HELP[os][1]}</p></details>`).join('')}
            </section>` : '';
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
        document.title = `${app.name} · Apps · Skibidevs`;

        const source = app.repo && app.repo !== 'Shaiyon69/apptic-releases' ? `https://github.com/${app.repo}` : '';
        appView.innerHTML = `
            <a class="back" href="/Skibidevs/apptic/">&larr; All apps</a>
            <header class="detail-head">
                ${SD.appIcon(app, 'lg')}
                <div>
                    <h1>${esc(app.name)}</h1>
                    <p class="tagline">${esc(app.tagline)}</p>
                    <p class="meta" id="releaseMeta">${esc(SD.platformsOf(app).join(' · ') || 'In the works')}</p>
                </div>
            </header>
            <div class="get-box" id="getBox" aria-live="polite"></div>
            <section class="block">
                <h2>About</h2>
                <p>${esc(app.description)}</p>
            </section>
            <div id="notes"></div>
            <div id="install"></div>
            ${source ? `<section class="block"><h2>Source</h2><p>Free and open source. <a href="${esc(source)}" rel="noopener">View on GitHub</a></p></section>` : ''}`;

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
            const release = await SD.latestRelease(app.repo, app.tagPrefix);
            const downloads = SD.downloadsFor(app, release);
            const os = SD.platform();
            const primary = downloads.find((item) => item.os === os) || downloads[0];
            const others = downloads.filter((item) => item !== primary);

            getBox.innerHTML = `
                <div class="actions">
                    ${primary
                        ? `<a class="btn btn-lg" href="${esc(primary.url)}">Download for ${esc(primary.label)}${primary.size ? ` <span class="size">${esc(SD.formatSize(primary.size))}</span>` : ''}</a>`
                        : `<a class="btn btn-lg" href="${esc(release.url)}" rel="noopener">See release files</a>`}
                    ${extras}
                </div>
                ${others.length ? `
                    <details class="other">
                        <summary>Other platforms</summary>
                        <ul>${others.map((item) => `<li><a class="btn btn-ghost" href="${esc(item.url)}">${esc(item.label)}${item.size ? ` <span class="size">${esc(SD.formatSize(item.size))}</span>` : ''}</a></li>`).join('')}</ul>
                    </details>` : ''}`;
            document.getElementById('releaseMeta').textContent =
                [release.tag, `Released ${SD.formatDate(release.date)}`, ...SD.platformsOf(app)].join(' · ');

            const notes = SD.notesHtml(release.notes);
            if (notes) {
                document.getElementById('notes').innerHTML = `
                    <section class="block">
                        <h2>What's new in ${esc(release.tag)}</h2>
                        <div class="notes">${notes}</div>
                        <div class="row-links"><a href="${esc(release.url.replace(/\/tag\/.*$/, ''))}" rel="noopener">All releases</a></div>
                    </section>`;
            }
            document.getElementById('install').innerHTML = installHelp(downloads.map((item) => item.os));
        } catch (error) {
            getBox.innerHTML = `
                <div class="actions">
                    <a class="btn btn-lg" href="https://github.com/${esc(app.repo)}/releases${app.tagPrefix ? '' : '/latest'}" rel="noopener">Download from GitHub</a>
                    ${extras}
                </div>
                <p class="meta">Couldn't reach GitHub just now, so this opens the release page instead.</p>`;
            document.getElementById('install').innerHTML = installHelp(Object.keys(app.assets || {}));
        }
        dockPrimary(app);
    };

    const id = new URLSearchParams(location.search).get('app');
    const app = id && apps.find((item) => item.id === id);
    if (app) renderApp(app);
    else renderStore(id);
});
