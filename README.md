# Skibidevs

https://shaiyon69.github.io/Skibidevs/

Static GitHub Pages site, no build step:

- `/apptic/` Apps, the app store (`data/apptic.json`, downloads from each app's latest GitHub release; apps sharing `Shaiyon69/apptic-releases` use tag prefixes like `chimaera-v1.0.3`)
- `/playroom/` Play, Convallaria web build (`webvallaria/`)
- `/appendix/` More, other projects (`data/projects.json`)

`/scrappbook/` only redirects home; the blog was removed, and each app page shows its latest release notes instead.

Every site path starts with `/Skibidevs/` because Pages serves this repo from that subpath.

Run locally: from the folder that contains this repo, serve it under a `Skibidevs` name, for example `mklink /J Skibidevs portfolio` (Windows) or `ln -s portfolio Skibidevs`, then `python -m http.server` and open http://localhost:8000/Skibidevs/.

## Release notes

App pages show the latest GitHub release body as "What's new". Write it from the commits since the last tag:

```sh
gh release create <tag> <files> --repo <repo> --notes "$(git log <prev-tag>..HEAD --no-merges --pretty='- %s')"
```

`feat:` lines show a "New" tag and `fix:` lines a "Fix" tag. Only `#` headings, `-` bullets, `**bold**` and `` `code` `` are rendered.

Check the notes parser: `node scripts/notes-check.mjs`.
