# Skibidevs

https://shaiyon69.github.io/Skibidevs/

Static GitHub Pages site, no build step:

- `/apptic/` app store (`data/apptic.json`, downloads from each app's latest GitHub release; apps sharing `Shaiyon69/apptic-releases` use tag prefixes like `chimaera-v1.0.3`)
- `/playroom/` Convallaria web build (`webvallaria/`)
- `/scrappbook/` dev logs (`data/logs.json`, `data/posts.json`)
- `/appendix/` other projects (`data/projects.json`)

Every site path starts with `/Skibidevs/` because Pages serves this repo from that subpath.

Run locally: from the folder that contains this repo, serve it under a `Skibidevs` name, for example `mklink /J Skibidevs portfolio` (Windows) or `ln -s portfolio Skibidevs`, then `python -m http.server` and open http://localhost:8000/Skibidevs/.
