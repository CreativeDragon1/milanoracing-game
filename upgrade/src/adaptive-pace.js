// Small regularized linear regressor. Training runs between sessions; races use
// a frozen profile. Five weights and bounded local storage, no network telemetry.
const AdaptivePace=(()=>{
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 class Model{
  constructor(saved){this.weights=[.85,0,0,0,0];this.samples=0;this.laps=0;if(saved?.version===1&&saved.weights?.length===5&&saved.weights.every(v=>Number.isFinite(v)&&Math.abs(v)<=2)&&Number.isFinite(saved.samples)&&saved.samples>=0&&Number.isFinite(saved.laps)&&saved.laps>=0){this.weights=saved.weights.slice();this.samples=Math.min(saved.samples,1000000);this.laps=Math.min(saved.laps,100000)}}
  static features(k,speed,grade,width){return [1,clamp(Math.abs(k)*70,0,1),clamp(speed/100,0,1),clamp(grade*6,-1,1),clamp(width/20,0,1)]}
  predict(x){return clamp(x.reduce((v,a,i)=>v+a*this.weights[i],0),.4,1.05)}
  fit(rows){const valid=rows.filter(r=>r.x?.length===5&&r.x.every(Number.isFinite)&&Number.isFinite(r.y)&&r.y>=.4&&r.y<=1.05);if(valid.length<60)return false;for(let epoch=0;epoch<4;epoch++)for(const r of valid){const error=this.predict(r.x)-r.y;for(let j=0;j<5;j++)this.weights[j]=clamp(this.weights[j]-.025*(error*r.x[j]+(j?this.weights[j]*.002:0)),-2,2)}this.samples=Math.min(1000000,this.samples+valid.length);this.laps++;return true}
  multiplier(x){const confidence=clamp(this.samples/600,0,1);return 1+confidence*(clamp(.94+(this.predict(x)-.55)*.15,.94,1)-1)}
  serialize(){return {version:1,weights:this.weights,samples:this.samples,laps:this.laps}}
 }
 return {Model};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=AdaptivePace;
