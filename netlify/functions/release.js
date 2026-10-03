const release = require('../../app-release.json');

exports.handler = async function(event){
  const body = {
    ok: true,
    name: release.name,
    version: release.version,
    build: String(release.build),
    sourceBranch: String(release.sourceBranch || ''),
    commit: String(process.env.COMMIT_REF || process.env.VERCEL_GIT_COMMIT_SHA || '').trim() || null,
    branch: String(process.env.BRANCH || process.env.VERCEL_GIT_COMMIT_REF || '').trim() || release.sourceBranch || '',
    environment: String(process.env.CONTEXT || 'production'),
    expectedBranch: String(release.sourceBranch || '')
  };
  return {
    statusCode: 200,
    headers: {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, max-age=0'},
    body: JSON.stringify(body)
  };
};
