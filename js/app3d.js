import * as THREE from 'three';

const Sim = window.CyTSim;
const $ = (id) => document.getElementById(id);
const viewport = $('viewport');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ============================== AUDIO ES ============================== */
let voiceOn = true, soundOn = true, AC = null, rumble = null, subtitleTimer = 0;
function audio() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (AC && AC.state === 'suspended') AC.resume();
  return AC;
}
function beep(freq, dur = 0.09, type = 'sine', vol = 0.08, delay = 0) {
  if (!soundOn) return; const ac = audio(); if (!ac) return;
  const t0 = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ac.destination); o.start(t0); o.stop(t0 + dur + 0.02);
}
function setRumble(on) {
  const ac = soundOn ? audio() : null;
  if (on && ac && !rumble) {
    const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
    const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 110;
    const g = ac.createGain(); g.gain.value = 0.5;
    src.connect(f).connect(g).connect(ac.destination); src.start();
    rumble = { src, g };
  } else if (!on && rumble) {
    try { rumble.src.stop(); } catch (e) {}
    rumble = null;
  }
}
function pickSpanishVoice() {
  const vs = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
  return vs.find(v => /^es[-_](CO|MX|ES)/i.test(v.lang)) || vs.find(v => /^es/i.test(v.lang)) || null;
}
function speak(text, who = 'device') {
  const sub = $('subtitle');
  sub.innerHTML = (who === 'device' ? '<b>📢 SISMO-ALERT:</b> ' : who === 'operator' ? '<b>💡 Gateway:</b> ' : '<b>🧑‍🎓 Persona:</b> ') + text;
  sub.style.display = 'block';
  clearTimeout(subtitleTimer);
  subtitleTimer = setTimeout(() => { sub.style.display = 'none'; }, 6500);
  $('xrBox').textContent = text;
  if (!voiceOn || !window.speechSynthesis) return;
  if (who !== 'npc') speechSynthesis.cancel();
  else if (speechSynthesis.speaking) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'es-CO'; u.voice = pickSpanishVoice();
  u.rate = who === 'npc' ? 1.05 : 0.95;
  u.pitch = who === 'device' ? 0.75 : who === 'npc' ? 1.15 : 0.9;
  speechSynthesis.speak(u);
}
if (window.speechSynthesis) speechSynthesis.getVoices();

/* ============================== ESCENA BASE ============================== */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  viewport.insertAdjacentHTML('beforeend', '<p style="position:absolute;inset:40% 20px;text-align:center">Tu navegador no pudo iniciar WebGL. Prueba la <a href="clasico.html">versión 2D</a>.</p>');
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true;
viewport.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1a2f);
scene.fog = new THREE.Fog(0x0a1a2f, 70, 170);
const camera = new THREE.PerspectiveCamera(68, 1, 0.1, 300);
camera.rotation.order = 'YXZ';
camera.position.set(0, 1.65, 0);
const rig = new THREE.Group();
rig.position.set(0, 0, 20);
rig.add(camera);
scene.add(rig);

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x1d2a1a, 0.95); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, 1.9);
sun.position.set(35, 50, 25); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -45; sun.shadow.camera.right = 45;
sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45;
scene.add(sun);
const emergencyLight = new THREE.PointLight(0xff4444, 0, 45);
emergencyLight.position.set(0, 8, 0); scene.add(emergencyLight);

function resize() {
  const w = viewport.clientWidth || innerWidth, h = viewport.clientHeight || innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

const M = {
  concrete: new THREE.MeshStandardMaterial({ color: 0xdde5ee, roughness: 0.9 }),
  slab: new THREE.MeshStandardMaterial({ color: 0xb9c7d8, roughness: 0.95 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0x9fd8ef, transparent: true, opacity: 0.22, roughness: 0.15, metalness: 0.1, side: THREE.DoubleSide }),
  white: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.55 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x24344d, roughness: 0.8 }),
  green: new THREE.MeshStandardMaterial({ color: 0x1d4d2e, roughness: 1 }),
  plaza: new THREE.MeshStandardMaterial({ color: 0x8b98a8, roughness: 1 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x9a6a3f, roughness: 0.9 }),
  rubble: new THREE.MeshStandardMaterial({ color: 0x77808d, roughness: 1 }),
  orange: new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.7 })
};
function box(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  (parent || scene).add(m); return m;
}
function makeLabel(text, scale = 4, bg = 'rgba(5,15,28,0.82)', fg = '#ffffff') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 112;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.beginPath(); g.roundRect(4, 4, 504, 104, 18); g.fill();
  g.fillStyle = fg; g.font = '700 42px system-ui,sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 58, 480);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(scale, scale * 0.22, 1);
  return sp;
}

/* Campus + exterior */
{
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(170, 130), M.green);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(78, 25), M.plaza);
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.02, 18); plaza.receiveShadow = true; scene.add(plaza);
  const safe = new THREE.Mesh(new THREE.CircleGeometry(6.5, 40),
    new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.22 }));
  safe.rotation.x = -Math.PI / 2; safe.position.set(Sim.ASSEMBLY.x, 0.04, Sim.ASSEMBLY.z); scene.add(safe);
  const sign = makeLabel('PUNTO DE ENCUENTRO', 6, 'rgba(5,40,20,0.85)');
  sign.position.set(Sim.ASSEMBLY.x, 3.2, Sim.ASSEMBLY.z); scene.add(sign);
  let seed = 99; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const trunkM = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 });
  const leafM = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 1 });
  for (let i = 0; i < 26; i++) {
    const x = -60 + rnd() * 120, z = -45 + rnd() * 95;
    if (Math.abs(x) < 36 && z > -24 && z < 30) continue;
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 2.6, 7), trunkM);
    tr.position.set(x, 1.3, z); tr.castShadow = true; scene.add(tr);
    const lf = new THREE.Mesh(new THREE.SphereGeometry(1.7 + rnd() * 1.3, 10, 8), leafM);
    lf.position.set(x, 3.7 + rnd(), z); lf.castShadow = true; scene.add(lf);
  }
}

/* Edificio CyT: barra principal + ala, 4 pisos y azotea */
const floorGroups = [];
const walls = []; // {x1,x2,z1,z2,floor}
function addWall(x1, x2, z1, z2, floor, parent, solid) {
  walls.push({ x1, x2, z1, z2, floor });
  const w = Math.abs(x2 - x1) || 0.25, d = Math.abs(z2 - z1) || 0.25;
  const m = box(w, 3.0, d, solid ? M.concrete : M.glass, (x1 + x2) / 2, floor * Sim.FLOOR_H + 1.55, (z1 + z2) / 2, parent);
  m.castShadow = !!solid;
  return m;
}
const zoneTints = [0x2563eb, 0x0891b2, 0x16a34a, 0xd97706];
for (let f = 0; f < Sim.FLOORS; f++) {
  const g = new THREE.Group(); scene.add(g); floorGroups.push(g);
  const y = f * Sim.FLOOR_H;
  box(60, 0.35, 12, M.slab, 0, y - 0.17, 0, g);
  box(15, 0.35, 24, M.slab, -22.5, y - 0.17, -6, g);
  for (let q = 0; q < 4; q++) {
    const tint = new THREE.Mesh(new THREE.PlaneGeometry(29, 5.4),
      new THREE.MeshBasicMaterial({ color: zoneTints[q], transparent: true, opacity: 0.10 }));
    tint.rotation.x = -Math.PI / 2;
    tint.position.set(q % 2 ? 15 : -15, y + 0.03, q >= 2 ? 3 : -3); g.add(tint);
  }
  for (let x = -30; x <= 30; x += 10) {
    [-6, 6].forEach(z => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, Sim.FLOOR_H, 10), M.concrete);
      c.position.set(x, y + Sim.FLOOR_H / 2, z); c.castShadow = true; g.add(c);
    });
  }
  addWall(-30, 30, -6.15, -5.9, f, g, false);                 // norte
  addWall(-30, -25, 5.9, 6.15, f, g, false);                  // sur (huecos = puertas, incl. rampa x -25..-23)
  addWall(-23, -21, 5.9, 6.15, f, g, false);
  addWall(-19, 3, 5.9, 6.15, f, g, false);
  addWall(5, 30, 5.9, 6.15, f, g, false);
  addWall(29.85, 30.1, -6, 6, f, g, true);
  addWall(-30.1, -29.85, -18, 6, f, g, true);
  addWall(-30, -15, -18.15, -17.9, f, g, false);
  addWall(-15.1, -14.85, -18, -6, f, g, false);
  addWall(-26, -6, -0.12, 0.12, f, g, false);                 // mamparas interiores con huecos
  addWall(6, 26, -0.12, 0.12, f, g, false);
  // mobiliario sencillo por zonas
  let sd = 1234 + f * 77; const rr = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 16; i++) {
    const x = -27 + rr() * 54, z = (rr() < 0.5 ? -1 : 1) * (2.2 + rr() * 2.6);
    box(1.8, 0.75, 0.8, rr() < 0.5 ? M.wood : M.dark, x, y + 0.38, z, g);
    box(0.5, 0.5, 0.5, M.dark, x + (rr() - 0.5), y + 1.0, z, g);
  }
  const lab = makeLabel('PISO ' + (f + 1) + ' · ' + Sim.ZONE_NAMES[f][1], 5.2);
  lab.position.set(24, y + 2.7, -5.2); g.add(lab);
  const lab2 = makeLabel(Sim.ZONE_NAMES[f][0], 4.2);
  lab2.position.set(-24, y + 2.7, 5.2); g.add(lab2);
}
const roofGroup = new THREE.Group(); scene.add(roofGroup);
box(60.6, 0.35, 12.6, M.concrete, 0, 13.75, 0, roofGroup);
box(15.6, 0.35, 24.6, M.concrete, -22.5, 13.75, -6, roofGroup);
for (let x = -28; x <= 28; x += 4) box(0.25, 0.25, 11, M.wood, x, 14.6, 0, roofGroup);
const roofSign = makeLabel('EDIFICIO CyT · UNIVERSIDAD NACIONAL', 8, 'rgba(8,30,55,0.9)');
roofSign.position.set(0, 16.4, -6); roofGroup.add(roofSign);
['SALIDA →', '← SALIDA'].forEach((t, i) => {
  const s = makeLabel(t, 2.6, 'rgba(4,60,25,0.9)', '#bbf7d0');
  s.position.set(i ? 4 : -20, 2.5, 6.8); scene.add(s);
});

/* Rampa/escalera funcional en zigzag (fachada sur, ala occidental) */
const ramps = []; // {x1,x2,z1,z2,yA,yB} y según x
function addRampFlight(xA, xB, zC, yA, yB) {
  ramps.push({ x1: Math.min(xA, xB), x2: Math.max(xA, xB), z1: zC - 1.15, z2: zC + 1.15, xA, xB, yA, yB });
  const len = Math.hypot(xB - xA, yB - yA);
  const m = box(len, 0.25, 2.3, M.concrete, (xA + xB) / 2, (yA + yB) / 2, zC, scene);
  m.rotation.z = Math.atan2(yB - yA, xB - xA);
  const rail = box(len, 0.08, 0.08, M.dark, (xA + xB) / 2, (yA + yB) / 2 + 0.95, zC - 1.1, scene);
  rail.rotation.z = m.rotation.z;
}
function addLanding(x1, x2, z1, z2, y) {
  ramps.push({ x1, x2, z1, z2, xA: x1, xB: x2, yA: y, yB: y });
  box(x2 - x1, 0.25, z2 - z1, M.concrete, (x1 + x2) / 2, y - 0.12, (z1 + z2) / 2, scene);
}
for (let f = 0; f < 3; f++) {
  const b = f * Sim.FLOOR_H;
  addRampFlight(-26, -15, 8.1, b, b + 1.7);
  addLanding(-15, -12.4, 6.9, 12.4, b + 1.7);
  addRampFlight(-15, -26, 11.2, b + 1.7, b + 3.4);
  addLanding(-26.5, -23, 6.2, 12.4, b + 3.4);
}
function rampHeightAt(x, z) {
  for (const r of ramps) {
    if (x >= r.x1 && x <= r.x2 && z >= r.z1 && z <= r.z2) {
      const t = r.xB === r.xA ? 0 : (x - r.xA) / (r.xB - r.xA);
      return r.yA + (r.yB - r.yA) * THREE.MathUtils.clamp(t, 0, 1);
    }
  }
  return null;
}
function groundHeightAt(x, z, curY) {
  const cands = [0];
  // Las rampas de cada piso comparten huella (están apiladas): se evalúan
  // TODAS las alturas candidatas y se elige la mayor bajo los pies.
  for (const r of ramps) {
    if (x >= r.x1 && x <= r.x2 && z >= r.z1 && z <= r.z2) {
      const t = r.xB === r.xA ? 0 : (x - r.xA) / (r.xB - r.xA);
      cands.push(r.yA + (r.yB - r.yA) * THREE.MathUtils.clamp(t, 0, 1));
    }
  }
  if (Sim.inside(x, z)) { for (let f = 0; f < 4; f++) cands.push(f * Sim.FLOOR_H); cands.push(13.6); }
  let best = 0;
  for (const c of cands) if (c <= curY + 0.62 && c > best) best = c;
  return best;
}

/* Poste de luz + gateway con polea */
const poleGroup = new THREE.Group(); scene.add(poleGroup);
const GP = Sim.GATEWAY_POS;
{
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 6.4, 10), M.dark);
  pole.position.set(GP.x, 3.2, GP.z); pole.castShadow = true; poleGroup.add(pole);
  const arm = box(1.7, 0.12, 0.12, M.dark, GP.x - 0.7, 6.2, GP.z, poleGroup);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xfff7cc, emissive: 0xffdf7e, emissiveIntensity: 1.6 }));
  lamp.position.set(GP.x - 1.5, 6.05, GP.z); poleGroup.add(lamp);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.07, 8, 18), M.orange);
  wheel.position.set(GP.x + 0.45, 5.35, GP.z); poleGroup.add(wheel);
  const poleSign = makeLabel('💡 GATEWAY · POSTE DE LUZ', 4.4, 'rgba(50,30,4,0.88)', '#fde68a');
  poleSign.position.set(GP.x, 7.1, GP.z); poleGroup.add(poleSign);
}
const gwGroup = new THREE.Group(); scene.add(gwGroup);
const gwLeds = [];
{
  const body = box(0.9, 0.62, 0.34, new THREE.MeshStandardMaterial({ color: 0xd7dee8, roughness: 0.5 }), 0, 0, 0, gwGroup);
  body.userData = { kind: 'gateway' };
  [[-0.24, 0x38bdf8], [0, 0x22d3ee], [0.24, 0xfacc15]].forEach(([dx, col]) => {
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8),
      new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.4 }));
    led.position.set(dx, 0.14, 0.19); gwGroup.add(led); gwLeds.push(led);
  });
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.55, 6), M.dark);
  ant.position.set(0.32, 0.55, 0); gwGroup.add(ant);
  gwGroup.position.set(GP.x + 0.45, GP.y, GP.z);
  gwGroup.traverse(o => { o.userData.kind = 'gateway'; });
}
const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 6), M.dark);
scene.add(rope);

/* Polvo sísmico */
const dustGeo = new THREE.BufferGeometry();
{
  const n = 550, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = -30 + Math.random() * 60;
    pos[i * 3 + 1] = Math.random() * 13.5;
    pos[i * 3 + 2] = -6 + Math.random() * 12;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
}
const dustPoints = new THREE.Points(dustGeo,
  new THREE.PointsMaterial({ color: 0xcbd5e1, size: 0.14, transparent: true, opacity: 0 }));
scene.add(dustPoints);

/* Líneas de detección y paquetes */
function makeLinePool(max, color, opacity) {
  const geo = new THREE.BufferGeometry();
  const arr = new Float32Array(max * 2 * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  geo.setDrawRange(0, 0);
  const lines = new THREE.LineSegments(geo,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  lines.frustumCulled = false; scene.add(lines);
  return { lines, arr, geo, max };
}
const detectLines = makeLinePool(90, 0x38bdf8, 0.5);
const packetPool = [];
for (let i = 0; i < 14; i++) {
  const s = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xfacc15, emissiveIntensity: 2 }));
  s.visible = false; scene.add(s); packetPool.push(s);
}
const ghostPool = [];
for (let i = 0; i < 16; i++) {
  const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.3),
    new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x991b1b, transparent: true, opacity: 0.75 }));
  s.visible = false; scene.add(s); ghostPool.push(s);
}

/* ============================== JUGADOR ============================== */
const player = { yaw: 0, pitch: -0.03, vy: 0, grounded: true, free: false, speedWalk: 4.2 };
const keys = {};
let joyVec = { x: 0, y: 0 };
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'KeyE') interact();
  if (e.code === 'KeyQ') tryQuake();
  if (e.code === 'Space' && /BODY|CANVAS/.test(document.activeElement.tagName)) e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = false; });
let dragging = null, dragMoved = 0;
renderer.domElement.addEventListener('pointerdown', e => {
  dragging = { x: e.clientX, y: e.clientY }; dragMoved = 0;
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove', e => {
  if (!dragging) return;
  const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
  dragMoved += Math.abs(dx) + Math.abs(dy);
  if (!renderer.xr.isPresenting) {
    player.yaw -= dx * 0.0042;
    player.pitch = THREE.MathUtils.clamp(player.pitch - dy * 0.0042, -1.35, 1.35);
  }
  dragging = { x: e.clientX, y: e.clientY };
});
renderer.domElement.addEventListener('pointerup', e => {
  if (dragMoved < 6) pickAt(e.clientX, e.clientY);
  dragging = null;
});
renderer.domElement.addEventListener('wheel', e => {
  e.preventDefault();
  if (player.free) rig.position.y = Math.max(0.5, rig.position.y - Math.sign(e.deltaY) * 1.2);
}, { passive: false });
if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
{
  const joy = $('joy'), knob = $('joyKnob'); let joyId = null;
  const setJoy = (e) => {
    const r = joy.getBoundingClientRect();
    let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
    joyVec = { x: dx, y: dy };
    knob.style.transform = `translate(${dx * 28}px,${dy * 28}px)`;
  };
  joy.addEventListener('pointerdown', e => { joyId = e.pointerId; joy.setPointerCapture(joyId); setJoy(e); });
  joy.addEventListener('pointermove', e => { if (e.pointerId === joyId) setJoy(e); });
  const end = () => { joyId = null; joyVec = { x: 0, y: 0 }; knob.style.transform = ''; };
  joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
  $('btnTouchInteract').addEventListener('click', () => interact());
}
function collideWalls(pos) {
  const feet = pos.y, r = 0.38;
  for (const w of walls) {
    const fy = w.floor * Sim.FLOOR_H;
    if (feet < fy - 0.4 || feet > fy + 2.7) continue;
    if (pos.x > w.x1 - r && pos.x < w.x2 + r && pos.z > w.z1 - r && pos.z < w.z2 + r) {
      const dl = pos.x - (w.x1 - r), dr = (w.x2 + r) - pos.x;
      const dn = pos.z - (w.z1 - r), ds = (w.z2 + r) - pos.z;
      const m = Math.min(dl, dr, dn, ds);
      if (m === dl) pos.x = w.x1 - r; else if (m === dr) pos.x = w.x2 + r;
      else if (m === dn) pos.z = w.z1 - r; else pos.z = w.z2 + r;
    }
  }
  pos.x = THREE.MathUtils.clamp(pos.x, -70, 70);
  pos.z = THREE.MathUtils.clamp(pos.z, -55, 60);
}
let snapCooldown = 0;
function updatePlayer(dt) {
  let ix = joyVec.x, iz = joyVec.y;
  if (keys.KeyA || keys.ArrowLeft) ix -= 1;
  if (keys.KeyD || keys.ArrowRight) ix += 1;
  if (keys.KeyW || keys.ArrowUp) iz -= 1;
  if (keys.KeyS || keys.ArrowDown) iz += 1;
  let yawForMove = player.yaw;
  if (renderer.xr.isPresenting) {
    const session = renderer.xr.getSession();
    const camDir = new THREE.Vector3(); camera.getWorldDirection(camDir);
    yawForMove = Math.atan2(-camDir.x, -camDir.z);
    if (session) for (const src of session.inputSources) {
      if (!src.gamepad) continue;
      const ax = src.gamepad.axes;
      if (src.handedness === 'left' && ax.length >= 4) { ix += ax[2]; iz += ax[3]; }
      if (src.handedness === 'right' && ax.length >= 4) {
        snapCooldown -= dt;
        if (Math.abs(ax[2]) > 0.75 && snapCooldown <= 0) {
          rig.rotation.y -= Math.sign(ax[2]) * Math.PI / 6; snapCooldown = 0.35;
        }
      }
    }
  }
  const len = Math.hypot(ix, iz);
  if (len > 1) { ix /= len; iz /= len; }
  const run = keys.ShiftLeft || keys.ShiftRight;
  const speed = (player.free ? 9 : player.speedWalk * (run ? 1.8 : 1));
  const fx = -Math.sin(yawForMove), fz = -Math.cos(yawForMove);
  const rx = Math.cos(yawForMove), rz = -Math.sin(yawForMove);
  rig.position.x += (fx * -iz + rx * ix) * speed * dt;
  rig.position.z += (fz * -iz + rz * ix) * speed * dt;
  if (player.free) {
    if (keys.KeyR) rig.position.y += 6 * dt;
    if (keys.KeyF) rig.position.y -= 6 * dt;
    rig.position.y = Math.max(0.4, rig.position.y);
  } else {
    const ground = groundHeightAt(rig.position.x, rig.position.z, rig.position.y);
    player.vy -= 18 * dt;
    if ((keys.Space) && player.grounded) { player.vy = 6.4; player.grounded = false; }
    rig.position.y += player.vy * dt;
    if (rig.position.y <= ground) { rig.position.y = ground; player.vy = 0; player.grounded = true; }
    else player.grounded = rig.position.y - ground < 0.05;
    collideWalls(rig.position);
  }
  if (!renderer.xr.isPresenting) {
    rig.rotation.y = player.yaw;
    camera.rotation.x = player.pitch;
    camera.position.y = keys.KeyC ? 1.05 : 1.65;
  }
}
for (let i = 0; i < 2; i++) {
  const ctrl = renderer.xr.getController(i);
  ctrl.addEventListener('selectstart', () => interact());
  const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -6)]);
  ctrl.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0x22d3ee })));
  rig.add(ctrl);
}

/* ============================== SIMULACIÓN + DINÁMICOS ============================== */
let sim = null, running = false, started = false;
let peopleMeshes = new Map(), snifferMeshes = new Map(), dynamicGroup = new THREE.Group();
scene.add(dynamicGroup);
let rubbleGroup = new THREE.Group(); scene.add(rubbleGroup);
let selected = null, lastEventId = 0, lastReport = null;
let gwStage = 0, gwTimer = 0, gwY = GP.y; // 0 arriba · 1 bajando · 2 abajo · 3 descargando · 4 descargado
const qualityPeople = { baja: 24, media: 36, alta: 52 };
const scenarioMag = { suave: 4.2, moderado: 5.4, fuerte: 6.9, colapso: 7.8, sniffer: 5.4, apagon: 6.9, gateway: 5.4, replica: 6.9 };

const heroTex = new THREE.TextureLoader().load('modelo.jpg', t => {
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1030 / 1920, 1030 / 1280);
  t.offset.set(395 / 1920, 1 - (85 + 1030) / 1280);
});
function personMesh(p) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.72, 4, 10), bodyMat);
  body.position.y = 0.82; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10),
    new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.08, 0.45, 0.35 + p.hue * 0.35), roughness: 0.8 }));
  head.position.y = 1.52; head.castShadow = true; g.add(head);
  const arms = [];
  [-1, 1].forEach(side => {
    const pivot = new THREE.Group(); pivot.position.set(side * 0.34, 1.24, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.42, 3, 8), bodyMat);
    arm.position.y = -0.3; pivot.add(arm); g.add(pivot); arms.push(pivot);
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.025, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.85 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 1.86; g.add(ring);
  g.traverse(o => { o.userData = { kind: 'person', id: p.id }; });
  return { group: g, bodyMat, ring, arms };
}
function snifferMesh(s, isMain) {
  const g = new THREE.Group(); g.position.set(s.x, s.y, s.z);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6), M.dark);
  cable.position.y = 0.3; g.add(cable);
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.56, 0.24, 20), M.white);
  dome.castShadow = true; g.add(dome);
  const ledMat = new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 2 });
  const led = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.045, 8, 28), ledMat);
  led.rotation.x = Math.PI / 2; led.position.y = -0.1; g.add(led);
  const spk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 16), M.dark);
  spk.position.y = -0.15; g.add(spk);
  if (isMain) {
    const unit = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.16), M.white);
    unit.position.set(0, -0.85, 0); unit.castShadow = true; g.add(unit);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8),
      new THREE.MeshBasicMaterial({ map: heroTex }));
    face.position.set(0, -0.85, 0.09); g.add(face);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 6), M.dark);
    rod.position.y = -0.35; g.add(rod);
  }
  const scan = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 48),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }));
  scan.rotation.x = -Math.PI / 2;
  scan.position.set(s.x, s.floor * Sim.FLOOR_H + 0.07, s.z);
  dynamicGroup.add(scan);
  g.traverse(o => { o.userData = { kind: 'sniffer', id: s.id }; });
  dynamicGroup.add(g);
  return { group: g, ledMat, scan, baseY: s.y };
}
function clearGroup(gr) {
  while (gr.children.length) {
    const c = gr.children.pop();
    c.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    gr.remove(c);
  }
}
function rebuildDynamic() {
  clearGroup(dynamicGroup); clearGroup(rubbleGroup);
  peopleMeshes = new Map(); snifferMeshes = new Map();
  sim.people.forEach(p => { const m = personMesh(p); dynamicGroup.add(m.group); peopleMeshes.set(p.id, m); });
  sim.sniffers.forEach(s => snifferMeshes.set(s.id, snifferMesh(s, s.id === sim.mainSnifferId)));
  applyFloorView();
}
function rebuildRubble() {
  clearGroup(rubbleGroup);
  sim.damaged.forEach((d, idx) => {
    let sd = 500 + idx * 131; const rr = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    const y = d.floor * Sim.FLOOR_H;
    for (let i = 0; i < 8; i++) {
      const m = box(0.6 + rr() * 1.6, 0.3 + rr() * 0.7, 0.5 + rr() * 1.2, M.rubble,
        d.x + (rr() - 0.5) * d.w, y + 0.25, d.z + (rr() - 0.5) * d.d, rubbleGroup);
      m.rotation.y = rr() * 3;
    }
    const beam = box(5.5, 0.35, 0.45, M.rubble, d.x, y + 0.5, d.z, rubbleGroup);
    beam.rotation.set(0.15, rr() * 3, 0.22);
  });
}
function resetSim(keepOverlay) {
  sim = Sim.createState({
    floor: +$('selFloor').value, magnitude: +$('rngMag').value,
    people: qualityPeople[$('selQuality').value] || 36,
    seed: (Math.random() * 1e9) | 0
  });
  Sim.applyScenario(sim, $('selScenario').value);
  document.querySelectorAll('.chip-fault').forEach(ch => {
    ch.setAttribute('aria-pressed', String(!!sim.faults[ch.dataset.fault]));
  });
  lastEventId = 0; $('eventLog').innerHTML = ''; selected = null; lastReport = null;
  gwStage = 0; gwTimer = 0; gwY = GP.y;
  $('btnDownload').disabled = true;
  $('opReport').innerHTML = 'Todavía no descargas el gateway. Ve al poste de luz, bájalo con la polea (<b>E</b>) y conéctalo (<b>E</b>).';
  $('priorityList').innerHTML = '';
  rig.position.set(0, 0, 20); rig.rotation.y = 0;
  player.yaw = 0; player.pitch = -0.03; player.vy = 0;
  running = false; $('btnPause').textContent = '▶ Iniciar';
  rebuildDynamic();
  if (!keepOverlay) $('startOverlay').hidden = false;
  syncEvents(true); updateHUD(true);
}

/* ============================== INTERACCIÓN ============================== */
const raycaster = new THREE.Raycaster();
function playerFloor() {
  if (!Sim.inside(rig.position.x, rig.position.z) && rampHeightAt(rig.position.x, rig.position.z) == null) return 0;
  return THREE.MathUtils.clamp(Math.round(rig.position.y / Sim.FLOOR_H), 0, 3);
}
function playerPos() { return { x: rig.position.x, z: rig.position.z, floor: playerFloor() }; }
function nearPole() { return Math.hypot(rig.position.x - GP.x, rig.position.z - GP.z) < 3.4; }
function nearMainSniffer() {
  const s = Sim.mainSniffer(sim), pf = playerFloor();
  return pf === s.floor && Math.hypot(rig.position.x - s.x, rig.position.z - s.z) < 3.2;
}
function currentPrompt() {
  if (!sim || !started) return '';
  const trapped = Sim.nearestTrapped(sim, playerPos());
  if (trapped) return '✋ [E] Liberar a la persona atrapada';
  if (nearPole()) {
    if (gwStage === 0) return '💡 [E] Accionar la polea y bajar el gateway';
    if (gwStage === 1) return '⬇ Bajando el gateway…';
    if (gwStage === 2) return '🔌 [E] Conectar y descargar los datos del gateway';
    if (gwStage === 3) return '⬇ Descargando reporte…';
    return '🔄 [E] Volver a descargar el reporte actualizado';
  }
  if (nearMainSniffer()) {
    if (sim.phase === 'p' && !sim.voiceAlert) return '📢 [E] Emitir la alerta de evacuación por voz';
    return '📡 [E] Escuchar el estado del sniffer principal';
  }
  return '';
}
function speakReport(r) {
  speak('Reporte recuperado del gateway. Antes del sismo había aproximadamente ' + r.habia +
    ' personas detectadas. Evacuadas confirmadas: ' + r.evacuados +
    '. Podrían seguir dentro: ' + r.podrianSeguirDentro +
    ', de ellas ' + r.atrapadosLocalizados + ' localizadas como posibles atrapadas. Confianza de los datos: ' +
    r.confianza + ' por ciento.', 'operator');
}
function downloadReportNow() {
  lastReport = Sim.buildGatewayReport(sim);
  renderOperatorReport(lastReport);
  $('btnDownload').disabled = false;
  speakReport(lastReport);
  beep(880, 0.1, 'sine', 0.09); beep(1318, 0.14, 'sine', 0.08, 0.1);
}
function interact() {
  if (!sim || !started) return;
  const trapped = Sim.nearestTrapped(sim, playerPos());
  if (trapped) { Sim.rescuePerson(sim, trapped); beep(660, 0.12); return; }
  if (nearPole()) {
    if (gwStage === 0) {
      gwStage = 1; gwTimer = 2.6;
      speak('Bajando el gateway del poste. Espere.', 'operator'); beep(220, 0.3, 'triangle', 0.1);
    } else if (gwStage === 2 || gwStage === 4) {
      gwStage = 3; gwTimer = 1.6;
      speak('Conectando con el gateway. Descargando los registros del sniffer.', 'operator');
    }
    return;
  }
  if (nearMainSniffer()) {
    if (sim.phase === 'p' && !sim.voiceAlert) { Sim.activateVoiceAlert(sim); return; }
    const s = Sim.mainSniffer(sim), rep = Sim.buildGatewayReport(sim);
    speak(s.online
      ? ('Sniffer principal operativo. Batería ' + Math.round(s.battery) + ' por ciento. Último conteo interno: ' + Sim.liveMetrics(sim).detected + ' personas detectadas.')
      : 'El sniffer principal no responde. Consulte el gateway del poste de luz.', 'device');
    selected = { kind: 'sniffer', id: s.id }; updateSelectionInfo();
  }
}
function pickAt(clientX, clientY) {
  if (!sim) return;
  const r = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects([dynamicGroup, gwGroup, poleGroup], true);
  for (const h of hits) {
    let o = h.object;
    while (o && !o.userData.kind) o = o.parent;
    if (o && o.userData.kind) { selected = { kind: o.userData.kind, id: o.userData.id }; updateSelectionInfo(); return; }
  }
}
function updateSelectionInfo() {
  const el = $('selInfo');
  if (!selected || !sim) { el.textContent = 'Nada seleccionado.'; return; }
  if (selected.kind === 'person') {
    const p = sim.people.find(x => x.id === selected.id); if (!p) return;
    const rep = sim.personReports[p.id];
    el.innerHTML = '<b>' + p.name + '</b>\nPiso ' + (p.floor + 1) + ' · ' + Sim.zoneName(p.floor, p.x, p.z) +
      '\nEstado real: ' + p.state + (rep ? '\nÚltima detección: hace ' + Math.max(0, sim.t - rep.t).toFixed(0) + ' s (' + rep.nodeId + ')' : '\nSin detecciones recientes.');
  } else if (selected.kind === 'sniffer') {
    const s = sim.sniffers.find(x => x.id === selected.id); if (!s) return;
    el.innerHTML = '<b>Sniffer ' + s.id + ' · ' + s.name + '</b>' + (s.id === sim.mainSnifferId ? ' (PRINCIPAL)' : '') +
      '\nEstado: ' + (s.buried ? 'SEPULTADO' : !s.online ? 'SIN SERVICIO' : s.sniffer < 0.4 ? 'DEGRADADO' : 'OK') +
      '\nBatería: ' + Math.round(s.battery) + '% · Salud del sniffer: ' + Math.round(s.sniffer * 100) + '%';
  } else if (selected.kind === 'gateway') {
    const r = Sim.buildGatewayReport(sim);
    el.innerHTML = '<b>Gateway · poste de luz</b>\nAltura actual: ' + gwY.toFixed(2) + ' m\nÚltima sincronización: ' +
      (r.lastSync == null ? 'nunca' : 'hace ' + Math.max(0, sim.t - r.lastSync).toFixed(0) + ' s') +
      '\nHabía (t0): ' + r.habia + ' · Podrían seguir dentro: ' + r.podrianSeguirDentro;
  }
}

/* ============================== HUD / REPORTES ============================== */
function fmtTime(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ':' + String(s).padStart(2, '0'); }
function renderOperatorReport(r) {
  $('opReport').innerHTML =
    '🕐 Última sincronización: <b>' + (r.lastSync == null ? '—' : fmtTime(r.lastSync)) + '</b> · En cola: <b>' + r.queued + '</b><br>' +
    '👥 Había antes del sismo (t₀): <b>' + r.habia + '</b> ' +
    '(P1 ' + r.habiaByFloor[0] + ' · P2 ' + r.habiaByFloor[1] + ' · P3 ' + r.habiaByFloor[2] + ' · P4 ' + r.habiaByFloor[3] + ')<br>' +
    '✅ Evacuadas confirmadas: <b>' + r.evacuados + '</b> · 📡 Detectadas dentro ahora: <b>' + r.detectadosDentro + '</b><br>' +
    '⚠️ Podrían seguir dentro: <b>' + r.podrianSeguirDentro + '</b> (posibles atrapadas: <b>' + r.atrapadosProbables +
    '</b>, localizadas: <b>' + r.atrapadosLocalizados + '</b>, sin localizar: <b>' + r.noLocalizados + '</b>)<br>' +
    '📶 Sniffer principal: <b>' + r.snifferPrincipal + '</b> · Batería: <b>' + r.bateriaPrincipal + '%</b> · Sniffers activos: <b>' +
    r.sniffersActivos + '/' + r.sniffersTotal + '</b> · Confianza: <b>' + r.confianza + '%</b>';
  $('priorityList').innerHTML = r.prioridad.length
    ? '<li style="list-style:none;margin-left:-16px"><b style="color:#fff">Prioridad de rescate:</b></li>' +
      r.prioridad.slice(0, 5).map(p => '<li>' + p.label + ' — <b>' + p.count + '</b> posibles (' + p.trapped + ' localizadas como atrapadas)</li>').join('')
    : '';
}
function downloadJSON(r) {
  const blob = new Blob([JSON.stringify({ sistema: 'SISMO-ALERT CyT', generado_en_segundos_sim: r.generatedAt, reporte_gateway: r }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'reporte-gateway-cyt.json'; a.click();
  URL.revokeObjectURL(a.href);
}
function objectiveText() {
  if (!started) return ['🎯 Explora el CyT', 'Los sniffers del techo cuentan personas y envían snapshots al gateway del poste.'];
  const m = Sim.liveMetrics(sim);
  if (sim.phase === 'p') return sim.voiceAlert
    ? ['🟡 ¡ONDA P! Evacuación en curso', 'Sal del edificio por las rampas hacia el punto de encuentro.']
    : ['🟡 ¡ONDA P DETECTADA!', 'Acércate al sniffer principal y pulsa E (o el botón 📢) para emitir la alerta por voz.'];
  if (sim.phase === 's') return ['🔴 ¡TERREMOTO! Protégete', 'Aléjate de vidrios. Espera a que termine el movimiento principal.'];
  if (sim.phase === 'post') {
    if (gwStage < 4) return ['💡 Ve al poste de luz', 'Baja el gateway con la polea y descarga cuánta gente había y cuánta podría seguir dentro.'];
    if (m.trapped > 0) return ['⛑️ Rescata a las personas atrapadas (' + m.trapped + ')', 'Usa la prioridad del reporte. Acércate a cada persona naranja y pulsa E para liberarla.'];
    return ['✅ Sin atrapados conocidos', 'Actualiza el reporte en el gateway o abre el reporte final e-ink.'];
  }
  return ['🎯 Explora el CyT', 'Observa cómo los sniffers detectan personas. Dispara un sismo con Q o desde el panel.'];
}
function syncEvents(silent) {
  let lastPhase = syncEvents._phase || 'normal';
  for (const ev of sim.events) {
    if (ev.id <= lastEventId) continue;
    lastEventId = ev.id;
    const div = document.createElement('div');
    div.className = 'log-item ' + ev.type;
    div.innerHTML = '<b>' + fmtTime(ev.t) + '</b>' + ev.text;
    const log = $('eventLog'); log.prepend(div);
    while (log.children.length > 60) log.lastChild.remove();
    if (!silent && started) {
      if (ev.type === 'voice') speak(ev.text, 'device');
      else if (ev.type === 'npc') speak(ev.text, 'npc');
    }
  }
  if (sim.phase === 's' && lastPhase !== 's') { setRumble(true); beep(880, 0.4, 'square', 0.06); beep(880, 0.4, 'square', 0.06, 0.5); }
  if (sim.phase !== 's' && lastPhase === 's') setRumble(false);
  if (sim.phase === 'p' && lastPhase !== 'p') { beep(660, 0.12, 'square', 0.08); beep(660, 0.12, 'square', 0.08, 0.18); }
  syncEvents._phase = sim.phase;
  if (syncEvents._dmg !== sim.damaged.length) { syncEvents._dmg = sim.damaged.length; rebuildRubble(); }
}
let hudTimer = 0;
function updateHUD(force) {
  if (!sim) return;
  const m = Sim.liveMetrics(sim);
  $('mDetected').textContent = m.detected;
  $('mEvacuated').textContent = m.evacuated;
  $('mTrapped').textContent = m.trapped;
  $('mPrecision').textContent = m.precision.toFixed(1) + '%';
  $('mFiltered').textContent = m.filtered;
  $('mRescued').textContent = sim.rescuedCount;
  const tag = $('phaseTag');
  const phaseName = { normal: 'MONITOREO', p: '🟡 ONDA P', s: '🔴 SISMO ' + (sim.profile ? sim.profile.mag.toFixed(1) : ''), post: 'POST-SISMO' }[sim.phase];
  tag.textContent = phaseName + ' · ' + fmtTime(sim.t);
  tag.className = sim.phase === 'p' || sim.phase === 's' ? sim.phase : '';
  tag.id = 'phaseTag';
  const r = Sim.buildGatewayReport(sim);
  $('einkMini').innerHTML = 'GENTE DETECTADA: ' + m.detected + '<br>SISMICO: ' +
    (sim.phase === 'normal' ? 'OK' : sim.phase === 'p' ? 'ONDA-P!' : 'ALERTA') +
    '<br>GATEWAY: ' + (!sim.gateway.link ? 'SIN ENLACE · COLA ' + r.queued : r.lastSync == null ? 'ESPERANDO' : 'SYNC hace ' + Math.max(0, sim.t - r.lastSync).toFixed(0) + ' s');
  const [o1, o2] = objectiveText();
  $('objective').innerHTML = o1 + '<small>' + o2 + '</small>';
  const vb = $('btnVoiceAlert');
  vb.disabled = !(sim.phase === 'p' && !sim.voiceAlert);
  vb.classList.toggle('armed', !vb.disabled);
  const pr = currentPrompt();
  $('prompt').style.display = pr ? 'block' : 'none';
  $('prompt').textContent = pr;
  $('xrBox').textContent = pr || o1;
  updateNodeList(); updateSelectionInfo();
}
let nodeListTimer = 0;
function updateNodeList() {
  const now = performance.now();
  if (now - nodeListTimer < 900) return;
  nodeListTimer = now;
  $('nodeList').innerHTML = sim.sniffers.map(s => {
    const st = s.buried ? ['SEPULTADO', 'st-bad'] : !s.online ? ['SIN SERVICIO', 'st-bad'] : s.sniffer < 0.4 ? ['DEGRADADO', 'st-warn'] : ['OK', 'st-ok'];
    return '<button class="node-btn" data-node="' + s.id + '" type="button"><span>' + s.id + ' · ' + s.name + (s.id === sim.mainSnifferId ? ' ⭐' : '') +
      '</span><span class="' + st[1] + '">' + st[0] + ' · ' + Math.round(s.battery) + '%</span></button>';
  }).join('');
  document.querySelectorAll('[data-node]').forEach(b => b.addEventListener('click', () => {
    selected = { kind: 'sniffer', id: b.dataset.node }; updateSelectionInfo();
    const s = sim.sniffers.find(x => x.id === b.dataset.node);
    if (s) { rig.position.set(s.x + 2.5, s.floor * Sim.FLOOR_H, s.z + 3.5); player.yaw = Math.atan2(-(2.5), 3.5) + Math.PI; }
  }));
}
function applyFloorView() {
  const v = $('selFloorView').value;
  floorGroups.forEach((g, f) => { g.visible = v === 'all' || +v === f; });
  roofGroup.visible = v === 'all';
  if (!sim) return;
  peopleMeshes.forEach((m, id) => {
    const p = sim.people.find(x => x.id === id);
    m.group.visible = v === 'all' || p.state === 'evacuated' || p.floor === +v;
  });
  snifferMeshes.forEach((m, id) => {
    const s = sim.sniffers.find(x => x.id === id);
    m.group.visible = m.scan.visible = v === 'all' || s.floor === +v;
  });
}

/* ============================== SINCRONIZACIÓN 3D ============================== */
const STATE_COLORS = { detected: 0x38bdf8, none: 0x94a3b8, evacuated: 0x34d399, trapped: 0xfb923c, evacuating: 0xfacc15 };
function syncDynamic(now) {
  const floorView = $('selFloorView').value;
  sim.people.forEach(p => {
    const m = peopleMeshes.get(p.id); if (!m) return;
    const yBase = p.floor * Sim.FLOOR_H;
    const bob = p.moving && p.state !== 'trapped' ? Math.abs(Math.sin(now / 130 + p.id)) * 0.07 : 0;
    m.group.position.set(p.x, yBase + bob, p.z);
    m.group.rotation.set(p.state === 'trapped' ? 1.25 : 0, p.heading, 0);
    if (p.state === 'trapped') m.group.position.y = yBase + 0.28;
    const rep = sim.personReports[p.id];
    const det = rep && sim.t - rep.t <= 6;
    const col = p.state === 'evacuated' ? STATE_COLORS.evacuated : p.state === 'trapped' ? STATE_COLORS.trapped :
      det ? STATE_COLORS.detected : p.state === 'evacuating' ? STATE_COLORS.evacuating : STATE_COLORS.none;
    m.bodyMat.color.setHex(col);
    m.ring.material.color.setHex(det ? 0x22d3ee : 0x64748b);
    m.ring.scale.setScalar(1 + Math.sin(now / 280 + p.id) * 0.18);
    const swing = p.moving ? Math.sin(now / 110 + p.id * 2) * 0.65 : 0;
    m.arms[0].rotation.x = swing; m.arms[1].rotation.x = -swing;
    m.group.visible = floorView === 'all' || p.state === 'evacuated' || p.floor === +floorView;
    const isSel = selected && selected.kind === 'person' && selected.id === p.id;
    m.ring.material.opacity = isSel ? 1 : 0.8;
    if (isSel) m.ring.material.color.setHex(0xfacc15);
  });
  sim.sniffers.forEach(s => {
    const m = snifferMeshes.get(s.id); if (!m) return;
    if (s.buried && m.group.position.y > s.floor * Sim.FLOOR_H + 0.45) {
      m.group.position.y -= 0.06; m.group.rotation.z += 0.01;
    }
    const col = !s.online ? 0xef4444 : s.sniffer < 0.4 ? 0xfb923c :
      sim.phase === 'p' ? 0xfacc15 : sim.phase === 's' ? 0xef4444 : sim.blackout ? 0xf8fafc : 0x22d3ee;
    m.ledMat.color.setHex(col); m.ledMat.emissive.setHex(col);
    m.ledMat.emissiveIntensity = sim.phase === 's' || sim.phase === 'p' ? (Math.sin(now / 120) > 0 ? 2.6 : 0.6) : 1.8;
    const frac = s.online ? ((now / 2600 + s.floor * 0.23) % 1) : 0;
    m.scan.visible = s.online && (floorView === 'all' || s.floor === +floorView);
    m.scan.scale.setScalar(Math.max(0.4, frac * s.radius));
    m.scan.material.opacity = 0.32 * (1 - frac);
    m.scan.material.color.setHex(col);
  });
  // líneas de detección
  {
    const { arr, geo, max } = detectLines; let n = 0;
    for (const l of sim.links) {
      if (n >= max) break;
      const s = sim.sniffers.find(x => x.id === l.nodeId), p = sim.people.find(x => x.id === l.personId);
      if (!s || !p) continue;
      arr.set([s.x, s.y - 0.2, s.z, p.x, p.floor * Sim.FLOOR_H + 1.8, p.z], n * 6); n++;
    }
    geo.attributes.position.needsUpdate = true; geo.setDrawRange(0, n * 2);
  }
  packetPool.forEach((mesh, i) => {
    const pk = sim.packets[i];
    if (!pk) { mesh.visible = false; return; }
    const t = THREE.MathUtils.clamp(pk.age / pk.duration, 0, 1);
    const a = pk.route[0], b = pk.route[1];
    mesh.visible = true;
    mesh.position.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t + Math.sin(t * Math.PI) * 2.2, a.z + (b.z - a.z) * t);
  });
  ghostPool.forEach((mesh, i) => {
    const g = sim.ghosts[i];
    if (!g) { mesh.visible = false; return; }
    mesh.visible = true;
    mesh.position.set(g.x, g.floor * Sim.FLOOR_H + 1.7 + Math.sin(now / 240 + i) * 0.12, g.z);
    mesh.rotation.y = now / 400 + i;
    mesh.material.opacity = g.detected ? 0.95 : 0.55;
  });
  // gateway / polea
  if (gwStage === 1) {
    gwY = Math.max(1.18, gwY - 0.016);
    if (gwY <= 1.18) { gwStage = 2; speak('Gateway a un metro dieciocho. Ya puede conectar el cable y descargar los registros.', 'operator'); }
  }
  if (gwStage === 3) {
    gwTimer -= 1 / 60;
    gwLeds[1].material.emissiveIntensity = Math.sin(now / 70) > 0 ? 3 : 0.3;
    if (gwTimer <= 0) { gwStage = 4; downloadReportNow(); }
  }
  gwGroup.position.y = gwY;
  const topY = 5.35, ropeLen = Math.max(0.1, topY - gwY);
  rope.scale.y = ropeLen; rope.position.set(GP.x + 0.45, gwY + ropeLen / 2 + 0.3, GP.z);
  const hasT0 = !!sim.gateway.preQuake;
  gwLeds[0].material.emissiveIntensity = sim.gateway.link ? 1.8 : 0.15;
  gwLeds[1].material.emissiveIntensity = sim.packets.length ? (Math.sin(now / 90) > 0 ? 3 : 0.4) : 0.7;
  gwLeds[2].material.emissiveIntensity = hasT0 ? 2.4 : 0.25;
  // ambiente
  dustPoints.material.opacity = sim.dust * 0.55;
  dustPoints.rotation.y = now / 9000;
  const flick = sim.phase === 's' && !reducedMotion ? (Math.random() < 0.25 ? 0.35 : 1) : 1;
  sun.intensity = (sim.blackout ? 0.35 : 1.9) * flick;
  hemi.intensity = (sim.blackout ? 0.22 : 0.95) * flick;
  emergencyLight.intensity = sim.blackout ? (Math.sin(now / 300) > 0 ? 30 : 4) : 0;
}

/* ============================== CONTROLES UI ============================== */
function tryQuake() {
  if (!sim) return;
  started = true; running = true; $('startOverlay').hidden = true; $('btnPause').textContent = '⏸ Pausa';
  audio();
  if (Sim.triggerQuake(sim, +$('rngMag').value)) speak('Iniciando simulación de sismo de magnitud ' + (+$('rngMag').value).toFixed(1) + '.', 'operator');
}
$('btnStart').addEventListener('click', () => {
  started = true; running = true;
  $('startOverlay').hidden = true; $('btnPause').textContent = '⏸ Pausa';
  audio();
  speak('Bienvenido al edificio CyT. Los sniffers de techo están activos y el gateway del poste está recibiendo datos.', 'operator');
});
$('btnPause').addEventListener('click', () => {
  if (!started) { $('btnStart').click(); return; }
  running = !running;
  $('btnPause').textContent = running ? '⏸ Pausa' : '▶ Reanudar';
});
$('btnReset').addEventListener('click', () => resetSim(true));
$('btnQuake').addEventListener('click', tryQuake);
$('btnVoiceAlert').addEventListener('click', () => { if (sim) Sim.activateVoiceAlert(sim); });
$('selFloor').addEventListener('change', () => resetSim(true));
$('selQuality').addEventListener('change', () => resetSim(true));
$('selScenario').addEventListener('change', e => {
  const m = scenarioMag[e.target.value];
  if (m) { $('rngMag').value = m; $('magVal').textContent = m.toFixed(1) + ' Mw'; }
  resetSim(true);
});
$('rngMag').addEventListener('input', e => { $('magVal').textContent = (+e.target.value).toFixed(1) + ' Mw'; if (sim) sim.mag = +e.target.value; });
document.querySelectorAll('[data-mag]').forEach(b => b.addEventListener('click', () => {
  $('rngMag').value = b.dataset.mag; $('magVal').textContent = (+b.dataset.mag).toFixed(1) + ' Mw'; if (sim) sim.mag = +b.dataset.mag;
}));
$('selFloorView').addEventListener('change', applyFloorView);
document.querySelectorAll('.chip-fault').forEach(ch => ch.addEventListener('click', () => {
  const on = ch.getAttribute('aria-pressed') !== 'true';
  ch.setAttribute('aria-pressed', String(on));
  if (sim) { Sim.setFault(sim, ch.dataset.fault, on); syncEvents(); }
}));
$('btnVoice').addEventListener('click', function () {
  voiceOn = !voiceOn; this.setAttribute('aria-pressed', String(voiceOn));
  this.textContent = voiceOn ? '🗣️ Voz ES' : '🔇 Voz ES';
  if (!voiceOn && window.speechSynthesis) speechSynthesis.cancel();
  if (voiceOn) speak('Voz en español activada.', 'operator');
});
$('btnSound').addEventListener('click', function () {
  soundOn = !soundOn; this.setAttribute('aria-pressed', String(soundOn));
  this.textContent = soundOn ? '🔊 Sonido' : '🔇 Sonido';
  if (!soundOn) setRumble(false);
});
$('btnDownload').addEventListener('click', () => { if (lastReport) downloadJSON(lastReport); });
function showFinal() {
  const r = Sim.buildGatewayReport(sim), m = Sim.liveMetrics(sim);
  lastReport = r; renderOperatorReport(r); $('btnDownload').disabled = false;
  $('fHabia').textContent = r.habia;
  $('fEvac').textContent = r.evacuados;
  $('fDentro').textContent = r.podrianSeguirDentro;
  $('fSismico').textContent = sim.phase === 'normal' ? 'OK' : 'ALERTA ' + (r.mag ? r.mag.toFixed(1) : '');
  $('fConf').textContent = r.confianza + '%';
  $('finalSummary').textContent =
    'Prioridad de rescate: ' + (r.prioridad.slice(0, 3).map(p => p.label + ' (' + p.count + ')').join(' · ') || 'sin zonas con posibles atrapados') +
    '\nLiberadas por ti: ' + sim.rescuedCount + ' · Atrapadas reales ahora (simulación): ' + m.trapped +
    '\nSniffer principal: ' + r.snifferPrincipal + ' · Sniffers activos: ' + r.sniffersActivos + '/' + r.sniffersTotal +
    '\n\nAunque el sniffer interior falle, el gateway del poste conserva el conteo previo (t₀) para orientar el rescate.';
  $('finalModal').showModal();
  speakReport(r);
}
$('btnFinal').addEventListener('click', showFinal);
$('btnFinalClose').addEventListener('click', () => $('finalModal').close());
$('btnFinalDownload').addEventListener('click', () => { if (lastReport) downloadJSON(lastReport); });
$('btnViewBuilding').addEventListener('click', () => { rig.position.set(0, 0, 20); player.yaw = 0; player.pitch = -0.03; rig.rotation.y = 0; });
$('btnViewPole').addEventListener('click', () => { rig.position.set(21.5, 0, 27.5); player.yaw = -0.7; rig.rotation.y = player.yaw; });
$('btnFreeCam').addEventListener('click', function () {
  player.free = !player.free;
  this.setAttribute('aria-pressed', String(player.free));
  this.textContent = player.free ? '🚶 Modo operario' : '🛸 Vista libre';
  if (player.free) rig.position.y = Math.max(rig.position.y, 7);
});
$('btnVR').addEventListener('click', async () => {
  if (!navigator.xr) { speak('Este navegador no soporta WebXR. Abre la página en el navegador de las gafas VR.', 'operator'); return; }
  try {
    const ok = await navigator.xr.isSessionSupported('immersive-vr');
    if (!ok) { speak('La realidad virtual inmersiva no está disponible en este dispositivo.', 'operator'); return; }
    started = true; running = true; $('startOverlay').hidden = true; audio();
    $('xrOverlay').hidden = false;
    const session = await navigator.xr.requestSession('immersive-vr', {
      optionalFeatures: ['local-floor', 'bounded-floor', 'dom-overlay'],
      domOverlay: { root: $('xrOverlay') }
    });
    session.addEventListener('end', () => { $('xrOverlay').hidden = true; });
    await renderer.xr.setSession(session);
    speak('Modo realidad virtual activado. Camine con el stick izquierdo y use el gatillo para interactuar.', 'operator');
  } catch (err) {
    $('xrOverlay').hidden = true;
    console.warn(err);
    speak('No fue posible iniciar la realidad virtual. Verifica que las gafas estén conectadas.', 'operator');
  }
});

/* ============================== BUCLE ============================== */
resetSim(false);
resize();
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = performance.now();
  if (sim) {
    if (running && started) {
      let remaining = dt * (+$('selSpeed').value || 1);
      while (remaining > 0) { const stepDt = Math.min(remaining, 0.05); Sim.step(sim, stepDt); remaining -= stepDt; }
      syncEvents();
    }
    updatePlayer(dt);
    if (sim.shake > 0 && !reducedMotion && !renderer.xr.isPresenting) {
      const a = sim.shake * 0.16;
      camera.position.x = (Math.random() - 0.5) * a;
      camera.position.y = (keys.KeyC ? 1.05 : 1.65) + (Math.random() - 0.5) * a;
    } else if (!renderer.xr.isPresenting) {
      camera.position.x = 0;
    }
    syncDynamic(now);
    hudTimer -= dt;
    if (hudTimer <= 0) { hudTimer = 0.25; updateHUD(); }
  }
  renderer.render(scene, camera);
});
