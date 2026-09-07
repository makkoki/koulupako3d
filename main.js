/* Koulupako 3D – kevyt, kokonaan selaimessa toimiva Three.js-peli. */
'use strict';

const TOTAL_KEYS = 5;
const PLAYER_RADIUS = 0.48;
const START = new THREE.Vector3(0, 1.7, 14.5);
const state = { started: false, playing: false, won: false, keys: 0, lives: 3, startTime: 0, elapsed: 0 };
let scene, camera, renderer, clock, exitDoor, robot, robotLight, messageTimer;
let yaw = 0, pitch = 0, hitCooldown = 0;
const pressed = {}, colliders = [], keyItems = [];
const robotState = { waypoint: 0, points: [new THREE.Vector3(0,0,-14),new THREE.Vector3(0,0,10),new THREE.Vector3(-9,0,10),new THREE.Vector3(9,0,-9)] };
const isTouchDevice = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
let touchLookId = null, touchLookX = 0, touchLookY = 0;

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
  box(0,-.12,0,40,.25,38,0x74b97b); // lattia
  // Kiiltävät käytävälaatat, kattovalot ja seinien väriraidat tuovat koulun eloon.
  for(let z=-17;z<=17;z+=2) box(0,.015,z,3.7,.025,1.82,z%4===1?0xe9f3f2:0xd5e8e7);
  for(let z=-15;z<=15;z+=6) { const lamp=box(0,3.12,z,2.5,.06,.55,0xfff4bd); lamp.material.emissive.setHex(0xffd96b); lamp.material.emissiveIntensity=1.4; }
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
  // Käytävän kaapit, ilmoitustaulut ja viherkasvit.
  [-14,-10,-6,-2,2,6,10].forEach((z,i)=>{const locker=box(i%2?-1.78:1.78,1,z,.65,2,.9,i%3===0?0x49bddd:i%3===1?0xf18a9b:0xffc24b);for(let y=.45;y<1.7;y+=.55)box(locker.position.x+(locker.position.x>0?-.34:.34),y,z,.025,.04,.36,0x243454);});
  [-8,4].forEach((z,i)=>box(i?-1.79:1.79,1.75,z,.04,1.15,2.2,i?0xf4cc4c:0x65d49a));
  [-16,16].forEach(z=>{box(1.35,.38,z,.75,.65,.75,0xb8733e);const leaves=new THREE.Mesh(new THREE.SphereGeometry(.48,10,8),mat(0x36a966));leaves.position.set(1.35,1,z);leaves.castShadow=true;scene.add(leaves);});
  // Oviaukkojen karmit.
  [-12,0,12].forEach(z => [-5,5].forEach(x => { box(x,2.75,z,.45,.18,2.1,0x70452c); box(x,1.35,z-1.03,.45,2.7,.12,0x70452c); box(x,1.35,z+1.03,.45,2.7,.12,0x70452c); }));
  exitDoor = box(0,1.55,18.38,3.6,3.1,.24,0xd84955); exitDoor.material.emissive.setHex(0x260000);
  box(-2.15,2.7,18.25,.35,.35,.6,0xffd85a); box(2.15,2.7,18.25,.35,.35,.6,0xffd85a);
  const sign=box(0,3.2,18.05,4,.6,.12,0x223052); sign.material.emissive.setHex(0x102040);
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
    group.position.set(x,y,z); group.userData.baseY=y; group.userData.index=i; group.traverse(o=>{if(o.isMesh){o.castShadow=true;}}); scene.add(group); keyItems.push(group);
    const glow=new THREE.PointLight(0xffbd2e,1.3,4); glow.position.set(x,y,z); scene.add(glow); group.userData.glow=glow;
  });
}

function createRobot() {
  robot=new THREE.Group(); const steel=mat(0xd5e0ec), dark=mat(0x303a55), red=mat(0xff3855);
  const body=new THREE.Mesh(new THREE.BoxGeometry(1.1,1.25,.75),steel); body.position.y=1.25; robot.add(body);
  const head=new THREE.Mesh(new THREE.BoxGeometry(.9,.65,.7),dark); head.position.y=2.15; robot.add(head);
  [-.23,.23].forEach(x=>{const eye=new THREE.Mesh(new THREE.SphereGeometry(.09,10,8),red); eye.position.set(x,2.2,-.36); robot.add(eye);});
  [-.38,.38].forEach(x=>{const leg=new THREE.Mesh(new THREE.BoxGeometry(.25,.62,.3),dark); leg.position.set(x,.35,0); robot.add(leg);});
  const antenna=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.45,8),dark); antenna.position.y=2.68; robot.add(antenna);
  [-.7,.7].forEach(x=>{const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.11,.62,4,8),steel);arm.position.set(x,1.3,0);arm.rotation.z=x>0?-.2:.2;robot.add(arm);});
  const badge=new THREE.Mesh(new THREE.CircleGeometry(.2,16),red);badge.position.set(0,1.35,-.381);badge.rotation.y=Math.PI;robot.add(badge);
  robotLight=new THREE.PointLight(0xff274b,1.8,5); robotLight.position.set(0,2,-.5); robot.add(robotLight);
  robot.position.set(0,0,-14); robot.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}}); scene.add(robot);
}

function bindEvents() {
  document.querySelector('#start-button').addEventListener('click', startGame);
  document.querySelector('#continue-button').addEventListener('click', requestLock);
  document.querySelector('#restart-button').addEventListener('click', restartGame);
  addEventListener('keydown',e=>pressed[e.code]=true); addEventListener('keyup',e=>pressed[e.code]=false);
  addEventListener('mousemove',e=>{if(document.pointerLockElement===ui.canvas&&state.playing){yaw-=e.movementX*.0022;pitch-=e.movementY*.0022;pitch=Math.max(-1.45,Math.min(1.45,pitch));}});
  // Virtuaalinäppäimet tukevat myös monikosketusta: suunta vaihtuu vasta kun oma sormi irtoaa.
  document.querySelectorAll('.move').forEach(button=>{
    const release=()=>{pressed[button.dataset.key]=false;button.classList.remove('pressed');};
    button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);pressed[button.dataset.key]=true;button.classList.add('pressed');});
    button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
  });
  // Pelialueen pyyhkäisy kääntää kameraa mobiilissa.
  ui.canvas.addEventListener('pointerdown',e=>{if(!isTouchDevice||!state.playing)return;touchLookId=e.pointerId;touchLookX=e.clientX;touchLookY=e.clientY;ui.canvas.setPointerCapture(e.pointerId);});
  ui.canvas.addEventListener('pointermove',e=>{if(e.pointerId!==touchLookId||!state.playing)return;const dx=e.clientX-touchLookX,dy=e.clientY-touchLookY;touchLookX=e.clientX;touchLookY=e.clientY;yaw-=dx*.006;pitch=Math.max(-1.35,Math.min(1.35,pitch-dy*.006));});
  const endLook=e=>{if(e.pointerId===touchLookId)touchLookId=null;};ui.canvas.addEventListener('pointerup',endLook);ui.canvas.addEventListener('pointercancel',endLook);
  document.addEventListener('pointerlockchange',()=>{ if(state.started&&!state.won&&state.lives>0){state.playing=document.pointerLockElement===ui.canvas; ui.pause.classList.toggle('active',!state.playing);} });
  addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
}
function requestLock(){ if(!isTouchDevice) ui.canvas.requestPointerLock(); else { state.playing=true;ui.pause.classList.remove('active'); } }
function startGame(){ state.started=true;state.playing=true;state.startTime=performance.now();ui.start.classList.remove('active');ui.pause.classList.remove('active');ui.hud.classList.remove('hidden');ui.crosshair.classList.remove('hidden');document.querySelector('#mobile-controls').classList.remove('hidden');requestLock(); }

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
  if(distance<7.5) target=playerFlat; else {target=robotState.points[robotState.waypoint];if(robot.position.distanceTo(target)<.6)robotState.waypoint=(robotState.waypoint+1)%robotState.points.length;}
  const dir=target.clone().sub(robot.position);dir.y=0;if(dir.lengthSq()>.01){dir.normalize();const speed=distance<7.5?2.25:1.25;robot.position.addScaledVector(dir,speed*dt);robot.rotation.y=Math.atan2(-dir.x,-dir.z);}
  robot.position.y=Math.sin(performance.now()*.006)*.04; robotLight.intensity=distance<7.5?2.8:1.2;
  if(distance<1.15&&hitCooldown<=0) playerHit();
}

function collectKeys(t) {
  keyItems.forEach(key=>{if(!key.visible)return;key.rotation.y+=t*.0015;key.position.y=key.userData.baseY+Math.sin(t*.003+key.userData.index)*.14;if(camera.position.distanceTo(key.position)<1.35){key.visible=false;key.userData.glow.visible=false;state.keys++;ui.keys.textContent=`${state.keys} / ${TOTAL_KEYS}`;showMessage('🔑 Avain löydetty!');if(state.keys===TOTAL_KEYS){exitDoor.material.color.setHex(0x35d16f);exitDoor.material.emissive.setHex(0x075f28);showMessage('Kaikki avaimet löydetty – ulko-ovi on auki!',2600);}}});
}
function checkCollisions(){const d=Math.hypot(camera.position.x,camera.position.z-18.2);if(d<2.2){if(state.keys===TOTAL_KEYS)winGame();else{showMessage('🔒 Etsi vielä kaikki avaimet!');camera.position.z=Math.min(camera.position.z,16.7);}}}
function playerHit(){hitCooldown=2;state.lives--;ui.lives.textContent=state.lives;showMessage('⚡ Robotti sai sinut! Menetit elämän.',2200);camera.position.copy(START);robot.position.set(0,0,-13);if(state.lives<=0)gameOver();}

function updateTimer(){state.elapsed=(performance.now()-state.startTime)/1000;ui.time.textContent=formatTime(state.elapsed);}
function formatTime(seconds){const s=Math.floor(seconds);return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
function showMessage(text,duration=1500){ui.message.textContent=text;ui.message.classList.add('show');clearTimeout(messageTimer);messageTimer=setTimeout(()=>ui.message.classList.remove('show'),duration);}
function finish(title,text,icon){state.playing=false;state.won=true;if(document.pointerLockElement)document.exitPointerLock();ui.pause.classList.remove('active');ui.endTitle.textContent=title;ui.endText.innerHTML=text;ui.endIcon.textContent=icon;ui.end.classList.add('active');ui.crosshair.classList.add('hidden');}
function winGame(){finish('PÄÄSIT ULOS!',`Loppuaika: <strong>${formatTime(state.elapsed)}</strong>`,'🏆');}
function gameOver(){finish('GAME OVER','Robottivartija sai sinut kiinni. Kokeile uudelleen!','🤖');document.querySelector('#restart-button').textContent='YRITÄ UUDELLEEN';}
function restartGame(){location.reload();}

function animate(t=0){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);if(state.playing){hitCooldown=Math.max(0,hitCooldown-dt);updatePlayer(dt);updateRobot(dt);collectKeys(t);checkCollisions();updateTimer();}renderer.render(scene,camera);}

// Three.js ladataan ennen tätä tiedostoa; käynnistä maailma heti.
initGame();
