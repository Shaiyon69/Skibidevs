// Shows the newest Pake release on the Build page.
document.addEventListener('DOMContentLoaded', () => {
    window.SD.latestRelease('tw93/Pake')
        .then((release) => { document.getElementById('pakeMeta').textContent = `Latest Pake: ${release.tag.replace(/^v/i, '')}, released ${window.SD.formatDate(release.date)}`; })
        .catch(() => {});
});
