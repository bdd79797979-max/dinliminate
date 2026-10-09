'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {isForbiddenIp}=require('../../api/_lib/ssrf');
const {clientIp}=require('../../api/_lib/rateLimit');
const {HOSTS,isAllowedImageHost}=require('../../api/_lib/imageHosts');

for(const ip of ['10.0.0.8','100.64.0.8','127.0.0.1','169.254.1.1','172.16.0.1','192.168.1.1','::1','fc00::1','fd12:3456::1','fe80::1','::ffff:127.0.0.1'])assert.equal(isForbiddenIp(ip),true,ip+' must be blocked');
for(const ip of ['8.8.8.8','2001:4860:4860::8888'])assert.equal(isForbiddenIp(ip),false,ip+' must remain public');

assert.equal(clientIp({headers:{'x-vercel-forwarded-for':'203.0.113.7, 10.0.0.2'}}),'203.0.113.7');
assert.equal(clientIp({headers:{'x-forwarded-for':'203.0.113.8'},socket:{remoteAddress:'203.0.113.9'}}),'203.0.113.9');

assert.equal(isAllowedImageHost('images.pexels.com'),true);
assert.equal(isAllowedImageHost('evil.example'),false);
assert.ok(HOSTS.length>=40);

const root=path.resolve(__dirname,'../..');
const productionFiles=[];
const walk=(dir)=>{for(const name of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,name.name);if(name.isDirectory())walk(full);else if(/\.(?:js|mjs)$/.test(name.name))productionFiles.push(full);}};
walk(path.join(root,'src'));
function isEntireEscCall(value) {
  const text = value.trim();
  if (!text.startsWith('esc(') || !text.endsWith(')')) return false;
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = 3; i < text.length; i++) {
    const char = text[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === String.fromCharCode(92)) escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === String.fromCharCode(39) || char === String.fromCharCode(96)) { quote = char; continue; }
    if (char === '(') depth++;
    else if (char === ')') { depth--; if (depth === 0 && i !== text.length - 1) return false; }
  }
  return depth === 0;
}

function isSafeTemplateValue(expression) {
  const value = expression.trim();
  if (isEntireEscCall(value)) return true;
  if (/^(?:\d+(?:\.\d+)?|0x[\da-f]+)$/i.test(value)) return true;
  if (/^(?:i|index|visibleCount|count|rowIndex|columnIndex|suggestionIndex)(?:\s*[+-]\s*\d+)?$/.test(value)) return true;
  if (/^(?:Number|parseInt|parseFloat|Math\.(?:round|floor|ceil|trunc))\s*\([\s\S]*\)$/.test(value)) return true;
  return false;
}

function isSafeHtmlConcatenation(expression) {
  const value = expression.trim();
  if (isEntireEscCall(value)) return true;
  if (/^(?:\d+(?:\.\d+)?|0x[\da-f]+)$/i.test(value)) return true;
  if (/^(?:i|index|visibleCount|count|rowIndex|columnIndex|suggestionIndex)(?:\s*[+-]\s*\d+)?$/.test(value)) return true;
  if (/^(?:Number|parseInt|parseFloat|Math\.(?:round|floor|ceil|trunc))\s*\(/.test(value)) return true;
  if (/^(?:actions|body|html|modalBody|resultsHtml)$/.test(value)) return true;
  if (/^\(?\s*[^()]+\s*\?\s*(?:'[^']*'|"[^"]*")\s*:\s*(?:'[^']*'|"[^"]*")\s*\)?$/.test(value)) return true;
  return false;
}

function findUnsafeInnerHtmlInterpolations(source, file) {
  const unsafe = [];
  const tick = String.fromCharCode(96);
  const templatePattern = new RegExp('innerHTML\\s*=\\s*' + tick + '([\\s\\S]*?)' + tick, 'g');
  for (const match of source.matchAll(templatePattern)) {
    const line = source.slice(0, match.index).split(/\r?\n/).length;
    for (const interpolation of match[1].matchAll(/\$\{([^{}]+)\}/g)) {
      if (!isSafeTemplateValue(interpolation[1])) {
        unsafe.push({ file, line, expression: interpolation[1].trim(), kind: 'template interpolation' });
      }
    }
  }
  source.split(/\r?\n/).forEach((line, lineIndex) => {
    if (!line.includes('innerHTML')) return;
    const raw = /\+\s*([A-Za-z_$][\w$]*(?:(?:\?\.|\.)[A-Za-z_$][\w$]*)*(?:\([^+\n]*?\))?)\s*\+/g;
    for (const match of line.matchAll(raw)) {
      if (!isSafeHtmlConcatenation(match[1])) {
        unsafe.push({ file, line: lineIndex + 1, expression: match[1].trim(), kind: 'string concatenation' });
      }
    }
  });
  return unsafe;
}

// Regression self-tests: reject unsafe values, including multiline template literals.
const tick = String.fromCharCode(96);
const unsafeSample = 'node.innerHTML = ' + tick + '<p>${userInput}</p>' + tick + ';';
assert.equal(findUnsafeInnerHtmlInterpolations(unsafeSample, '<unsafe-self-test>').length, 1,
  'security audit self-test must reject raw userInput interpolation');
const multilineUnsafeSample = ['node.innerHTML = ' + tick + '<p>', '${userInput}', '</p>' + tick + ';'].join('\n');
assert.equal(findUnsafeInnerHtmlInterpolations(multilineUnsafeSample, '<multiline-unsafe-self-test>').length, 1,
  'security audit self-test must reject multiline raw interpolation');
assert.equal(findUnsafeInnerHtmlInterpolations('node.innerHTML = ' + tick + '<p>${esc(userInput)}</p>' + tick + ';').length, 0,
  'security audit must allow escaped template interpolation');
assert.equal(findUnsafeInnerHtmlInterpolations('node.innerHTML = ' + tick + '<p>${42}</p>' + tick + ';').length, 0,
  'security audit must allow numeric template interpolation');
assert.equal(findUnsafeInnerHtmlInterpolations('node.innerHTML = ' + tick + '<p>${actions}</p>' + tick + ';').length, 1,
  'security audit must reject non-escaped, non-numeric template fragments');
assert.ok(findUnsafeInnerHtmlInterpolations("node.innerHTML = '<p>' + userInput + '</p>';", '<unsafe-concat-self-test>').length > 0,
  'security audit self-test must reject raw string-concatenated userInput');

const innerFiles = productionFiles.flatMap(file => findUnsafeInnerHtmlInterpolations(fs.readFileSync(file, 'utf8'), path.relative(root, file)));
assert.equal(innerFiles.length, 0, 'innerHTML values must be escaped or numeric:\n' +
  innerFiles.map(item => item.file + ':' + item.line + ' ' + item.kind + ': ' + item.expression).join('\n'));

const familyMain=fs.readFileSync(path.join(root,'src/features/family/index.js'),'utf8');
assert.ok(familyMain.includes(".querySelector('.family-member-copy b').textContent=String(m.name||'Family member')"));
console.log('API/UI security audit: PASS');
