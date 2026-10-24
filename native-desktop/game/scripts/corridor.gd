extends RefCounted
# Sparse range extrema: exact for linearly interpolated samples, including wrap.
var lower: Array[PackedFloat32Array]=[]
var upper: Array[PackedFloat32Array]=[]
var count:=0
func configure(track: Dictionary) -> void:
	count=int(track.N)
	var lo:=PackedFloat32Array(); var hi:=PackedFloat32Array()
	lo.resize(count*2); hi.resize(count*2)
	for i in count*2:
		var j:=i%count
		lo[i]=-float(track.widthLeft[j])+1.2-float(track.line.offset[j])
		hi[i]=float(track.widthRight[j])-1.2-float(track.line.offset[j])
	lower=[lo]; upper=[hi]
	var span:=2
	while span<=count*2:
		var a:=PackedFloat32Array(); var b:=PackedFloat32Array()
		a.resize(count*2-span+1); b.resize(a.size())
		var previous:=lower.size()-1
		for i in a.size():
			a[i]=maxf(lower[previous][i],lower[previous][i+span/2])
			b[i]=minf(upper[previous][i],upper[previous][i+span/2])
		lower.append(a); upper.append(b); span*=2
func query(start: float, distance: float) -> Vector2:
	var f:=fposmod(start,count)
	var end:=f+clampf(distance,0,count-1)
	var a:=floori(f); var b:=floori(end)
	var lo:=lerpf(lower[0][a],lower[0][a+1],f-a)
	var hi:=lerpf(upper[0][a],upper[0][a+1],f-a)
	lo=maxf(lo,lerpf(lower[0][b],lower[0][b+1],end-b))
	hi=minf(hi,lerpf(upper[0][b],upper[0][b+1],end-b))
	a+=1
	if b>=a:
		var level:=int(log(b-a+1)/log(2.0))
		var tail:=b-(1<<level)+1
		lo=maxf(lo,maxf(lower[level][a],lower[level][tail]))
		hi=minf(hi,minf(upper[level][a],upper[level][tail]))
	return Vector2(lo,hi)
