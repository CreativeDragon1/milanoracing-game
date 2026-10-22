// Mapped terrain and land cover. All assets are embedded for offline operation.
const GEOGRAPHY=__GEOGRAPHIC_DATA__,geography=GEOGRAPHY[CIRCUIT.id]||null;
const geographicHeights=geography?new Float32Array(Uint8Array.from(atob(geography.height),c=>c.charCodeAt(0)).buffer):null;
function geographicHeight(x,z){if(!geography)return roadHeightAt(x,z);const n=geography.count,b=geography.bounds,u=clamp((x-b[0][0])/(b[1][0]-b[0][0])*(n-1),0,n-1.00001),v=clamp((z-b[0][1])/(b[1][1]-b[0][1])*(n-1),0,n-1.00001),i=Math.floor(u),j=Math.floor(v),a=u-i,t=v-j,h=geographicHeights;return (h[j*n+i]*(1-a)+h[j*n+i+1]*a)*(1-t)+(h[(j+1)*n+i]*(1-a)+h[(j+1)*n+i+1]*a)*t}
function geoPoint(lon,lat){if(!geography)return {x:0,z:0};const t=geography.transform,a=(lon-t.origin[0])*t.unit[0],b=(lat-t.origin[1])*t.unit[1],r=t.rotation;return {x:(a*r[0][0]+b*r[1][0])*t.scale+t.translation[0],z:(a*r[0][1]+b*r[1][1])*t.scale+t.translation[1]}}
