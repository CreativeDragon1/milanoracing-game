const fs=require('fs'),vm=require('vm'),zlib=require('zlib'),assert=require('assert');
const text=fs.readFileSync('upgrade/qa/standalone.html','utf8');let records=0;
for(const m of text.matchAll(/\/\*CIRCUIT_DATA:([^*]+)\*\/(.*?)\/\*END_CIRCUIT_DATA\*\//gs)){const source=JSON.parse(fs.readFileSync('upgrade/src/'+m[1],'utf8')),payload=JSON.parse(m[2]);for(const[id,r]of Object.entries(payload)){const unpacked=JSON.parse(zlib.gunzipSync(Buffer.from(r.gz,'base64')).toString());assert(require('util').isDeepStrictEqual(unpacked,source[id]),m[1]+':'+id+' differs from current source; rebuild before testing');records++;}}
assert.equal(records,72);console.log('PASS lossless circuit data compression:',records,'records');
