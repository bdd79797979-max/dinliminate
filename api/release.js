const release=require('../app-release.json');

module.exports=(req,res)=>{
 const body={ok:true,name:release.name,version:release.version,build:String(release.build),sourceBranch:String(release.sourceBranch||''),commit:String(process.env.VERCEL_GIT_COMMIT_SHA||'').trim()||null,branch:String(process.env.VERCEL_GIT_COMMIT_REF||'').trim()||release.sourceBranch||'release-hardening-2026-09-29',environment:String(process.env.VERCEL_ENV||'').trim()||'preview',expectedBranch:String(release.sourceBranch||'')};
 if(res.setHeader)res.setHeader('Cache-Control','no-store, max-age=0');
 return res.status(200).json(body);
};
