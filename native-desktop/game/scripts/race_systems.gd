extends RefCounted
# Experimental work/heat/water-balance model. Not wired into the shipped race loop.
const COMPOUNDS={"soft":{"ideal":95.0,"window":24.0,"life":90000.0,"dry":1.012},"medium":{"ideal":100.0,"window":27.0,"life":125000.0,"dry":1.0},"hard":{"ideal":105.0,"window":30.0,"life":170000.0,"dry":.985},"inter":{"ideal":70.0,"window":20.0,"life":110000.0,"dry":.86},"wet":{"ideal":60.0,"window":20.0,"life":130000.0,"dry":.74}}
static func weather(mode:String="dry",duration:float=600,seed:int=1) -> Dictionary:
	var wet:=mode in ["rain","drying"]
	var film:Array=[];film.resize(32);film.fill(1.4 if wet else 0.0)
	var line:Array=[];line.resize(32);line.fill(1.15 if wet else 0.0)
	return {"mode":mode,"duration":maxf(240,duration),"seed":seed,"time":0.0,"rain":.8 if wet else 0.0,"air":25.0,"track":36.0 if mode=="dry" else 28.0,"film":film,"line":line,"everWet":wet}
static func rain_at(w:Dictionary) -> float:
	if w.mode=="dry":return 0
	if w.mode=="rain":return .7+.18*sin(w.time/73)
	var u:float=w.time/w.duration
	var keys:Array=[[0,.9],[.12,.6],[.28,.1],[.38,0],[1,0]] if w.mode=="drying" else [[0,0],[.12,0],[.28,.55],[.43,.95],[.58,.65],[.73,0],[1,0]]
	for i in range(1,keys.size()):
		if u<=keys[i][0]:
			var a:Array=keys[i-1];var b:Array=keys[i];var t:float=clampf((u-a[0])/(b[0]-a[0]),0,1)
			return lerpf(a[1],b[1],t*t*(3-2*t))
	return 0
static func weather_step(w:Dictionary,dt:float,traffic:Array=[]) -> void:
	w.time+=dt;w.rain=rain_at(w);w.track+=(w.air+11*(1-w.rain)-w.track)*(1-exp(-dt/80))
	var counts:Array=[];counts.resize(32);counts.fill(0)
	for d in traffic:
		if not d.pit and d.v>10:counts[int(fposmod(d.fraction,1)*32)]+=1
	for i in 32:
		var local:float=w.rain*(.88+.12*sin(i*.61+w.time/100+w.seed));var rain:=local*.032
		var evap:float=.0028*(1-local)*(w.track/30);var drain:float=.012+.008*(.5+.5*sin(i*.83+w.seed))
		w.film[i]=clampf(w.film[i]+dt*(rain-drain*w.film[i]-evap),0,3)
		w.line[i]=clampf(w.line[i]+dt*(rain-drain*w.line[i]-evap*(1.3+counts[i]*.8)-counts[i]*.009*w.line[i]),0,w.film[i])
		if w.film[i]>.25:w.everWet=true
static func water(w:Dictionary,fraction:float,offset:float=0) -> float:
	var f:=fposmod(fraction,1)*32;var i:=int(f);var j:=(i+1)%32;var t:=f-i
	return lerpf(lerpf(w.line[i],w.line[j],t),lerpf(w.film[i],w.film[j],t),clampf(absf(offset)/3,0,1))
static func fresh() -> Dictionary:
	var tyres:Array=[]
	for i in 4:tyres.append({"surface":78.0,"core":76.0,"wear":0.0,"grain":0.0,"blister":0.0})
	return {"tyres":tyres,"brakes":[420.0,420.0,380.0,380.0],"brakeWear":0.0,"ice":0.0,"mguk":0.0,"mguh":0.0,"turbo":0.0,"engineTemp":95.0,"energy":.8,"boost":1.0,"front":0.0,"rear":0.0,"floor":0.0,"suspension":0.0,"repair":false,"contactCooldown":0.0,"previousV":0.0}
static func tyre_factor(type:String,tyre:Dictionary,film:float,speed:float) -> float:
	var p:Dictionary=COMPOUNDS.get(type,COMPOUNDS.medium);var damp:=clampf(film,0,3);var grip:float
	if type=="wet":grip=p.dry+.20*clampf(damp/1.4,0,1)-.09*clampf((damp-2)/1,0,1)
	elif type=="inter":grip=p.dry+.12*clampf(damp/.55,0,1)-.29*clampf((damp-.8)/1.4,0,1)
	else:grip=p.dry*(1-.72*clampf(damp/.9,0,1))
	var heat:=clampf(1-maxf(0,absf(tyre.core-p.ideal)-p.window)*.006,.65,1)
	var degradation:float=1-.22*tyre.wear*tyre.wear-.13*tyre.grain-.18*tyre.blister
	var drain:=2.1 if type=="wet" else .95 if type=="inter" else .15
	var hydro:=clampf((damp-drain)*maxf(0,speed-42)/180,0,.40)
	return clampf(grip*heat*degradation*(1-hydro),.15,1.04)
static func factors(s:Dictionary,type:String,film:float,speed:float,hybrid:bool=true) -> Dictionary:
	var grip:=0.0;var temperature:=0.0
	for i in 4:grip+=tyre_factor(type,s.tyres[i],film,speed)/4;temperature+=s.brakes[i]/4
	var fade:float=clampf(1-maxf(0,temperature-1000)/700,.4,1)*(1-.25*s.brakeWear);var cold:=clampf(.72+temperature/1100,.72,1)
	return {"grip":grip,"downforce":clampf(1-.34*s.front-.29*s.rear-.26*s.floor,.25,1),"frontBalance":clampf(.45-.14*s.front+.13*s.rear,.25,.65),"drag":1+.24*s.front+.2*s.rear+.14*s.floor,"power":clampf((1-.18*s.ice-.28*s.turbo)*(.82+.18*(1-s.mguk)*clampf(s.energy*6,0,1) if hybrid else 1.0)*(1-maxf(0,s.engineTemp-118)*.008),.35,1),"brake":fade*cold,"steering":1-.25*s.suspension}
static func step(s:Dictionary,input:Dictionary,dt:float) -> void:
	var speed:float=input.get("speed",0);var throttle:float=input.get("throttle",0);var brake:float=input.get("brake",0);var lateral:float=input.get("lateral",0);var film:float=input.get("film",0);var type:String=input.get("type","medium");var track:float=input.get("track",30);var hybrid:bool=input.get("hybrid",true);var wear_scale:float=input.get("wearScale",1)
	var p:Dictionary=COMPOUNDS.get(type,COMPOUNDS.medium);var wet:=type in ["inter","wet"]
	var decel:=clampf((s.previousV-speed)/maxf(dt,.001),0,45);var energy:=800*decel*maxf(0,(speed+s.previousV)/2)
	s.previousV=speed;s.contactCooldown=maxf(0,s.contactCooldown-dt)
	for i in 4:
		var tyre:Dictionary=s.tyres[i];var load_value:float=.7+minf(2,absf(lateral)/30)+(brake*.8 if i<2 else throttle*.45);var slip:=clampf(input.get("slip",0),0,3)
		var heat:float=load_value*speed*.026+slip*speed*.09+(speed*.03*(1-clampf(film,0,1)) if wet else 0.0);var cool:=.012+speed*.00055+film*.025
		tyre.surface+=dt*(heat-(tyre.surface-track)*cool);tyre.core+=(tyre.surface-tyre.core)*(1-exp(-dt/18));tyre.surface=clampf(tyre.surface,track-3,180);tyre.core=clampf(tyre.core,track-3,170)
		var too_hot:=maxf(0,tyre.core-p.ideal-p.window);var too_cold:=maxf(0,p.ideal-p.window-tyre.core)
		tyre.grain=clampf(tyre.grain+dt*(too_cold*slip*.00006-(.0003 if too_cold==0 else 0.0)),0,1);tyre.blister=clampf(tyre.blister+dt*too_hot*load_value*.00006,0,1)
		tyre.wear=clampf(tyre.wear+dt*speed/p.life*wear_scale*(.65+load_value*.35+slip*.8+too_hot*.05)*(1+3*(1-clampf(film,0,1)) if wet else 1.0),0,1)
		var share:=.29 if i<2 else .21;s.brakes[i]=clampf(s.brakes[i]+dt*(energy*share/2200-(s.brakes[i]-25)*(.016+speed*.00065+film*.008)),25,1500)
	s.brakeWear=clampf(s.brakeWear+energy*dt/1.8e10*(1+maxf(0,s.brakes.max()-1050)/100),0,1)
	s.engineTemp+=dt*(throttle*7.5-(s.engineTemp-80)*(.08+speed*.0012));var stress:=1+maxf(0,s.engineTemp-112)*.12
	s.ice=clampf(s.ice+dt*throttle*stress/180000,0,1);s.turbo=clampf(s.turbo+dt*throttle*throttle*stress/150000,0,1)
	if hybrid:
		var harvest:float=brake*speed*.00018*(1-s.mguk)+throttle*.003*(1-s.mguh);var deployment:float=throttle*.010*(1-s.mguk)
		s.energy=clampf(s.energy+dt*(harvest-deployment),0,1);s.mguk=clampf(s.mguk+dt*(brake+throttle)*stress/240000,0,1);s.mguh=clampf(s.mguh+dt*throttle*stress/200000,0,1)
static func impact(s:Dictionary,speed:float,zone:String="front",strength:float=1) -> float:
	if s.contactCooldown>0 or speed<2:return 0
	var severity:=clampf((speed*speed-4)/650*strength,.01,.85)
	if zone=="side":s.floor=clampf(s.floor+severity*.65,0,1);s.suspension=clampf(s.suspension+severity*.45,0,1)
	else:s[zone]=clampf(s[zone]+severity,0,1)
	s.contactCooldown=.7;return severity
static func service(s:Dictionary,repair:bool=false) -> void:
	s.tyres=fresh().tyres
	if repair:s.front=0.0;s.repair=false
