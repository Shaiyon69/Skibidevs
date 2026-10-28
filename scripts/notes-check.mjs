// Self-check for SD.notesHtml: node scripts/notes-check.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const window = {};
vm.runInNewContext(readFileSync(new URL('../assets/js/site.js', import.meta.url), 'utf8'), {
    window,
    document: { addEventListener() {} }
});
const { notesHtml } = window.SD;

assert.equal(notesHtml(''), '');
assert.equal(notesHtml('  \n '), '');
assert.equal(notesHtml('**Full Changelog**: https://github.com/a/b/compare/v1...v2'), '');

const hostile = notesHtml('- <img src=x onerror=alert(1)>');
assert.ok(!hostile.includes('<img'));
assert.ok(hostile.includes('&lt;img'));

const feat = notesHtml('- feat(ui): dark mode');
assert.ok(feat.includes('class="tag">New</span>'));
assert.ok(feat.includes('dark mode'));
assert.ok(!feat.includes('feat('));

assert.ok(notesHtml('- fix: crash').includes('>Fix</span>'));
assert.ok(!notesHtml('- chore: deps').includes('class="tag"'));
assert.ok(notesHtml('## Changes\n- a').includes('<h3>Changes</h3>'));

const long = notesHtml(Array.from({ length: 10 }, (_, i) => `- item ${i}`).join('\n'));
const [head] = long.split('<details');
assert.equal(head.match(/<li>/g).length, 8);
assert.equal(long.match(/<li>/g).length, 10);
assert.ok(long.includes('<summary>Show all</summary>'));

console.log('notes ok');
