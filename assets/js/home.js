document.addEventListener('DOMContentLoaded', async () => {
    const { esc, fetchJson, appIcon, appUrl, appCard, hydrateCards } = window.SD;
    const feature = document.getElementById('homeFeature');
    const list = document.getElementById('homeApps');

    try {
        // Convallaria has its own banner below, so it stays out of the app list.
        const apps = (await fetchJson('/Skibidevs/data/apptic.json')).apps.filter((app) => !app.play);
        const top = apps.find((app) => app.featured && app.repo) || apps[0];
        feature.innerHTML = top ? `
            <a class="feature" href="${esc(appUrl(top))}">
                ${appIcon(top)}
                <div>
                    <span class="label">Featured</span>
                    <h2>${esc(top.name)}</h2>
                    <p>${esc(top.tagline)}</p>
                </div>
                <span class="btn">Get ${esc(top.name)}</span>
            </a>` : '';
        list.innerHTML = apps.map(appCard).join('');
        hydrateCards(apps);
    } catch (error) {
        list.innerHTML = '<div class="empty">Couldn\'t load the apps. <a href="/Skibidevs/apptic/">Try the Apps page</a>.</div>';
    }
});
