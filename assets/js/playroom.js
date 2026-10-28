// The Godot build is ~70 MB, so it only loads after the visitor asks for it.
document.addEventListener('DOMContentLoaded', () => {
    const start = document.getElementById('startGame');
    // Touch-only devices get warned before a 70 MB download they may not be able to play.
    if (matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches) {
        document.getElementById('touchNote').hidden = false;
    }
    start.addEventListener('click', () => {
        const frame = document.createElement('iframe');
        frame.src = '/Skibidevs/webvallaria/Convallaria.html';
        frame.title = 'Convallaria';
        frame.allow = 'autoplay; fullscreen; gamepad';
        frame.allowFullscreen = true;
        document.getElementById('gameStage').replaceChildren(frame);
        frame.focus();
    });
});
