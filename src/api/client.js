export async function apiJson(path,options={}){
 const response=await fetch(path,{cache:'no-store',...options});
 let data=null;
 try{data=await response.json();}catch(error){console.error('Dinliminate API JSON parse error',error);}
 if(!response.ok){const err=new Error(data?.message||data?.error||'Request failed');err.status=response.status;err.data=data;throw err;}
 return data;
}
