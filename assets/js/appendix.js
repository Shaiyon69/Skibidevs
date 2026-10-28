document.addEventListener('DOMContentLoaded', async () => {
    const { esc, fetchJson } = window.SD;
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

    const card = (project) => {
        const buttons = [
            project.apptic ? `<a class="btn btn-sm" href="/Skibidevs/apptic/?app=${encodeURIComponent(project.apptic)}">In the Apptic</a>` : '',
            project.liveUrl && !project.apptic ? `<a class="btn btn-sm" href="${esc(project.liveUrl)}" rel="noopener">Live</a>` : '',
            project.githubUrl ? `<a class="btn btn-ghost btn-sm" href="${esc(project.githubUrl)}" rel="noopener">GitHub</a>` : ''
        ].join('');
        return `
            <article class="card project-card">
                <img src="${esc(project.image || '/Skibidevs/assets/img/task.svg')}" alt="" loading="lazy" width="600" height="300">
                <div class="inner">
                    <div class="chips"><span class="chip is-tape">${esc(project.category || 'Project')}</span></div>
                    <h3>${esc(project.name)}</h3>
                    <p class="desc">${esc(project.description)}</p>
                    ${(project.features || []).length ? `<ul>${project.features.slice(0, 4).map((item) => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}
                    <div class="chips">${(project.techStack || []).map((tech) => `<span class="chip">${esc(tech)}</span>`).join('')}</div>
                    ${buttons ? `<div class="actions">${buttons}</div>` : ''}
                </div>
            </article>`;
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
        grid.innerHTML = projects.filter((project) => active === 'All' || project.category === active).map(card).join('');
        // Preview images come from GitHub and fail for private or renamed repos.
        grid.querySelectorAll('img').forEach((img) => img.addEventListener('error', () => {
            img.src = '/Skibidevs/assets/img/task.svg';
        }, { once: true }));
    };

    filters.addEventListener('click', (event) => {
        const button = event.target.closest('[data-filter]');
        if (!button) return;
        active = button.dataset.filter;
        // Flip state in place so keyboard focus stays on the pressed button.
        filters.querySelectorAll('[data-filter]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
        draw();
    });
    draw();
});
