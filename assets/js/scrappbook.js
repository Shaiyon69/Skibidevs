document.addEventListener('DOMContentLoaded', async () => {
    const { esc, formatDate, loadPosts, postRow } = window.SD;
    const listView = document.getElementById('listView');
    const postView = document.getElementById('postView');
    const list = document.getElementById('postList');
    const search = document.getElementById('postSearch');

    let posts;
    try {
        posts = await loadPosts();
    } catch (error) {
        list.innerHTML = '<div class="empty">Couldn\'t load the Scrappbook. Refresh to try again.</div>';
        return;
    }

    const bullets = (title, items) => (items || []).length
        ? `<h2>${esc(title)}</h2><ul>${items.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`
        : '';

    const renderPost = (post) => {
        listView.hidden = true;
        postView.hidden = false;
        document.title = `${post.title} · Scrappbook · Skibidevs`;
        postView.innerHTML = `
            <a class="back" href="/Skibidevs/scrappbook/">&larr; All posts</a>
            <div class="post-meta">
                <span>${esc(formatDate(post.date))}</span>
                ${post.project ? `<span class="project">${esc(post.project)}</span>` : ''}
                ${post.readingTime ? `<span>${esc(post.readingTime)}</span>` : ''}
            </div>
            <h1>${esc(post.title)}</h1>
            <div class="chips">${(post.tags || []).map((tag) => `<span class="chip">${esc(tag)}</span>`).join('')}</div>
            <div class="body">${esc(post.content || post.body || post.summary)}</div>
            ${bullets('What changed', post.whatChanged)}
            ${bullets('Technical notes', post.technicalNotes)}
            ${post.comments ? `<div class="note">${esc(post.comments)}</div>` : ''}
            ${(post.links || []).length ? `<div class="links">${post.links.map((link) =>
                `<a class="btn btn-ghost btn-sm" href="${esc(link.url)}"${/^https?:/.test(link.url) ? ' rel="noopener"' : ''}>${esc(link.label)}</a>`).join('')}</div>` : ''}`;
    };

    const renderList = () => {
        const query = search.value.trim().toLowerCase();
        const shown = posts.filter((post) => !query || [post.title, post.project, post.summary, ...(post.tags || [])]
            .join(' ').toLowerCase().includes(query));
        list.innerHTML = shown.length
            ? shown.map(postRow).join('')
            : `<div class="empty">${posts.length ? 'No posts match that search.' : 'No posts yet.'}</div>`;
    };

    const id = new URLSearchParams(location.search).get('post');
    const post = id && posts.find((item) => item.id === id);
    if (post) {
        renderPost(post);
    } else {
        if (id) {
            search.insertAdjacentHTML('beforebegin', `<div class="empty notice" role="status">There's no post called &ldquo;${esc(id)}&rdquo;. Here's everything in the Scrappbook.</div>`);
        }
        search.addEventListener('input', renderList);
        renderList();
    }
});
