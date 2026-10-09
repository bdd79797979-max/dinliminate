#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const cssFiles = [
  'tokens.css', 'base.css', 'chrome.css', 'modal.css', 'swipe.css',
  'home.css', 'meals.css', 'restaurants.css', 'winner.css', 'history.css',
  'family.css', 'settings.css', 'tutorial.css', 'menu.css'
];
const problems = [];

function blankPreservingLines(value) {
  return value.replace(/[^\n]/g, ' ');
}

function removeCommentsAndStrings(source) {
  return source
    .replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/gs, blankPreservingLines)
    .replace(/\/\*[\s\S]*?\*\//g, blankPreservingLines);
}

function lineAt(source, index) {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (source[i] === '\n') line++;
  }
  return line;
}

function preludeBeforeBrace(source, index) {
  const delimiter = Math.max(
    source.lastIndexOf(';', index - 1),
    source.lastIndexOf('{', index - 1),
    source.lastIndexOf('}', index - 1)
  );
  return source.slice(delimiter + 1, index).trim();
}

function splitMediaAlternatives(prelude) {
  const condition = prelude.replace(/^@media\b/i, '').trim();
  const alternatives = [];
  let start = 0;
  let parens = 0;
  for (let i = 0; i < condition.length; i++) {
    if (condition[i] === '(') parens++;
    else if (condition[i] === ')') parens--;
    else if (condition[i] === ',' && parens === 0) {
      alternatives.push(condition.slice(start, i).trim());
      start = i + 1;
    }
  }
  alternatives.push(condition.slice(start).trim());
  return alternatives.filter(Boolean);
}

function mediaWidthBounds(condition) {
  let min = 0;
  let max = Infinity;
  for (const match of condition.matchAll(/\bmin-width\s*:\s*(\d+(?:\.\d+)?)px\b/gi)) {
    min = Math.max(min, Number(match[1]));
  }
  for (const match of condition.matchAll(/\bmax-width\s*:\s*(\d+(?:\.\d+)?)px\b/gi)) {
    max = Math.min(max, Number(match[1]));
  }
  return { min, max };
}

function intersectMedia(parentIntervals, prelude) {
  const next = [];
  const alternatives = splitMediaAlternatives(prelude);
  for (const parent of parentIntervals) {
    for (const alternative of alternatives) {
      const bounds = mediaWidthBounds(alternative);
      const min = Math.max(parent.min, bounds.min);
      const max = Math.min(parent.max, bounds.max);
      if (min <= max) next.push({ min, max });
    }
  }
  return next;
}

for (const file of cssFiles) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    problems.push(file + ': stylesheet is missing');
    continue;
  }

  const source = fs.readFileSync(fullPath, 'utf8');
  const code = removeCommentsAndStrings(source);
  const stack = [];
  let depth = 0;
  let line = 1;

  for (let i = 0; i < code.length; i++) {
    const character = code[i];

    if (character === '{') {
      const prelude = preludeBeforeBrace(code, i);
      const isMedia = /^@media\b/i.test(prelude);
      const frame = { line, prelude, isMedia, intervals: null };

      if (isMedia) {
        let parens = 0;
        for (const c of prelude.replace(/^@media\b/i, '')) {
          if (c === '(') parens++;
          else if (c === ')') parens--;
          if (parens < 0) break;
        }
        if (parens !== 0) {
          problems.push(file + ':' + line + ': malformed parentheses in ' + prelude);
        }

        const parentMedia = [...stack].reverse().find(item => item.isMedia);
        const parentIntervals = parentMedia?.intervals || [{ min: 0, max: Infinity }];
        frame.intervals = intersectMedia(parentIntervals, prelude);
        if (frame.intervals.length === 0) {
          problems.push(
            file + ':' + line + ': impossible nested media query ' + prelude +
            ' (its width range conflicts with an ancestor @media)'
          );
        }
      }

      stack.push(frame);
      depth++;
    } else if (character === '}') {
      if (depth < 1) {
        problems.push(file + ':' + line + ': unexpected closing brace (depth would become negative)');
      } else {
        depth--;
        stack.pop();
      }
    }

    if (character === '\n') line++;
  }

  if (depth > 0) {
    for (const frame of stack) {
      problems.push(file + ':' + frame.line + ': unclosed ' +
        (frame.isMedia ? 'media query ' : 'CSS block ') + frame.prelude);
    }
  }

  if (depth === 0 && !problems.some(problem => problem.startsWith(file + ':'))) {
    console.log('CSS PASS ' + file);
  }
}

if (problems.length) {
  console.error('CSS validation failed:');
  for (const problem of problems) console.error('  ' + problem);
  process.exitCode = 1;
} else {
  console.log('CSS parser/viewport query audit: PASS · ' + cssFiles.length + ' stylesheets');
}
