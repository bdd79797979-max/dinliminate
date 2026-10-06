'use strict';

const fs=require('node:fs');
const path=require('node:path');

const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');

function assert(name,condition,detail=''){
 if(!condition)throw new Error(name+(detail?': '+detail:''));
}
function between(source,start,end){
 const i=source.indexOf(start),j=source.indexOf(end,i);
 if(i<0||j<0)throw new Error('Missing '+start);
 return source.slice(i,j);
}

const historyReader=between(app,'function readHistory() {','function writeHistory');
const historyWriter=between(app,'function writeHistory(rows) {','function historyView');
const record=between(app,'function recordHistory(item, type, options={}) {','function readHistory');
const winner=between(app,'function winner(item, explicitType=null, options={}) {','function recordHistory');

assert('history reader rejects malformed/non-array storage',
 historyReader.includes('Array.isArray(parsed)')&&historyReader.includes(".filter(row=>row&&typeof row==='object')")
);
assert('history reader bounds loaded data',
 historyReader.includes('.slice(0,120)')
);
assert('history writer enforces bounded history',
 historyWriter.includes("slice(0,120)")
);
assert('family winner is idempotent by round',
 record.includes("if(familyRoundId && history.some(x=>String(x?.familyRoundId||'')===familyRoundId)) return false;")
);
assert('winner records normal decisions once per call',
 winner.includes("recordHistory(item, S.winnerType, options)")&&
 !winner.includes("recordHistory(item, S.winnerType, options);recordHistory")
);
assert('hungry wheel placeholder is not saved to History',
 winner.includes("item?.category !== 'Hungry'")
);
assert('tutorial decisions are not saved to History',
 winner.includes("!options?.tutorial")
);
assert('History delete is keyed by stable row id',
 app.includes("data-history-delete")&&app.includes("history.filter(x => x.id !== btn.dataset.historyDelete)")
);
assert('History details reopen the original record',
 app.includes("detailsSheet(row, row.type)")
);
assert('Family winners carry family metadata into History',
 app.includes("winner(item,S.familyDecisionType,{familyRoundId:id,familyMode:true})")&&
 record.includes("familyRoundId=String(options.familyRoundId||'')")
);

console.log(JSON.stringify({
 ok:true,
 malformedStorageRecovery:true,
 maxEntries:120,
 familyRoundDedupe:true,
 hungryAndTutorialExcluded:true,
 stableDeletion:true
},null,2));
