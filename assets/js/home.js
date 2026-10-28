document.addEventListener('DOMContentLoaded', async () => {
    const { esc, appIcon, appUrl, appCard, hydrateCards, loadApps, tint, tileName } = window.SD;
    const tiles = document.getElementById('homeTiles');

    try {
        const apps = await loadApps();
        const top = apps.find((app) => app.featured && app.repo) || apps[0];
        // The game gets a wide tile of its own; the featured app gets the big one.
        const games = apps.filter((app) => app.play);
        const rest = apps.filter((app) => app !== top && !app.play);
        const feature = top ? `
            <a class="tile tint tile-feature" href="${esc(appUrl(top))}"${tint(top.color, tileName(top))}>
                ${appIcon(top)}
                <span class="eyebrow">Featured</span>
                <h2>${esc(top.name)}</h2>
                <p>${esc(top.description || top.tagline)}</p>
                <span class="btn">Download ${esc(top.name)}</span>
            </a>` : '';
        const play = games.map((game) => `
            <a class="tile tint tile-wide" href="${esc(game.play)}"${tint(game.color, tileName(game))}>
                ${appIcon(game)}
                <span>
                    <span class="eyebrow">Playroom</span>
                    <span class="app-name">${esc(game.name)}</span>
                    <span class="tagline">${esc(game.tagline)} Runs in your browser.</span>
                </span>
                <span class="get">Play</span>
            </a>`).join('');
        tiles.innerHTML = feature + rest.map((app) => appCard(app)).join('') + play;
        hydrateCards(rest);
    } catch (error) {
        tiles.innerHTML = '<div class="empty">Couldn\'t load the apps. <a href="/Skibidevs/apptic/">Try the Apps page</a>.</div>';
    }
});
