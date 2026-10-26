"""Small, checked r128 backport: submit programs without synchronously reading uniforms.

Normal compile/render are unchanged. The game polls KHR completion and checks
link errors before rendering. Keeping this patch outside the vendored file makes
the internal changes reviewable and makes a library change fail explicitly.
"""
def patch(source):
    edits = {
        'function Pt(t,e,n){': 'let milanoCompilePending=false;function Pt(t,e,n){',
        'this.compile=function(t,e){': '''this.compilePending=function(scene,camera){
 const checked=this.debug.checkShaderErrors;
 milanoCompilePending=true;this.debug.checkShaderErrors=false;
 try{this.compile(scene,camera)}finally{milanoCompilePending=false;this.debug.checkShaderErrors=checked}
},this.compile=function(t,e){''',
        'const p=h.getUniforms(),m=Cr.seqWithValue(p.seq,u);':
        # Force the first normal draw to bind its matching variant. A material
        # may still have a PMREM/linear-output program selected from startup.
        'if(milanoCompilePending){i.__version=-1;return h}const p=h.getUniforms(),m=Cr.seqWithValue(p.seq,u);'
    }
    for old, new in edits.items():
        if source.count(old) != 1:
            raise ValueError('Three r128 async compile patch no longer matches: '+old)
        source = source.replace(old, new)
    return source
