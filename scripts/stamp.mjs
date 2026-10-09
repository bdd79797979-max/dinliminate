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

const SHELL_CACHE_NAME = 'dinliminate-shell-v' + build;
const listFiles = directory => fs.readdirSync(directory, { withFileTypes: true })
  .flatMap(entry => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  })
  .sort();
const srcShellAssets = listFiles(path.join(root, 'src'))
  .map(file => './' + path.relative(root, file).split(path.sep).join('/'));

function stampLocalVersions(value) {
  let out = value.replace(/(\.\/[A-Za-z0-9_./-]+)\?v=\d+/g, '$1?v=' + build);
  out = out.replace(/\.\/src\/data\/restaurant-taxonomy\.js(?!\?v=\d+)/g, './src/data/restaurant-taxonomy.js?v=' + build);
  out = out.replace(/(\.\/src\/[A-Za-z0-9_./-]+\.js)\?v=\d+/g, '$1');
  return out;
}

const transforms = new Map([
  ['src/main.js', value => {
    let out = value.replace(/const APP_BUILD = '\\d+';/, "const APP_BUILD = '" + build + "';");
    out = out.replace(/const APP_BUILD_DATE = '\\d{4}-\\d{2}-\\d{2}';/, "const APP_BUILD_DATE = '" + buildDate + "';");
    return out;
  }],
  ['index.html', stampLocalVersions],
    ['sw.js', value => {
    let out = stampLocalVersions(value).replace(/const CACHE='dinliminate-shell-v[^']+';/, "const CACHE='" + SHELL_CACHE_NAME + "';");
    const shell = [
      './api/_lib/imageHosts.js?v=' + build, './', './index.html', './boot.js?v=' + build, './viewport.js?v=' + build,
      ...srcShellAssets,
      './logo.svg?v=' + build, './data/foods.js', './data/foods.js?v=' + build,
      './manifest.webmanifest', './app-release.json', './release-manifest.json',
      './icon.svg?v=' + build, './app-icon.svg?v=' + build, './apple-touch-icon.png?v=' + build,
      './fallback-food.svg', './fallback-restaurant.svg',
      './tokens.css?v=' + build, './base.css?v=' + build, './chrome.css?v=' + build, './modal.css?v=' + build,
      './swipe.css?v=' + build, './home.css?v=' + build, './meals.css?v=' + build, './restaurants.css?v=' + build,
      './winner.css?v=' + build, './history.css?v=' + build, './family.css?v=' + build, './settings.css?v=' + build,
      './tutorial.css?v=' + build
    ];
    out = out.replace(/const SHELL=\[[\s\S]*?\];/, 'const SHELL=' + JSON.stringify(shell) + ';');
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
    if (current !== expected) {
      let first=-1;
      const limit=Math.min(current.length,expected.length);
      for(let i=0;i<limit;i++){if(current[i]!==expected[i]){first=i;break;}}
      if(first<0&&current.length!==expected.length)first=limit;
      const actual=first>=0?JSON.stringify(current.slice(Math.max(0,first-80),first+180)):''; 
      const expectedSnippet=first>=0?JSON.stringify(expected.slice(Math.max(0,first-80),first+180)):''; 
      console.error('Stamp mismatch '+file+' at '+first+' actual='+actual+' expected='+expectedSnippet+' lengths='+current.length+'/'+expected.length);
      stale.push(file);
    }
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
