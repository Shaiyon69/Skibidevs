document.addEventListener('DOMContentLoaded', async () => {
    const { fetchJson, appCard, hydrateCards, loadPosts, postRow } = window.SD;
    const apps = document.getElementById('homeApps');
    const posts = document.getElementById('homePosts');

    try {
        const data = await fetchJson('/Skibidevs/data/apptic.json');
        const featured = data.apps.filter((app) => app.featured).slice(0, 4);
        apps.innerHTML = featured.map(appCard).join('');
        hydrateCards(featured);
    } catch (error) {
        apps.innerHTML = '<div class="empty">Couldn\'t load the Apptic. <a href="/Skibidevs/apptic/">Try the store page</a>.</div>';
    }

    try {
        const list = await loadPosts();
        posts.innerHTML = list.length
            ? list.slice(0, 3).map(postRow).join('')
            : '<div class="empty">No posts yet.</div>';
    } catch (error) {
        posts.innerHTML = '<div class="empty">Couldn\'t load the Scrappbook. <a href="/Skibidevs/scrappbook/">Try the Scrappbook page</a>.</div>';
    }
});
