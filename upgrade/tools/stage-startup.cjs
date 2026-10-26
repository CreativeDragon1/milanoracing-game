// Build-time transform only; the browser receives plain JavaScript. Preserve
// the existing global inspection API while yielding scene construction to UI.
const fs=require('fs'),{babelParse}=require('../node_modules/playwright/lib/transform/babelBundle.js');
const file=process.argv[2],source=fs.readFileSync(file,'utf8'),ast=babelParse(source,file,false),edits=[],bindings=new Map();
function bind(node,kind){if(!node)return;if(node.type==='Identifier')bindings.set(node.name,kind);else if(node.type==='ObjectPattern')for(const p of node.properties)bind(p.value||p.argument,kind);else if(node.type==='ArrayPattern')for(const p of node.elements)bind(p,kind);else if(node.type==='AssignmentPattern')bind(node.left,kind);else if(node.type==='RestElement')bind(node.argument,kind);}
for(const node of ast.program.body){
 if(node.type==='VariableDeclaration')for(const d of node.declarations)bind(d.id,node.kind);
 if(['FunctionDeclaration','ClassDeclaration'].includes(node.type)&&node.id)bind(node.id,'let');
 if(!['FunctionDeclaration','EmptyStatement'].includes(node.type))edits.push({at:node.start,text:'await MilanoBoot.checkpoint('+JSON.stringify(node.type==='VariableDeclaration'?'Prepare '+node.declarations.map(d=>d.id.name||'scene data').join(', '):node.type==='ExpressionStatement'?'Build '+(node.expression.callee?.name||node.expression.callee?.property?.name||'scene'):node.type.replace('Statement','')+' '+(node.test?.name||'scene'))+');\n'});
}
function loops(node,depth=0){if(!node||typeof node!=='object')return;if(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression','ClassDeclaration'].includes(node.type))return;
 const loop=['ForStatement','ForOfStatement','ForInStatement','WhileStatement','DoWhileStatement'].includes(node.type);
 if(loop&&depth===0&&node.body.type==='BlockStatement')edits.push({at:node.body.start+1,text:'if(MilanoBoot.shouldYield())await MilanoBoot.checkpoint();'});
 for(const [key,value]of Object.entries(node)){if(['loc','start','end','extra','comments'].includes(key))continue;if(Array.isArray(value))for(const v of value)loops(v,depth+(loop?1:0));else if(value&&typeof value==='object')loops(value,depth+(loop?1:0));}
}
for(const node of ast.program.body)loops(node);
const pieces=[];let cursor=0;for(const e of edits.sort((a,b)=>a.at-b.at)){pieces.push(source.slice(cursor,e.at),e.text);cursor=e.at;}pieces.push(source.slice(cursor));const code=pieces.join('');
const expose=[...bindings].filter(([name])=>name!=='MilanoBoot').map(([name,kind])=>`try{Object.defineProperty(window,${JSON.stringify(name)},{configurable:true,get:()=>${name}${kind==='const'?',set:()=>{}':',set:value=>{'+name+'=value}'}})}catch{}`).join('\n');
const boot=`window.MilanoReady=false;window.MilanoBoot={last:performance.now(),started:performance.now(),constructed:false,timings:[],label:'Start',shouldYield(){return performance.now()-this.last>8},async checkpoint(label){if(this.shouldYield()){const start=performance.now();this.timings.push({ms:start-this.last,stage:this.label});await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));this.last=performance.now();}if(label)this.label=label;}};\n`;
fs.writeFileSync(file,boot+'(async()=>{\nawait document.fonts.load("12px Michroma");\n'+expose+'\n'+code+'\nMilanoBoot.constructed=true;\n})().catch(error=>{console.error(error);document.getElementById("load-progress").textContent="Could not prepare circuit";document.getElementById("load-retry").hidden=false;});\n');
console.log('Cooperative startup:',bindings.size,'global bindings,',edits.length,'yield points');
