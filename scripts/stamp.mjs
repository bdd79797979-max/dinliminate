#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const release = JSON.parse(fs.readFileSync(path.join(root, 'app-release.json'), 'utf8'));
const build = Number(release.build);
const buildDate = String(release.buildDate || '').trim();

if (!Number.isInteger(build) || build <= 0) throw new Error('app-release.json build must be a positive integer');
if (!/^\d{4}-\d{2}-\d{2}$/.test(buildDate)) throw new Error('app-release.json buildDate must be YYYY-MM-DD');

const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, value) => fs.writeFileSync(path.join(root, file), value);

function stampLocalVersions(value) {
  let out = value.replace(/(\.\/[A-Za-z0-9_./-]+)\?v=\d+/g, '$1?v=' + build);
  out = out.replace(/\.\/data\/restaurant-taxonomy\.js(?!\?v=\d+)/g, './data/restaurant-taxonomy.js?v=' + build);
  return out;
}

const transforms = new Map([
  ['src/main.js', value => {
    let out = value.replace(/const APP_BUILD = '\\d+';/, "const APP_BUILD = '" + build + "';");
    out = out.replace(/const APP_BUILD_DATE = '\\d{4}-\\d{2}-\\d{2}';/, "const APP_BUILD_DATE = '" + buildDate + "';");
    return out;
  }],
  ['index.html', value => {
    let out = value.replace(/<script>\s*\/\* CP1186[\s\S]*?<\/script>\s*<script>\s*\/\* CP1277[\s\S]*?<\/script>\s*/g, '\n');
    out = out.replace(/\s*<script src="\.\/boot\.js\?v=\d+"><\/script>\s*/g, '\n');
    out = out.replace(/<script src="\.\/viewport\.js[^"]*"><\/script>/, '<script src="./boot.js?v=' + build + '"></script>\n<script src="./viewport.js?v=' + build + '"></script>');
    return stampLocalVersions(out);
  }],
  ['sw.js', value => {
    let out = stampLocalVersions(value).replace(/const CACHE='dinliminate-shell-v\d+';/, "const CACHE='dinliminate-shell-v" + build + "';");
    out = out.replace(/'\.\/boot\.js\?v=\d+',?\s*/g, '');
    out = out.replace("const SHELL=['./','./index.html',", "const SHELL=['./','./index.html','./boot.js?v=" + build + "',");
    return out;
  }],
  ['manifest.webmanifest', stampLocalVersions],
  ['release-manifest.json', value => {
    const manifest = JSON.parse(value);
    manifest.build = release.build;
    manifest.sourceBranch = release.sourceBranch;
    manifest.checkpoint = release.checkpoint;
    manifest.deploymentTrigger = release.deploymentTrigger;
    delete manifest.netlify;
    return JSON.stringify(manifest, null, 2) + '\n';
  }]
]);

const stale = [];
for (const [file, transform] of transforms) {
  const current = read(file);
  const expected = transform(current);
  if (process.argv.includes('--check')) {
    if (current !== expected) stale.push(file);
  } else if (current !== expected) {
    write(file, expected);
  }
}
if (process.argv.includes('--check')) {
  if (stale.length) {
    console.error('Release stamp is stale:', stale.join(', '));
    process.exitCode = 1;
  } else {
    console.log('Release stamp: PASS · build ' + build + ' · ' + buildDate);
  }
} else {
  console.log('Release stamp written · build ' + build + ' · ' + buildDate);
}
