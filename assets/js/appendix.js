document.addEventListener('DOMContentLoaded', async () => {
    const { esc, fetchJson, appIcon, tint, transition } = window.SD;
    const grid = document.getElementById('projectGrid');
    const filters = document.getElementById('projectFilters');

    let projects = [];
    try {
        projects = (await fetchJson('/Skibidevs/data/projects.json')).projects || [];
    } catch (error) {
        grid.innerHTML = '<div class="empty">Couldn\'t load projects. Refresh to try again.</div>';
        return;
    }

    const categories = ['All', ...new Set(projects.map((project) => project.category).filter(Boolean))];
    let active = 'All';
    // Each category gets the next hue, so cards group by color without a hand-kept map.
    const HUES = ['#22d3ee', '#a78bfa', '#f472b6', '#4ade80', '#fbbf24', '#f97316', '#3b82f6'];
    const hueOf = (project) => HUES[Math.max(0, categories.indexOf(project.category) - 1) % HUES.length];

    // GitHub preview cards are wide banners full of text, so only local app art works as an icon.
    const iconOf = (project) => (/^\/Skibidevs\/(assets\/img\/apps|webvallaria)\//.test(project.image || '') ? project.image : '');

    const row = (project) => {
        let href = '';
        let action = '';
        if (project.apptic) [href, action] = [`/Skibidevs/apptic/?app=${encodeURIComponent(project.apptic)}`, 'Download'];
        else if (project.liveUrl) [href, action] = [project.liveUrl, 'Open'];
        else if (project.githubUrl) [href, action] = [project.githubUrl, 'Code'];
        const tag = href ? 'a' : 'div';
        const chips = [project.category, ...(project.techStack || []).slice(0, 3)].filter(Boolean)
            .map((name) => `<span class="chip">${esc(name)}</span>`).join('');
        return `
            <${tag} class="tile tint project-tile"${href ? ` href="${esc(href)}"${href.startsWith('http') ? ' rel="noopener"' : ''}` : ''}${tint(hueOf(project))}>
                <span class="tile-top">${appIcon({ name: project.name, icon: iconOf(project) })}${action ? `<span class="get">${action}</span>` : ''}</span>
                <span>
                    <span class="app-name">${esc(project.name)}</span>
                    <span class="tagline">${esc(project.description)}</span>
                </span>
                <span class="chips">${chips}</span>
            </${tag}>`;
    };

    // Filters only earn their place once some category holds a few projects.
    const counts = projects.reduce((all, project) => ({ ...all, [project.category]: (all[project.category] || 0) + 1 }), {});
    if (Object.values(counts).some((count) => count >= 3)) {
        filters.innerHTML = categories.map((name) =>
            `<button class="filter" type="button" aria-pressed="${name === active}" data-filter="${esc(name)}">${esc(name)}</button>`).join('');
    } else {
        filters.hidden = true;
    }

    const draw = () => {
        grid.innerHTML = projects.filter((project) => active === 'All' || project.category === active).map(row).join('');
    };

    filters.addEventListener('click', (event) => {
        const button = event.target.closest('[data-filter]');
        if (!button) return;
        active = button.dataset.filter;
        // Flip state in place so keyboard focus stays on the pressed button.
        transition(() => {
            filters.querySelectorAll('[data-filter]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
            draw();
        });
    });
    draw();
});
