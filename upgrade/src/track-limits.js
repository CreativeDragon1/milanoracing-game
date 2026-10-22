// Event rules: tyre/kerb allowance and a recovery window, independent of grip.
// These are deliberately forgiving game rules, not FIA sporting regulations.
const TrackLimits=(()=>{
 const cfg=__TRACK_LIMIT_RULES__;
 function fresh(){return{outside:0,distance:0,deep:0,deepDistance:0,recovery:0,violation:false,triggered:false}}
 function update(s,offset,halfWidth,speed,dt){
  s=s||fresh();s.triggered=false;dt=Math.max(0,Math.min(dt,.25));
  const excess=Math.abs(offset)-halfWidth,allowance=cfg.kerbAllowance+cfg.halfTyreTrack+cfg.edgeTolerance;
  if(excess<=cfg.recoveryMargin){s.recovery+=dt;if(s.recovery>=cfg.recoverySeconds)Object.assign(s,fresh());return s}
  s.recovery=0;
  if(excess<=allowance)return s;
  s.outside+=dt;s.distance+=Math.max(0,speed)*dt;
  if(excess>allowance+cfg.deepExtra){s.deep+=dt;s.deepDistance+=Math.max(0,speed)*dt}
  if(!s.violation&&(s.outside>=cfg.graceSeconds||s.distance>=cfg.graceMetres||s.deep>=cfg.deepSeconds||s.deepDistance>=cfg.deepMetres)){s.violation=true;s.triggered=true}
  return s;
 }
 return{cfg,fresh,update};
})();
