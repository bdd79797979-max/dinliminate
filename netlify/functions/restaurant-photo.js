'use strict';

const handler = require('../../api/restaurant-photo');

exports.handler = async function(event){
  let statusCode = 200;
  const headers = {};
  let body = Buffer.from('');
  const req = {
    query: event.queryStringParameters || {},
    queryStringParameters: event.queryStringParameters || {}
  };
  const res = {
    statusCode: 200,
    setHeader(name, value){ headers[name] = String(value); },
    end(value){ if(value == null) body = Buffer.from(''); else if(Buffer.isBuffer(value)) body = value; else body = Buffer.from(String(value)); }
  };
  try {
    await handler(req, res);
    statusCode = Number(res.statusCode) || 200;
  } catch (err) {
    statusCode = 502;
    headers['Content-Type'] = 'application/json; charset=utf-8';
    body = Buffer.from(JSON.stringify({ok:false,error:'Could not load the restaurant photo'}));
  }
  return {
    statusCode,
    headers,
    body: body.toString('base64'),
    isBase64Encoded: true
  };
};
