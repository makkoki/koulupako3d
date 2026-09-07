/* Koulupako 3D – kevyt, kokonaan selaimessa toimiva Three.js-peli. */
'use strict';

const TOTAL_KEYS = 5;
// Hieman kapeampi törmäysalue tekee luokkien oviaukoista sujuvia myös kosketusohjauksella.
const PLAYER_RADIUS = 0.24;
const START = new THREE.Vector3(0, 1.7, 14.5);
const state = { started: false, playing: false, won: false, keys: 0, lives: 3, startTime: 0, elapsed: 0 };
let scene, camera, renderer, clock, exitDoor, robot, robotLight, messageTimer;
let yaw = 0, pitch = 0, hitCooldown = 0;
const pressed = {}, colliders = [], keyItems = [];
const isTouch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
const robotState = { waypoint: 0, points: [new THREE.Vector3(0,0,-14),new THREE.Vector3(0,0,10),new THREE.Vector3(-9,0,10),new THREE.Vector3(9,0,-9)] };

const ui = {
  canvas: document.querySelector('#game'), hud: document.querySelector('#hud'), time: document.querySelector('#time'),
  keys: document.querySelector('#key-count'), lives: document.querySelector('#lives'), message: document.querySelector('#message'),
  start: document.querySelector('#start-screen'), pause: document.querySelector('#pause-screen'), end: document.querySelector('#end-screen'),
  endTitle: document.querySelector('#end-title'), endText: document.querySelector('#end-text'), endIcon: document.querySelector('#end-icon'), crosshair: document.querySelector('#crosshair')
};

function initGame() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x86ccec);
  scene.fog = new THREE.Fog(0x86ccec, 23, 57);
  camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 100);
  renderer = new THREE.WebGLRenderer({ canvas: ui.canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  clock = new THREE.Clock();
  createLights(); createSchool(); createPlayer(); createKeys(); createRobot(); bindEvents(); animate();
}

function createLights() {
  scene.add(new THREE.HemisphereLight(0xdaf6ff, 0x59614c, 2.2));
  const sun = new THREE.DirectionalLight(0xfff0d2, 2.2); sun.position.set(8, 18, 11); sun.castShadow = true;
  sun.shadow.mapSize.set(1024,1024); sun.shadow.camera.left = -25; sun.shadow.camera.right = 25; sun.shadow.camera.top = 25; sun.shadow.camera.bottom = -25; scene.add(sun);
}

const mat = color => new THREE.MeshStandardMaterial({ color, roughness: .72 });
function box(x,y,z,w,h,d,color, collide=false) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat(color)); mesh.position.set(x,y,z); mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh);
  if (collide) colliders.push(new THREE.Box3().setFromObject(mesh)); return mesh;
}
function wall(x,z,w,d,color=0xf4eee0) { return box(x,1.6,z,w,3.2,d,color,true); }

function createSchool() {
  const floor=box(0,-.12,0,40,.25,38,0xb9c6ca); // lattia
  const tileCanvas=document.createElement('canvas');tileCanvas.width=tileCanvas.height=128;const ctx=tileCanvas.getContext('2d');ctx.fillStyle='#cbd7d9';ctx.fillRect(0,0,128,128);ctx.strokeStyle='#9eafb3';ctx.lineWidth=3;ctx.strokeRect(1,1,126,126);const tiles=new THREE.CanvasTexture(tileCanvas);tiles.wrapS=tiles.wrapT=THREE.RepeatWrapping;tiles.repeat.set(20,19);floor.material.map=tiles;floor.material.roughness=.82;
  // Ulkoseinät, etuseinässä ulko-oven aukko.
  wall(-11,18.5,18,.45,0x6552a5); wall(11,18.5,18,.45,0x6552a5); wall(0,-18.5,40,.45,0x6552a5);
  wall(-20,0,.45,37,0x6552a5); wall(20,0,.45,37,0x6552a5);
  // Keskikäytävä ja kuusi oviaukollista luokkatilaa.
  [-12,0,12].forEach((z,i) => {
    if (i < 2) { wall(-12,z+6,16,.3,0xecd7bd); wall(12,z+6,16,.3,0xecd7bd); }
    wall(-5.5,z-3.1,9,.3,0xf0e5d5); wall(5.5,z-3.1,9,.3,0xf0e5d5);
    wall(-5.5,z+3.1,9,.3,0xf0e5d5); wall(5.5,z+3.1,9,.3,0xf0e5d5);
    wall(-5,z-1.8,.3,2.6,0xf0e5d5); wall(-5,z+1.8,.3,2.6,0xf0e5d5);
    wall(5,z-1.8,.3,2.6,0xf0e5d5); wall(5,z+1.8,.3,2.6,0xf0e5d5);
  });
  // Värikkäät matot, pulpetit ja taulut.
  const roomColors=[0x5dcfd0,0xff8da1,0xffcf5c,0x9b86e8,0x5fcf91,0xf28abe];
  let room=0;
  [-12,0,12].forEach(z => [-12.5,12.5].forEach(x => {
    box(x,.015,z,13.8,.04,5.6,roomColors[room++]);
    for(let r=-1;r<=1;r+=2) for(let c=-1;c<=1;c+=2) { box(x+c*3,.55,z+r*1.35,2,.12,.85,0xf4b251); box(x+c*3,.28,z+r*1.35,.16,.55,.16,0x64462c); }
    box(x < 0 ? -19.72 : 19.72,1.65,z, .08,1.25,3.8,0x263b4b);
  }));
  // Ikkunat ulkoseinissä.
  [-13,-6,6,13].forEach(z => { box(-19.74,2,z,.08,1.25,2.2,0x8de4ff); box(19.74,2,z,.08,1.25,2.2,0x8de4ff); });
  // Oviaukkojen karmit.
  [-12,0,12].forEach(z => [-5,5].forEach(x => { box(x,2.75,z,.45,.18,2.1,0x70452c); box(x,1.35,z-1.03,.45,2.7,.12,0x70452c); box(x,1.35,z+1.03,.45,2.7,.12,0x70452c); }));
  exitDoor = box(0,1.55,18.38,3.6,3.1,.24,0xd84955); exitDoor.material.emissive.setHex(0x260000);
  box(-2.15,2.7,18.25,.35,.35,.6,0xffd85a); box(2.15,2.7,18.25,.35,.35,.6,0xffd85a);
  const sign=box(0,3.2,18.05,4,.6,.12,0x223052); sign.material.emissive.setHex(0x102040);
  // Käytävän yksityiskohdat tekevät koulusta elävämmän ja auttavat suunnistamaan.
  [-13,-8,-3,3,8,13].forEach((z,i)=>{ const lamp=box(0,3.08,z,3,.07,.55,0xfff2b0);lamp.material.emissive.setHex(0xffdc73);lamp.material.emissiveIntensity=.7;if(i%2===0){const light=new THREE.PointLight(0xffe7ac,.55,8);light.position.set(0,2.85,z);scene.add(light);} });
  [-15,-10,-5,5,10].forEach((z,i)=>{const locker=box(-4.72,1,z,.35,1.85,1.35,i%2?0x58a9c9:0x7072c8);for(let y=.5;y<1.7;y+=.6)box(-4.51,y,z,.03,.025,.55,0xe5edf1);});
  [-15,-5,5,15].forEach(z=>{box(4.65,.42,z,.58,.75,.58,0xa76a42);const leaves=new THREE.Mesh(new THREE.SphereGeometry(.48,12,9),mat(0x3eaa65));leaves.position.set(4.65,1.05,z);leaves.castShadow=true;scene.add(leaves);});
  const exitGlow=new THREE.PointLight(0xff5b55,1.3,7);exitGlow.position.set(0,2.1,16.5);scene.add(exitGlow);exitDoor.userData.glow=exitGlow;
}

function createPlayer() { camera.position.copy(START); scene.add(camera); }

function createKeys() {
  const positions=[[-13,1,-12],[13,1,-12],[-13,1,0],[13,1,0],[-13,1,12]];
  positions.forEach(([x,y,z],i) => {
    const group=new THREE.Group();
    const gold=new THREE.MeshStandardMaterial({color:0xffd21c,metalness:.55,roughness:.25,emissive:0x9a5600,emissiveIntensity:.65});
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.32,.11,10,20),gold); ring.rotation.y=Math.PI/2; group.add(ring);
    const shaft=new THREE.Mesh(new THREE.BoxGeometry(.7,.12,.13),gold); shaft.position.x=.58; group.add(shaft);
    const tooth=new THREE.Mesh(new THREE.BoxGeometry(.14,.3,.13),gold); tooth.position.set(.85,-.13,0); group.add(tooth);
    group.scale.setScalar(1.45);group.position.set(x,y,z); group.userData.baseY=y; group.userData.index=i; group.traverse(o=>{if(o.isMesh){o.castShadow=true;}}); scene.add(group); keyItems.push(group);
    const glow=new THREE.PointLight(0xffd633,3.2,8); glow.position.set(x,y,z); scene.add(glow); group.userData.glow=glow;
    const beamMaterial=new THREE.MeshBasicMaterial({color:0xffe35a,transparent:true,opacity:.2,depthWrite:false,side:THREE.DoubleSide});
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(.22,.7,4.8,16,1,true),beamMaterial);beam.position.set(x,2.4,z);scene.add(beam);group.userData.beam=beam;
  });
}

function createRobot() {
  robot=new THREE.Group(); const steel=mat(0xbfe9ef), dark=mat(0x59689c), blue=mat(0x55ddff), pink=mat(0xff91ad);
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(.55,.6,6,12),steel); body.position.y=1.2; robot.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.58,18,12),steel); head.scale.y=.72;head.position.y=2.14; robot.add(head);
  [-.23,.23].forEach(x=>{const eye=new THREE.Mesh(new THREE.SphereGeometry(.1,12,9),blue); eye.position.set(x,2.23,-.48); robot.add(eye);});
  [-.39,.39].forEach(x=>{const cheek=new THREE.Mesh(new THREE.SphereGeometry(.085,10,8),pink);cheek.position.set(x,2.08,-.47);robot.add(cheek);});
  const smile=new THREE.Mesh(new THREE.TorusGeometry(.18,.035,8,16,Math.PI),dark);smile.position.set(0,2.05,-.52);smile.rotation.z=Math.PI;robot.add(smile);
  [-.32,.32].forEach(x=>{const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.13,.35,4,8),dark); leg.position.set(x,.38,0); robot.add(leg);});
  const antenna=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.38,8),dark); antenna.position.y=2.72; robot.add(antenna);
  const antennaBall=new THREE.Mesh(new THREE.SphereGeometry(.1,10,8),pink);antennaBall.position.y=2.94;robot.add(antennaBall);
  robotLight=new THREE.PointLight(0x70dcff,1.3,5); robotLight.position.set(0,2,-.5); robot.add(robotLight);
  robot.position.set(0,0,-14); robot.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}}); scene.add(robot);
}

function bindEvents() {
  document.querySelector('#start-button').addEventListener('click', startGame);
  document.querySelector('#continue-button').addEventListener('click', requestLock);
  document.querySelector('#quit-button').addEventListener('click', quitGame);
  document.querySelector('#restart-button').addEventListener('click', restartGame);
  addEventListener('keydown',e=>pressed[e.code]=true); addEventListener('keyup',e=>pressed[e.code]=false);
  addEventListener('mousemove',e=>{if(document.pointerLockElement===ui.canvas&&state.playing){yaw-=e.movementX*.0022;pitch-=e.movementY*.0022;pitch=Math.max(-1.45,Math.min(1.45,pitch));}});
  document.addEventListener('pointerlockchange',()=>{ if(state.started&&!state.won&&state.lives>0){state.playing=document.pointerLockElement===ui.canvas; ui.pause.classList.toggle('active',!state.playing);} });
  addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
  bindTouchControls();
}
function bindTouchControls(){
  if(!isTouch)return;
  document.querySelectorAll('.move').forEach(button=>{
    const set=(active)=>{pressed[button.dataset.key]=active;button.classList.toggle('active',active);};
    button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);set(true);});
    ['pointerup','pointercancel','lostpointercapture'].forEach(type=>button.addEventListener(type,()=>set(false)));
  });
  const look=document.querySelector('#look-area');let lastX=0,lastY=0;
  look.addEventListener('pointerdown',e=>{lastX=e.clientX;lastY=e.clientY;look.setPointerCapture(e.pointerId);look.classList.add('used');});
  look.addEventListener('pointermove',e=>{if(!look.hasPointerCapture(e.pointerId)||!state.playing)return;yaw-=(e.clientX-lastX)*.006;pitch-=(e.clientY-lastY)*.006;pitch=Math.max(-1.2,Math.min(1.2,pitch));lastX=e.clientX;lastY=e.clientY;});
}
function requestLock(){ if(!isTouch&&ui.canvas.requestPointerLock)ui.canvas.requestPointerLock(); }
function startGame(){ state.started=true;state.playing=true;state.startTime=performance.now();ui.start.classList.remove('active');ui.pause.classList.remove('active');ui.hud.classList.remove('hidden');ui.crosshair.classList.remove('hidden');if(isTouch)document.querySelector('#mobile-controls').classList.remove('hidden');requestLock(); }

function updatePlayer(dt) {
  camera.rotation.order='YXZ';camera.rotation.y=yaw;camera.rotation.x=pitch;
  const input=new THREE.Vector2((pressed.KeyD?1:0)-(pressed.KeyA?1:0),(pressed.KeyS?1:0)-(pressed.KeyW?1:0)); if(!input.lengthSq())return;
  input.normalize(); const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)); const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
  const move=forward.multiplyScalar(-input.y).add(right.multiplyScalar(input.x)).multiplyScalar(5.6*dt);
  tryMove(move.x,0);tryMove(0,move.z);
}
function tryMove(dx,dz){const next=camera.position.clone();next.x+=dx;next.z+=dz;const pbox=new THREE.Box3(new THREE.Vector3(next.x-PLAYER_RADIUS,.2,next.z-PLAYER_RADIUS),new THREE.Vector3(next.x+PLAYER_RADIUS,2.8,next.z+PLAYER_RADIUS));if(!colliders.some(c=>c.intersectsBox(pbox)))camera.position.copy(next);}

function updateRobot(dt) {
  const playerFlat=new THREE.Vector3(camera.position.x,0,camera.position.z), distance=robot.position.distanceTo(playerFlat); let target;
  if(distance<8.5) target=playerFlat; else {target=robotState.points[robotState.waypoint];if(robot.position.distanceTo(target)<.6)robotState.waypoint=(robotState.waypoint+1)%robotState.points.length;}
  const dir=target.clone().sub(robot.position);dir.y=0;if(dir.lengthSq()>.01){dir.normalize();const speed=distance<8.5?0.5:.5;robot.position.addScaledVector(dir,speed*dt);robot.rotation.y=Math.atan2(-dir.x,-dir.z);}
  robot.position.y=Math.sin(performance.now()*.006)*.04; robotLight.intensity=distance<8.5?2.8:1.2;
  if(distance<1.15&&hitCooldown<=0) playerHit();
}

function collectKeys(t) {
  keyItems.forEach(key=>{if(!key.visible)return;key.rotation.y+=t*.0015;key.position.y=key.userData.baseY+Math.sin(t*.003+key.userData.index)*.14;key.userData.beam.material.opacity=.16+Math.sin(t*.004+key.userData.index)*.06;if(camera.position.distanceTo(key.position)<1.65){key.visible=false;key.userData.glow.visible=false;key.userData.beam.visible=false;state.keys++;ui.keys.textContent=`${state.keys} / ${TOTAL_KEYS}`;showMessage('🔑 Avain löydetty!');if(state.keys===TOTAL_KEYS){exitDoor.material.color.setHex(0x35d16f);exitDoor.material.emissive.setHex(0x075f28);exitDoor.userData.glow.color.setHex(0x35ff83);showMessage('Kaikki avaimet löydetty – ulko-ovi on auki!',2600);}}});
}
function checkCollisions(){const d=Math.hypot(camera.position.x,camera.position.z-18.2);if(d<2.2){if(state.keys===TOTAL_KEYS)winGame();else{showMessage('🔒 Etsi vielä kaikki avaimet!');camera.position.z=Math.min(camera.position.z,16.7);}}}
function playerHit(){hitCooldown=2;state.lives--;ui.lives.textContent=state.lives;showMessage('⚡ Robotti sai sinut! Menetit elämän.',2200);camera.position.copy(START);robot.position.set(0,0,-13);if(state.lives<=0)gameOver();}

function updateTimer(){state.elapsed=(performance.now()-state.startTime)/1000;ui.time.textContent=formatTime(state.elapsed);}
function formatTime(seconds){const s=Math.floor(seconds);return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
function showMessage(text,duration=1500){ui.message.textContent=text;ui.message.classList.add('show');clearTimeout(messageTimer);messageTimer=setTimeout(()=>ui.message.classList.remove('show'),duration);}
function finish(title,text,icon){state.playing=false;state.won=true;if(document.pointerLockElement)document.exitPointerLock();ui.pause.classList.remove('active');ui.endTitle.textContent=title;ui.endText.innerHTML=text;ui.endIcon.textContent=icon;ui.end.classList.add('active');ui.crosshair.classList.add('hidden');document.querySelector('#mobile-controls').classList.add('hidden');}
function winGame(){finish('PÄÄSIT ULOS!',`Loppuaika: <strong>${formatTime(state.elapsed)}</strong>`,'🏆');}
function gameOver(){finish('GAME OVER','Robottivartija sai sinut kiinni. Kokeile uudelleen!','🤖');document.querySelector('#restart-button').textContent='YRITÄ UUDELLEEN';}
function quitGame(){finish('PELI PÄÄTTYI','Kiitos pelaamisesta! Voit palata kouluun milloin tahansa.','👋');document.querySelector('#restart-button').textContent='PELAA UUDELLEEN';}
function restartGame(){location.reload();}

function animate(t=0){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);if(state.playing){hitCooldown=Math.max(0,hitCooldown-dt);updatePlayer(dt);updateRobot(dt);collectKeys(t);checkCollisions();updateTimer();}renderer.render(scene,camera);}

// Three.js ladataan ennen tätä tiedostoa; käynnistä maailma heti.
initGame();
