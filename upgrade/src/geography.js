// Mapped terrain and land cover. All assets are embedded for offline operation.
const GEOGRAPHY=__GEOGRAPHIC_DATA__,geography=GEOGRAPHY[CIRCUIT.id]||null;
const geographicHeights=geography?new Float32Array(decodeBase64Bytes(geography.height).buffer):null;
function geographicHeight(x,z){if(!geography)return roadHeightAt(x,z);const n=geography.count,b=geography.bounds,u=clamp((x-b[0][0])/(b[1][0]-b[0][0])*(n-1),0,n-1.00001),v=clamp((z-b[0][1])/(b[1][1]-b[0][1])*(n-1),0,n-1.00001),i=Math.floor(u),j=Math.floor(v),a=u-i,t=v-j,h=geographicHeights;return (h[j*n+i]*(1-a)+h[j*n+i+1]*a)*(1-t)+(h[(j+1)*n+i]*(1-a)+h[(j+1)*n+i+1]*a)*t}
function geoPoint(lon,lat){if(!geography)return {x:0,z:0};const t=geography.transform,a=(lon-t.origin[0])*t.unit[0],b=(lat-t.origin[1])*t.unit[1],r=t.rotation;return {x:(a*r[0][0]+b*r[1][0])*t.scale+t.translation[0],z:(a*r[0][1]+b*r[1][1])*t.scale+t.translation[1]}}
let regionalGrid=null;
function regionalGroundGrid(){
 if(regionalGrid||!geography)return regionalGrid;
 const {count:n,bounds:b,nearBounds:nb}=geography;
 const axis=j=>[...new Set([...Array.from({length:n},(_,i)=>b[0][j]+i/(n-1)*(b[1][j]-b[0][j])),nb[0][j],nb[1][j]])].sort((a,b)=>a-b);
 const x=axis(0),z=axis(1),y=[];
 for(const zz of z)for(const xx of x){const edge=((Math.abs(xx-nb[0][0])<.01||Math.abs(xx-nb[1][0])<.01)&&zz>=nb[0][1]&&zz<=nb[1][1])||((Math.abs(zz-nb[0][1])<.01||Math.abs(zz-nb[1][1])<.01)&&xx>=nb[0][0]&&xx<=nb[1][0]);y.push(edge?(localTerrainHeight(xx,zz)??geographicHeight(xx,zz)):geographicHeight(xx,zz));}
 return regionalGrid={x,z,y};
}
function regionalGroundHeight(x,z){
 const grid=regionalGroundGrid();if(!grid)return -.015;
 const find=(a,v)=>{let l=0,r=a.length-1;while(r-l>1){const m=(l+r)>>1;if(a[m]<=v)l=m;else r=m}return l;},i=find(grid.x,x),j=find(grid.z,z),w=grid.x.length;
 const u=clamp((x-grid.x[i])/(grid.x[i+1]-grid.x[i]),0,1),v=clamp((z-grid.z[j])/(grid.z[j+1]-grid.z[j]),0,1),a=grid.y[j*w+i],b=grid.y[j*w+i+1],c=grid.y[(j+1)*w+i],d=grid.y[(j+1)*w+i+1];
 // Match the actual two rendered triangles, not a curved bilinear patch.
 return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
}
