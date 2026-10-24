const fs=require('fs'),vm=require('vm'),assert=require('assert'),T=require('../vendor/work/three.min.js');
const context={T};vm.createContext(context);
vm.runInContext(fs.readFileSync('upgrade/src/render-batches.js','utf8').split('function finalizeSceneryBatches(){')[0],context);
let checks=0;
for(const Type of [T.MeshBasicMaterial,T.MeshLambertMaterial,T.MeshPhongMaterial,T.MeshStandardMaterial,T.MeshPhysicalMaterial]){
 const material=new Type(),texture=new T.DataTexture(new Uint8Array(16),2,2);material.map=texture;material.color.setRGB(.123456,.234567,.345678);material.opacity=.76;material.side=T.DoubleSide;
 const expected=material.toJSON({textures:{},images:{}});delete expected.uuid;delete expected.name;delete expected.userData;
 for(const field of Object.keys(material))if(material[field]?.isColor)expected[field]=material[field].toArray();
 Object.defineProperty(texture,'image',{get(){throw Error('Material batching tried to export image pixels')}});
 assert.strictEqual(context.sceneryMaterialKey(material),JSON.stringify(expected));checks++;
 const clone=material.clone();assert.strictEqual(context.sceneryMaterialKey(material),context.sceneryMaterialKey(clone));checks++;
 clone.color.r+=1e-7;assert.notStrictEqual(context.sceneryMaterialKey(material),context.sceneryMaterialKey(clone));checks++;
}
console.log('Material sharing:',checks,'checks; exact keys and no image export.');
