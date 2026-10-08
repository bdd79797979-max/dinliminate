const handler=require('../../api/meal-autofill');

exports.handler=async function(event){
  let statusCode=200;
  let body=null;
  const raw=event.body||'{}';
  let parsed=raw;
  if(typeof raw==='string'){
    try{parsed=JSON.parse(raw);}catch{parsed=null;}
  }
  const req={method:event.httpMethod||'POST',body:parsed,headers:event.headers||{}};
  const res={
    status(code){statusCode=code;return this;},
    setHeader(){},
    json(payload){body=payload;return payload;},
    end(payload){try{body=JSON.parse(String(payload||'{}'));}catch{body={ok:false,message:'Invalid response.'};}}
  };
  try{await handler(req,res);}
  catch(err){statusCode=502;body={ok:false,code:String(err?.code||'AUTOFILL_FAILED'),message:String(err?.message||'Meal Auto-Fill could not complete that request.')};}
  return {statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, max-age=0'},body:JSON.stringify(body||{ok:false,message:'Empty autofill response.'})};
};
