// Original short pneumatic-tool effects, shared with the desktop build.
const PIT_SOUND_URLS=__PIT_SOUND_URLS__;
const pitAudio={buffers:{},loading:false,lastPhase:-1,active:false,sources:new Set(),cues:[[.025,'jack',0],[.09,'gun',-.65],[.115,'gun',.65],[.14,'gun',-.4],[.165,'gun',.4],[.37,'tyre',-.55],[.40,'tyre',.55],[.61,'tyre',-.45],[.64,'tyre',.45],[.70,'gun',-.65],[.725,'gun',.65],[.75,'gun',-.4],[.775,'gun',.4],[.90,'jack',0]]};
async function preparePitSounds(){if(!AC||pitAudio.loading)return;pitAudio.loading=true;const ctx=AC;try{for(const[name,url]of Object.entries(PIT_SOUND_URLS)){const data=await(await fetch(url)).arrayBuffer();pitAudio.buffers[name]=await ctx.decodeAudioData(data)}}catch(error){console.warn('Pit sound unavailable',error)}finally{pitAudio.loading=false}}
function updatePitSounds(phase,active,silent){
 if(silent||!active){for(const source of pitAudio.sources){try{source.stop()}catch{}}pitAudio.sources.clear();pitAudio.lastPhase=active?phase:-1;pitAudio.active=active;return}
 if(!pitAudio.active||phase<pitAudio.lastPhase)pitAudio.lastPhase=-1;
 if(AC&&engineAudio&&S.vol>0){for(const[at,name,pan]of pitAudio.cues){if(at<=pitAudio.lastPhase||at>phase||!pitAudio.buffers[name])continue;const source=AC.createBufferSource(),gain=AC.createGain(),stereo=AC.createStereoPanner();source.buffer=pitAudio.buffers[name];source.playbackRate.value=1+pan*.035;gain.gain.value=name==='gun'?.34:.26;stereo.pan.value=pan;source.connect(gain);gain.connect(stereo);stereo.connect(engineAudio.master);pitAudio.sources.add(source);source.onended=()=>{pitAudio.sources.delete(source);source.disconnect();gain.disconnect();stereo.disconnect()};source.start()}}
 pitAudio.active=active;pitAudio.lastPhase=phase;
}
