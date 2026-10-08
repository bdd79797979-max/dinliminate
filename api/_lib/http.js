'use strict';

function setHeader(res,key,value){if(res?.setHeader)res.setHeader(key,value);}
function send(res,status,body,contentType='text/plain; charset=utf-8',headers={}){
  res.statusCode=status;
  setHeader(res,'Content-Type',contentType);
  for(const [key,value] of Object.entries(headers))setHeader(res,key,value);
  if(typeof res?.end==='function')res.end(body);
  return res;
}
function json(res,status,payload,headers={}){return send(res,status,JSON.stringify(payload),'application/json; charset=utf-8',headers);}
module.exports={send,json,setHeader};
