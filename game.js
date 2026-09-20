const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const characterSprite = new Image();
characterSprite.addEventListener('load', () => { if (!running) drawAttract(); });
characterSprite.src = 'character-back-deformed.png?v=2';
const ui = { start: document.querySelector('#start'), result: document.querySelector('#result'), hud: document.querySelector('#hud'), timer: document.querySelector('#timer'), arrow: document.querySelector('#windArrow'), durability: document.querySelector('#durabilityValue'), durabilityBar: document.querySelector('#durabilityBar'), hint: document.querySelector('#hint'), title: document.querySelector('#resultTitle'), kicker: document.querySelector('#resultKicker'), message: document.querySelector('#resultMessage'), brokenArt: document.querySelector('#brokenArt'), clearArt: document.querySelector('#clearArt') };
let running = false, startedAt = 0, last = 0, angle = 0, targetAngle = 0, strain = 0, wind = 1, gameOver = false, crashAt = 0, flash = 0, windPattern = [], runId = 0;
let sound = null;
let drops = Array.from({length: 135}, () => ({ x: Math.random()*W, y: Math.random()*H, z: .5+Math.random()*1.5 }));

function createNoise(audio) { const buffer=audio.createBuffer(1,audio.sampleRate*2,audio.sampleRate); const data=buffer.getChannelData(0); for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1; const source=audio.createBufferSource();source.buffer=buffer;source.loop=true;return source; }
function effectAudio() { if(sound)return sound.audio; const Audio=window.AudioContext||window.webkitAudioContext; if(!Audio)return null; const audio=new Audio();audio.resume();return audio; }
function playBreakSound() { const audio=effectAudio();if(!audio)return;const now=audio.currentTime;const osc=audio.createOscillator(), gain=audio.createGain();osc.type='square';osc.frequency.setValueAtTime(180,now);osc.frequency.exponentialRampToValueAtTime(55,now+.12);gain.gain.setValueAtTime(.13,now);gain.gain.exponentialRampToValueAtTime(.001,now+.15);osc.connect(gain).connect(audio.destination);osc.start(now);osc.stop(now+.16);const hit=createNoise(audio), filter=audio.createBiquadFilter(), hitGain=audio.createGain();filter.type='lowpass';filter.frequency.value=620;hitGain.gain.setValueAtTime(.075,now);hitGain.gain.exponentialRampToValueAtTime(.001,now+.09);hit.connect(filter).connect(hitGain).connect(audio.destination);hit.start(now);hit.stop(now+.1); }
function playClearSound() { const audio=effectAudio();if(!audio)return;const now=audio.currentTime;[[1318.5,0,.28,.1],[1046.5,.4,1.45,.13]].forEach(([frequency,delay,length,volume],index)=>{const osc=audio.createOscillator(), gain=audio.createGain();osc.type='sine';osc.frequency.value=frequency;if(index)osc.frequency.exponentialRampToValueAtTime(990,now+delay+length);gain.gain.setValueAtTime(.001,now+delay);gain.gain.exponentialRampToValueAtTime(volume,now+delay+.025);gain.gain.exponentialRampToValueAtTime(.001,now+delay+length);osc.connect(gain).connect(audio.destination);osc.start(now+delay);osc.stop(now+delay+length+.02);}); }
function startSound() {
  if (!window.AudioContext && !window.webkitAudioContext) return;
  stopSound(); const Audio=window.AudioContext||window.webkitAudioContext; const audio=new Audio(); audio.resume();
  const rainNoise=createNoise(audio), rainFilter=audio.createBiquadFilter(), rainGain=audio.createGain();rainFilter.type='highpass';rainFilter.frequency.value=1900;rainGain.gain.value=.008;rainNoise.connect(rainFilter).connect(rainGain).connect(audio.destination);rainNoise.start();
  sound={audio,rainNoise,rainFilter,rainGain};
}
function updateSound(storm,t) { if(!sound)return; const now=sound.audio.currentTime; const progress=Math.min(1,t/30), intensity=Math.min(1,storm.speed/2); sound.rainGain.gain.setTargetAtTime(.005+progress*.038+intensity*.008,now,.16);sound.rainFilter.frequency.setTargetAtTime(1450+progress*1750,now,.25); }
function stopSound() { if(!sound)return; const {audio,rainNoise}=sound; const now=audio.currentTime; try { rainNoise.stop(now+.12); } catch {} sound=null; }

function resizeCanvas() { const dpr = devicePixelRatio || 1; canvas.style.width = '100%'; canvas.style.height = '100%'; }
resizeCanvas();

function makeWindPattern() {
  windPattern = [{ time: 0, value: (Math.random() < .5 ? -1 : 1) * (.5 + Math.random()*.28) }];
  let time = 0, value = windPattern[0].value, feint = false;
  while (time < 32) {
    const stage = Math.min(5, Math.floor(time / 5));
    // Faster later on; a feint is a quick reversal followed by a return.
    time += [1.65, 1.35, 1.08, .84, .58, .74][stage] * (.72 + Math.random()*.42);
    let next;
    if (feint) { next = Math.sign(value || 1) * (.5 + Math.random()*.34); feint = false; }
    else if (Math.random() < .3) { next = -Math.sign(value || 1) * (.42 + Math.random()*.32); feint = true; }
    else { next = (Math.random() < .5 ? -1 : 1) * (.45 + Math.random()*.5); }
    value = Math.max(-1, Math.min(1, next));
    windPattern.push({ time, value });
  }
}
function windAt(t) {
  let next = windPattern.findIndex(point => point.time > t);
  if (next < 0) return windPattern.at(-1).value;
  if (next === 0) return windPattern[0].value;
  const a = windPattern[next-1], b = windPattern[next];
  const p = Math.max(0, Math.min(1, (t-a.time)/(b.time-a.time)));
  const eased = p*p*(3-2*p); // smooth reversal: rain never snaps direction
  return a.value + (b.value-a.value)*eased;
}
function reset() { const id=++runId; running=true; gameOver=false; makeWindPattern(); startedAt=performance.now(); last=startedAt; angle=0;targetAngle=0;strain=0;crashAt=0;flash=0; ui.start.classList.add('hidden');ui.result.classList.add('hidden');ui.hud.classList.remove('hidden');requestAnimationFrame(now=>loop(now,id)); try { startSound(); } catch { stopSound(); } }
function end(broken) { running=false; if(!broken)playClearSound(); stopSound(); ui.hud.classList.add('hidden'); ui.result.classList.remove('hidden'); ui.result.classList.toggle('is-clear', !broken); ui.kicker.textContent = broken ? 'GAME OVER' : 'HOME SWEET HOME'; ui.title.textContent = broken ? '傘が壊れました' : '帰宅！'; ui.brokenArt.classList.toggle('hidden', !broken); ui.clearArt.classList.toggle('hidden', broken); const remaining=Math.max(0,30-(performance.now()-startedAt)/1000); ui.message.textContent = broken ? `帰宅まであと ${remaining.toFixed(1)} 秒でした` : '無事帰れたけどずぶ濡れになった。\n傘をさした意味がなかった。'; }
function drawBackground(t) {
  const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#263a57');g.addColorStop(.53,'#48647b');g.addColorStop(1,'#152139');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  // distant storm clouds
  ctx.fillStyle='#15243d'; for(let i=0;i<9;i++){let x=(i*70+Math.sin(t*.3+i)*18)-30;ctx.beginPath();ctx.arc(x,100+(i%3)*12,48,0,Math.PI*2);ctx.fill();}
  const p=(t*105)%160; // street scroll
  ctx.fillStyle='#202d40';ctx.beginPath();ctx.moveTo(102,255);ctx.lineTo(318,255);ctx.lineTo(W, H);ctx.lineTo(0,H);ctx.fill();
  // Lane markers travel from the horizon toward the player.
  ctx.fillStyle='#b6c6c5'; for(let y=270+p;y<H;y+=160){let yy=Math.max(y,255), scale=(yy-245)/(H-245);ctx.fillRect(W/2-5*scale, yy,10*scale,38*scale);}
  // buildings move downward to suggest progress
  for(let side of [-1,1]) for(let i=0;i<4;i++){let y=245+i*104+(p*.55)%104; let s=(y-195)/460; let bw=55*s; let x=side<0 ? 92-bw : 328;ctx.fillStyle=i%2?'#34465b':'#2b3c51';ctx.fillRect(x, y, bw, 90*s);ctx.fillStyle='#8fc0ca55'; for(let k=0;k<3;k++)ctx.fillRect(x+(k+1)*bw/5,y+20*s,bw/8,13*s);}
  // The house stays on the horizon until the final five seconds, then rushes toward camera.
  const normalProgress=Math.min(1,t/25); const finalRaw=Math.max(0,Math.min(1,(t-25)/5)); const finale=finalRaw*finalRaw*(3-2*finalRaw);
  const hs=20+normalProgress*64+finale*196; const houseY=260+finale*164;
  ctx.save();ctx.translate(W/2,houseY);ctx.fillStyle='#506174';ctx.fillRect(-hs*.72,-hs*.25,hs*1.44,hs*.9);ctx.fillStyle='#354354';ctx.beginPath();ctx.moveTo(-hs,-hs*.25);ctx.lineTo(0,-hs*.95);ctx.lineTo(hs,-hs*.25);ctx.fill();
  ctx.fillStyle='#ffe084';ctx.fillRect(-hs*.15,hs*.2,hs*.3,hs*.45);ctx.fillStyle='#d7f2ff';ctx.fillRect(-hs*.54,hs*.05,hs*.18,hs*.2);ctx.fillRect(hs*.36,hs*.05,hs*.18,hs*.2);
  if(finale>.2 && t<29.95 && !gameOver){ctx.fillStyle='#f5fbff';ctx.font=`900 ${12+finale*16}px sans-serif`;ctx.textAlign='center';ctx.fillText('あと少し！',0,-hs*1.08);ctx.textAlign='left';}ctx.restore();
}
function stormLevel(t) {
  const stage = Math.min(5, Math.floor(t / 5));
  return [
    { density: .89, speed: 1.23, slant: 1.55, alpha: .96, damage: .68 },
    { density: .94, speed: 1.38, slant: 1.76, alpha: .98, damage: .86 },
    { density: 1, speed: 1.52, slant: 1.98, alpha: 1, damage: 1.08 },
    { density: 1, speed: 1.66, slant: 2.2, alpha: 1, damage: 1.4 },
    { density: 1, speed: 1.82, slant: 2.43, alpha: 1, damage: 1.85 },
    { density: 1, speed: 2.02, slant: 2.7, alpha: 1, damage: 2.45 }
  ][stage];
}
function directionBand(value) {
  // The player only needs to match one of three broad, readable directions.
  if (value < -.22) return -1;
  if (value > .22) return 1;
  return 0;
}
function drawRain(dt, t) {
  const storm = stormLevel(t);
  const visible = Math.ceil(drops.length * storm.density);
  ctx.lineCap='round';
  for(let n=0; n<drops.length; n++) { const d=drops[n];
    d.y += (150+d.z*130)*storm.speed*dt; d.x += wind*175*d.z*storm.slant*dt;
    if(d.y>H+55){d.y=-55;d.x=Math.random()*W;}
    if(d.x<-50)d.x=W+50;if(d.x>W+50)d.x=-50;
    if (n >= visible) continue;
    ctx.strokeStyle=`rgba(205,235,255,${(.22+d.z*.16)*storm.alpha})`;ctx.lineWidth=d.z;
    ctx.beginPath();ctx.moveTo(d.x,d.y);ctx.lineTo(d.x-wind*82*d.z*storm.slant,d.y-46*d.z*storm.speed);ctx.stroke();
  }
}
function drawPerson(t) {
  const crash = gameOver ? Math.min(1,(performance.now()-crashAt)/650) : 0;
  const x=W/2, y=H-150;
  const shake=gameOver?Math.sin(t*70)*8*(1-crash):strain>45?Math.sin(t*45)*((strain-45)/20):0;
  const bob=gameOver?0:Math.abs(Math.sin(t*9))*2;
  ctx.save();ctx.translate(x+shake,y+bob); // legs/body
  // Shaft and handle sit behind the person.
  ctx.save();ctx.translate(0,-7);ctx.rotate(angle + crash*Math.PI*.82);ctx.strokeStyle='#17212b';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-98);ctx.stroke();ctx.strokeStyle='#d7e8ef';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(12,17,18,4);ctx.stroke();ctx.restore();
  // Only the person is an illustration. The umbrella remains the interactive canvas drawing.
  if (characterSprite.complete && characterSprite.naturalWidth) {
    // Animated legs are drawn first, then the sprite's upper body covers their hips.
    const step=gameOver?0:Math.sin(t*8);
    const leftLift=(step+1)/2, rightLift=1-leftLift;
    const drawLeg=(hipX, side, lift) => { const footY=93-lift*25, footX=hipX+side*(1+lift*3);ctx.strokeStyle='#303848';ctx.lineWidth=20;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(hipX,27);ctx.lineTo(hipX+side*2,57-lift*10);ctx.lineTo(footX,footY);ctx.stroke();ctx.fillStyle='#171d28';ctx.beginPath();ctx.ellipse(footX+side*3,footY+4,14,6,0,0,Math.PI*2);ctx.fill(); };
    drawLeg(10,1,rightLift); // rear/right leg
    drawLeg(-10,-1,leftLift); // front/left leg
    // Keep head and torso from the illustration, hiding its static lower legs with a clip.
    ctx.save();ctx.beginPath();ctx.rect(-66,-116,132,151);ctx.clip();ctx.drawImage(characterSprite,-66,-116,132,198);ctx.restore();
  } else {
    ctx.fillStyle='#142033';ctx.fillRect(-17,44,13,59);ctx.fillRect(5,44,13,59);ctx.fillStyle='#355d89';ctx.fillRect(-25,1,50,51);ctx.fillStyle='#f4c197';ctx.beginPath();ctx.arc(0,-22,17,0,Math.PI*2);ctx.fill();ctx.fillStyle='#172b47';ctx.fillRect(-19,-39,38,13);
  }
  // Canopy and ribs sit in front of the person.
  ctx.save();ctx.translate(0,-7);ctx.rotate(angle + crash*Math.PI*.82);
  const flap=Math.sin(t*20)*(strain/100)*12;ctx.fillStyle=gameOver?'#b7cad4':'#e45561';ctx.beginPath();
  if (crash > .42) { ctx.moveTo(-74,-91);ctx.quadraticCurveTo(-47,-52,0,-62);ctx.quadraticCurveTo(47,-52,74,-91);ctx.quadraticCurveTo(42,-81,0,-76);ctx.quadraticCurveTo(-42,-81,-74,-91); }
  else { ctx.moveTo(-74,-91);ctx.quadraticCurveTo(-48,-139-flap,0,-143+flap);ctx.quadraticCurveTo(48,-139-flap,74,-91);ctx.quadraticCurveTo(40,-99,0,-94);ctx.quadraticCurveTo(-40,-99,-74,-91); }ctx.fill();
  ctx.strokeStyle='#fff2f2aa';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,crash>.42?-61:-141);ctx.lineTo(0,-94);ctx.moveTo(0,crash>.42?-61:-141);ctx.lineTo(-51,-94);ctx.moveTo(0,crash>.42?-61:-141);ctx.lineTo(51,-94);ctx.stroke();
  if(gameOver){ctx.strokeStyle='#d9e5e8';ctx.lineWidth=3;for(let i=-1;i<=1;i+=2){ctx.beginPath();ctx.moveTo(i*37,-82);ctx.lineTo(i*95,-113-crash*22);ctx.stroke();}if(crash>.35){ctx.fillStyle='#fff4c7';ctx.font='900 23px sans-serif';ctx.fillText('バコォン！',-55,-166);}}ctx.restore();ctx.restore(); }
function loop(now,id) { if(id!==runId || !running)return; const dt=Math.min(.04,(now-last)/1000);last=now; const t=(now-startedAt)/1000; const arrived=t>=29.95; wind=windAt(t); const storm=stormLevel(t); updateSound(storm,t); let error=0; if(!gameOver && !arrived){angle += (targetAngle-angle)*Math.min(1,dt*12);
  // Match the umbrella to the actual on-screen rain vector (using the average rain drop).
  const rainSideSpeed = wind * 175 * 1.25 * storm.slant;
  const rainDownSpeed = (150 + 1.25 * 130) * storm.speed;
  const rainAngle = -Math.atan2(rainSideSpeed, rainDownSpeed);
  const rainBand=directionBand(rainAngle), umbrellaBand=directionBand(angle);
  const bandGap=Math.abs(rainBand-umbrellaBand);
  // Same band is safe. Opposite sides hit the umbrella 2.4× harder than a center-versus-side miss.
  const damageFactor=bandGap===0?0:bandGap===1?1:2.4;
  error=damageFactor;
  strain=Math.min(100, strain+damageFactor*8*storm.damage*dt); if(strain>=100){gameOver=true;crashAt=now;flash=1;playBreakSound();}}
  ctx.clearRect(0,0,W,H);drawBackground(t);drawRain(dt,t);drawPerson(t);if(flash){ctx.fillStyle=`rgba(255,255,255,${flash})`;ctx.fillRect(0,0,W,H);flash-=dt*3;}
  const durability=Math.max(0,Math.round(100-strain)); ui.timer.textContent=Math.max(0,30-t).toFixed(1);ui.arrow.textContent=wind>0?'→→→':'←←←';ui.durability.textContent=`${durability}%`;ui.durabilityBar.style.width=`${durability}%`;ui.hint.textContent=error<.22?'いい感じ！':durability<35?'傘が限界！':'風上へ傘を傾けろ！';
  if(gameOver){if(now-crashAt>1250)end(true);else requestAnimationFrame(next=>loop(next,id));return;} if(arrived){end(false);return;} requestAnimationFrame(next=>loop(next,id)); }
function pointer(e){const rect=canvas.getBoundingClientRect();const x=(e.touches?e.touches[0].clientX:e.clientX)-rect.left;targetAngle=Math.max(-.9,Math.min(.9,(x/rect.width-.5)*1.8));}
canvas.addEventListener('pointerdown',pointer);canvas.addEventListener('pointermove',e=>{if(e.buttons)pointer(e)});canvas.addEventListener('touchstart',pointer,{passive:true});canvas.addEventListener('touchmove',pointer,{passive:true});
document.querySelector('#startButton').addEventListener('click',reset);document.querySelector('#retryButton').addEventListener('click',reset);document.querySelector('#homeButton').addEventListener('click',()=>{ui.result.classList.add('hidden');ui.start.classList.remove('hidden');});
// Redraw the start screen after the character illustration has loaded.
function drawAttract() { ctx.clearRect(0,0,W,H);drawBackground(0);drawRain(.5,0);drawPerson(0); }
drawAttract();
