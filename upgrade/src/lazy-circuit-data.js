// Keep heavy unselected venue data as strings. Only the selected circuit is decoded.
// Metadata and small route previews remain immediately available to the circuit picker.
function lazyCircuitRecords(payload, metadata={}){
 const records={};
 for(const id of new Set([...Object.keys(payload),...Object.keys(metadata)])){
  if(!payload[id]){records[id]={...metadata[id]};continue}
  if(payload[id].array){let decoded;Object.defineProperty(records,id,{enumerable:true,get(){if(!decoded){decoded=JSON.parse(payload[id].json);payload[id].json=''}return decoded}});continue}
  const record={...(metadata[id]||{})};let decoded=null;
  for(const key of payload[id].keys)if(!(key in record))Object.defineProperty(record,key,{enumerable:true,configurable:true,get(){if(!decoded){decoded=JSON.parse(payload[id].json);payload[id].json='';for(const [field,value] of Object.entries(decoded))if(!(field in (metadata[id]||{})))Object.defineProperty(record,field,{value,enumerable:true,writable:true,configurable:true})}return decoded[key]}});
  records[id]=record;
 }
 return records;
}
