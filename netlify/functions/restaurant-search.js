const handler = require('../../api/restaurants');

exports.handler = async function(event){
  let statusCode=200;
  let body=null;
  const query=event.queryStringParameters||{};
  const req={query,url:'/?'+new URLSearchParams(query).toString(),headers:event.headers||{}};
  const res={
    status(code){statusCode=code;return this;},
    json(payload){body=payload;return payload;}
  };
  try{ await handler(req,res); }
  catch(err){ statusCode=502; body={ok:false,code:String(err?.code||'SERVICE'),message:String(err?.message||'Restaurant service unavailable.')}; }
  return {statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, max-age=0'},body:JSON.stringify(body||{ok:false,message:'Empty restaurant response.'})};
};
