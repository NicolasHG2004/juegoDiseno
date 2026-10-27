/* =====================================================================
   SISMO-ALERT CyT — núcleo de simulación (sin DOM ni Three.js)
   Personas + sniffers de techo + terremoto + gateway en poste de luz.
   Lo usa el render 3D/WebXR (js/app3d.js) y las pruebas en Node.
   ===================================================================== */
(function (global) {
  'use strict';

  var FLOORS = 4, FLOOR_H = 3.4;
  var MAIN = { x1: -30, x2: 30, z1: -6, z2: 6 };
  var WING = { x1: -30, x2: -15, z1: -18, z2: 6 };
  var STAIRS = [{ x: -20, z: 3.5 }, { x: 20, z: -3.5 }];
  var ASSEMBLY = { x: 12, z: 20 };
  var GATEWAY_POS = { x: 26, y: 4.65, z: 22 };
  var ZONE_NAMES = [
    ['Cafetería', 'Lobby principal', 'Auditorio', 'Servicios'],
    ['Laboratorio de Electrónica', 'Laboratorio de Física', 'Aulas 200', 'Sala de estudio'],
    ['Laboratorios de cómputo', 'Sala de servidores', 'Aulas 300', 'Biblioteca'],
    ['Terraza cubierta', 'Sala de proyectos', 'Aulas 400', 'Zona de estudio']
  ];

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function inside(x, z) {
    return (x >= MAIN.x1 && x <= MAIN.x2 && z >= MAIN.z1 && z <= MAIN.z2) ||
           (x >= WING.x1 && x <= WING.x2 && z >= WING.z1 && z <= WING.z2);
  }
  function zoneIdx(x, z) { return (z >= 0 ? 2 : 0) + (x >= 0 ? 1 : 0); }
  function zoneName(floor, x, z) {
    if (!inside(x, z)) return 'Exterior / punto de encuentro';
    return ZONE_NAMES[clamp(floor, 0, 3)][zoneIdx(x, z)];
  }
  function magnitudeProfile(m) {
    var k = clamp((m - 3) / 4.2, 0, 1);
    return {
      mag: m, k: k,
      lead: clamp(5.4 - m * 0.45, 1.8, 4.2),
      duration: 2.5 + m * 0.9,
      shake: 0.04 + k * 0.55,
      damageP: k * k * 0.8,
      trappedP: k * k * 0.7,
      outageP: k * 0.9,
      nodeDamageP: k * k * 0.45,
      interference: 0.2 + k * 0.7,
      dust: k
    };
  }
  function addEvent(state, type, text) {
    state.events.push({ id: ++state.eventSeq, t: state.t, type: type, text: text });
    if (state.events.length > 180) state.events.shift();
  }
  function randInside(rand) {
    if (rand() < 0.78) return { x: -28 + rand() * 56, z: -4.8 + rand() * 9.6 };
    return { x: -28.5 + rand() * 12, z: -16.5 + rand() * 21 };
  }
  function nearestStair(x, z) {
    var d0 = Math.hypot(x - STAIRS[0].x, z - STAIRS[0].z);
    var d1 = Math.hypot(x - STAIRS[1].x, z - STAIRS[1].z);
    return d0 <= d1 ? STAIRS[0] : STAIRS[1];
  }

  function createState(opts) {
    opts = opts || {};
    var rand = mulberry32(opts.seed || ((Math.random() * 1e9) | 0));
    var mainFloor = clamp(opts.floor == null ? 1 : opts.floor, 0, 3);
    var sniffers = [], f, s;
    for (f = 0; f < FLOORS; f++) {
      [{ x: -16, z: 0 }, { x: 16, z: 0 }].forEach(function (pos, i) {
        sniffers.push({
          id: 'S' + (f * 2 + i + 1), name: 'Piso ' + (f + 1) + (i ? ' · Oriente' : ' · Occidente'),
          floor: f, x: pos.x, y: f * FLOOR_H + 3.05, z: pos.z,
          radius: 18, online: true, buried: false, sniffer: 1, battery: 100, queued: 0
        });
      });
    }
    var people = [], n = opts.people || 36, i;
    var floorWeights = [0.30, 0.30, 0.25, 0.15];
    for (i = 0; i < n; i++) {
      var r = rand(), fl = r < 0.30 ? 0 : r < 0.60 ? 1 : r < 0.85 ? 2 : 3;
      var p0 = randInside(rand), tg = randInside(rand);
      people.push({
        id: i + 1, name: 'Persona ' + (i + 1), floor: fl, x: p0.x, z: p0.z,
        tx: tg.x, tz: tg.z, heading: rand() * Math.PI * 2,
        speed: 0.85 + rand() * 0.6, state: 'inside', moving: false,
        wait: rand() * 1.5, goalFloor: null, pendingFloor: null,
        evacAt: 0, ax: ASSEMBLY.x + (rand() - 0.5) * 8, az: ASSEMBLY.z + (rand() - 0.5) * 5,
        outside: false, hue: rand()
      });
    }
    var state = {
      t: 0, rand: rand, people: people, sniffers: sniffers, ghosts: [], packets: [],
      events: [], eventSeq: 0, mainFloor: mainFloor,
      mainSnifferId: sniffers[mainFloor * 2].id,
      mag: opts.magnitude || 5.4, scenario: 'normal',
      phase: 'normal', profile: null, phaseEndsAt: 0, everQuake: false,
      evac: false, voiceAlert: false, blackout: false,
      faults: { sniffer: false, nodeDown: false, gatewayOut: false, macSat: false, blackout: false, aftershock: false },
      personReports: {}, links: [], damaged: [], damagedKeys: {},
      stats: { tp: 0, fp: 0, filtered: 0 }, rescuedCount: 0,
      gateway: {
        x: GATEWAY_POS.x, y: GATEWAY_POS.y, z: GATEWAY_POS.z, link: true,
        lastSync: null, lastSnapshot: null, preQuake: null, known: {}, checkedIn: {}, queued: 0
      },
      scanTimer: 0.2, reportTimer: 1.0, ghostTimer: 0.8,
      dust: 0, shake: 0, scheduledAt: null, scheduledMag: null,
      mainBuriedAt: null, aftershockAt: null, faultNodeId: null
    };
    addEvent(state, 'info', 'Sistema SISMO-ALERT activo en el edificio CyT. Sniffers de techo escaneando.');
    return state;
  }

  function mainSniffer(state) {
    for (var i = 0; i < state.sniffers.length; i++) if (state.sniffers[i].id === state.mainSnifferId) return state.sniffers[i];
    return state.sniffers[0];
  }
  function makeSnapshot(state) {
    var entries = [], byFloor = [0, 0, 0, 0], id;
    for (id in state.personReports) {
      var e = state.personReports[id];
      if (state.t - e.t <= 12) {
        entries.push({ id: e.id, t: e.t, floor: e.floor, zone: e.zone, x: e.x, z: e.z, trappedHint: !!e.trappedHint });
        byFloor[e.floor]++;
      }
    }
    var active = state.sniffers.filter(function (s) { return s.online; }).length;
    var main = mainSniffer(state);
    return {
      t: state.t, count: entries.length, entries: entries, byFloor: byFloor,
      activeSniffers: active, mainSniffer: main.online ? (main.sniffer < 0.4 ? 'DEGRADADO' : 'OK') : 'SIN SEÑAL',
      mainBattery: Math.round(main.battery), phase: state.phase,
      mag: state.profile ? state.profile.mag : null
    };
  }
  function deliverSnapshot(state, snap) {
    var g = state.gateway;
    g.lastSnapshot = snap; g.lastSync = state.t; g.queued = 0;
    snap.entries.forEach(function (e) { g.known[e.id] = e; });
  }
  function sendReport(state) {
    var snap = makeSnapshot(state), g = state.gateway;
    var active = state.sniffers.filter(function (s) { return s.online; });
    if (!g.link || !active.length) { g.queued++; return; }
    var from = active[0], best = 1e9;
    active.forEach(function (s) { var d = Math.hypot(s.x - g.x, s.z - g.z); if (d < best) { best = d; from = s; } });
    state.packets.push({
      age: 0, duration: 1.15, snapshot: snap,
      route: [{ x: from.x, y: from.y, z: from.z }, { x: g.x, y: g.y, z: g.z }]
    });
  }

  function startEvacuation(state, maxDelay) {
    if (state.evac) return;
    state.evac = true;
    state.people.forEach(function (p) {
      if (p.state === 'inside') p.evacAt = state.t + state.rand() * maxDelay;
    });
  }
  function activateVoiceAlert(state) {
    if (state.voiceAlert) return false;
    state.voiceAlert = true;
    addEvent(state, 'voice', 'Atención. Se detectó un sismo. Mantenga la calma. Evacúe por las rampas y escaleras hacia el punto de encuentro. No use ascensores.');
    startEvacuation(state, 1.4);
    return true;
  }
  function triggerQuake(state, mag) {
    if (state.phase === 'p' || state.phase === 's') return false;
    state.mag = mag;
    state.profile = magnitudeProfile(mag);
    state.everQuake = true;
    state.gateway.preQuake = state.gateway.lastSnapshot || makeSnapshot(state);
    state.phase = 'p';
    state.phaseEndsAt = state.t + state.profile.lead;
    addEvent(state, 'voice', 'Atención. El sniffer detectó la onda inicial de un sismo. Prepárese para evacuar.');
    addEvent(state, 'warn', 'Onda P detectada (MAG ' + mag.toFixed(1) + '). Snapshot t0 protegido en el gateway: ' +
      state.gateway.preQuake.count + ' personas detectadas.');
    return true;
  }
  function startSWave(state) {
    var pr = state.profile, rand = state.rand, f, z;
    state.phase = 's';
    state.phaseEndsAt = state.t + pr.duration;
    state.shake = pr.shake; state.dust = Math.max(state.dust, pr.dust);
    for (f = 0; f < FLOORS; f++) for (z = 0; z < 4; z++) {
      if (rand() < pr.damageP) {
        var key = f + ':' + z;
        if (!state.damagedKeys[key]) {
          state.damagedKeys[key] = true;
          state.damaged.push({ floor: f, zone: z, x: (z % 2 ? 15 : -15), z: (z >= 2 ? 3 : -3), w: 15, d: 6.5 });
        }
      }
    }
    state.people.forEach(function (p) {
      if (p.state === 'evacuated' || p.state === 'trapped') return;
      var key = p.floor + ':' + zoneIdx(p.x, p.z);
      if (inside(p.x, p.z) && state.damagedKeys[key] &&
          rand() < pr.trappedP * (p.state === 'evacuating' ? 0.5 : 1)) {
        p.state = 'trapped'; p.moving = false;
      }
    });
    state.sniffers.forEach(function (s) {
      if (!s.online) return;
      if (rand() < pr.nodeDamageP) {
        if (s.id === state.mainSnifferId) { s.sniffer = Math.min(s.sniffer, 0.3); addEvent(state, 'crit', 'El sniffer principal quedó degradado por el impacto.'); }
        else { s.online = false; addEvent(state, 'crit', 'Sniffer ' + s.name + ' fuera de servicio.'); }
      }
    });
    if (state.scenario === 'colapso' || pr.mag >= 7.4) state.mainBuriedAt = state.t + 4;
    if (rand() < pr.outageP || state.faults.blackout) {
      state.blackout = true;
      addEvent(state, 'crit', 'Apagón en el edificio. Los sniffers pasan a batería.');
    }
    if (!state.voiceAlert) activateVoiceAlert(state);
    addEvent(state, 'npc', '¡Está temblando muy fuerte! ¡Todos a las escaleras!');
  }
  function endSWave(state) {
    state.phase = 'post'; state.shake = 0;
    addEvent(state, 'voice', 'El movimiento principal terminó. Si se encuentra dentro del edificio, evacúe con precaución hacia el punto de encuentro.');
    if (state.faults.aftershock && !state.aftershockAt) state.aftershockAt = state.t + 18;
  }

  function setFault(state, key, on) {
    state.faults[key] = !!on;
    var main = mainSniffer(state);
    if (key === 'sniffer') {
      main.sniffer = on ? 0.12 : 1;
      addEvent(state, on ? 'crit' : 'info', on ? 'FALLA: sniffer principal dañado. El conteo pierde confiabilidad.' : 'Sniffer principal reparado.');
    } else if (key === 'gatewayOut') {
      state.gateway.link = !on;
      addEvent(state, on ? 'crit' : 'info', on ? 'Gateway del poste fuera de enlace. Los datos se están almacenando.' : 'Enlace con el gateway restablecido.');
    } else if (key === 'nodeDown') {
      if (on) {
        var cand = state.sniffers.filter(function (s) { return s.online && s.id !== state.mainSnifferId; })[0];
        if (cand) { cand.online = false; state.faultNodeId = cand.id; addEvent(state, 'crit', 'FALLA: sniffer ' + cand.name + ' sin servicio.'); }
      } else if (state.faultNodeId) {
        state.sniffers.forEach(function (s) { if (s.id === state.faultNodeId) s.online = true; });
        state.faultNodeId = null;
      }
    } else if (key === 'blackout') {
      state.blackout = !!on;
      addEvent(state, on ? 'crit' : 'info', on ? 'Corte de energía: sniffers en batería.' : 'Energía restablecida.');
    } else if (key === 'aftershock' && on && state.phase === 'post') {
      state.aftershockAt = state.t + 10;
    }
  }
  function applyScenario(state, key) {
    state.scenario = key;
    var sched = function (mag, delay) { state.mag = mag; state.scheduledMag = mag; state.scheduledAt = state.t + (delay || 8); };
    if (key === 'suave') sched(4.2);
    else if (key === 'moderado') sched(5.4);
    else if (key === 'fuerte') sched(6.9);
    else if (key === 'colapso') sched(7.8);
    else if (key === 'sniffer') { setFault(state, 'sniffer', true); sched(5.4); }
    else if (key === 'apagon') { setFault(state, 'blackout', true); sched(6.9); }
    else if (key === 'gateway') { setFault(state, 'gatewayOut', true); sched(5.4); }
    else if (key === 'macs') setFault(state, 'macSat', true);
    else if (key === 'replica') { setFault(state, 'aftershock', true); sched(6.9); }
    return state;
  }

  function moveToward(p, tx, tz, dt, speed) {
    var dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
    if (d < 0.18) { p.moving = false; return true; }
    var step = Math.min(d, speed * dt);
    p.x += dx / d * step; p.z += dz / d * step;
    p.heading = Math.atan2(dx, dz); p.moving = true;
    return false;
  }
  function updatePerson(state, p, dt) {
    if (p.state === 'trapped' || p.state === 'evacuated') { p.moving = false; return; }
    if (state.evac && p.state === 'inside' && state.t >= p.evacAt) p.state = 'evacuating';
    if (p.wait > 0) {
      p.wait -= dt; p.moving = false;
      if (p.wait <= 0 && p.pendingFloor != null) { p.floor = p.pendingFloor; p.pendingFloor = null; }
      return;
    }
    var speed = p.state === 'evacuating' ? p.speed * 1.9 : p.speed;
    if (p.state === 'evacuating') {
      if (p.floor > 0) {
        var st = nearestStair(p.x, p.z);
        if (moveToward(p, st.x, st.z, dt, speed)) { p.pendingFloor = p.floor - 1; p.wait = 0.55; }
      } else if (!p.outside) {
        if (moveToward(p, p.x < 0 ? -20 : 4, 8.5, dt, speed)) p.outside = true;
      } else if (moveToward(p, p.ax, p.az, dt, speed)) {
        p.state = 'evacuated'; p.moving = false;
        state.gateway.checkedIn[p.id] = state.t;
      }
      return;
    }
    if (p.goalFloor != null) {
      if (p.goalFloor === p.floor) { p.goalFloor = null; var t0 = randInside(state.rand); p.tx = t0.x; p.tz = t0.z; }
      else {
        var st2 = nearestStair(p.x, p.z);
        if (moveToward(p, st2.x, st2.z, dt, speed)) {
          p.pendingFloor = p.floor + (p.goalFloor > p.floor ? 1 : -1); p.wait = 0.55;
        }
      }
      return;
    }
    if (moveToward(p, p.tx, p.tz, dt, speed)) {
      p.wait = 0.4 + state.rand() * 1.6;
      if (state.rand() < 0.16) p.goalFloor = (state.rand() * FLOORS) | 0;
      var t1 = randInside(state.rand); p.tx = t1.x; p.tz = t1.z;
    }
  }
  function scan(state) {
    state.links = [];
    var rand = state.rand;
    state.sniffers.forEach(function (s) {
      if (!s.online) return;
      var range = s.radius * (0.3 + 0.7 * s.sniffer) * (state.phase === 's' ? 0.62 : 1);
      state.people.forEach(function (p) {
        if (p.state === 'evacuated' || p.floor !== s.floor || !inside(p.x, p.z)) return;
        var d = Math.hypot(p.x - s.x, p.z - s.z);
        if (d > range) return;
        var prob = clamp(1.05 - d / range, 0.15, 0.95) * (s.sniffer < 0.4 ? 0.25 : 1) * (state.phase === 's' ? 0.7 : 1);
        if (rand() < prob) {
          state.personReports[p.id] = {
            id: p.id, t: state.t, floor: p.floor, zone: zoneName(p.floor, p.x, p.z),
            x: p.x, z: p.z, nodeId: s.id, trappedHint: p.state === 'trapped'
          };
          state.links.push({ nodeId: s.id, personId: p.id });
          state.stats.tp++;
        }
      });
    });
    state.ghosts.forEach(function (g) {
      if (g.counted) return;
      var inRange = state.sniffers.some(function (s) {
        return s.online && s.floor === g.floor && Math.hypot(g.x - s.x, g.z - s.z) < s.radius;
      });
      if (!inRange) return;
      g.counted = true;
      var filterP = state.faults.macSat ? 0.72 : (state.phase === 's' ? 0.55 : 0.92);
      if (rand() < filterP) { state.stats.filtered++; g.age = g.ttl; }
      else { state.stats.fp++; g.detected = true; }
    });
  }
  function step(state, dt) {
    dt = Math.min(dt, 0.1);
    state.t += dt;
    var rand = state.rand;
    if (state.scheduledAt != null && state.t >= state.scheduledAt) {
      var m = state.scheduledMag; state.scheduledAt = null; triggerQuake(state, m);
    }
    if (state.phase === 'p' && state.t >= state.phaseEndsAt) startSWave(state);
    else if (state.phase === 's' && state.t >= state.phaseEndsAt) endSWave(state);
    if (state.mainBuriedAt != null && state.t >= state.mainBuriedAt) {
      state.mainBuriedAt = null;
      var main = mainSniffer(state);
      main.online = false; main.buried = true;
      addEvent(state, 'crit', 'El sniffer principal quedó bajo escombros. Su última telemetría está en el gateway del poste.');
    }
    if (state.aftershockAt != null && state.t >= state.aftershockAt) {
      state.aftershockAt = null;
      addEvent(state, 'warn', '¡Réplica sísmica!');
      triggerQuake(state, Math.max(3.2, state.mag - 1.1));
    }
    state.people.forEach(function (p) { updatePerson(state, p, dt); });
    state.ghostTimer -= dt;
    if (state.ghostTimer <= 0) {
      state.ghostTimer = state.faults.macSat ? 0.35 : 1.4;
      var host = state.people[(rand() * state.people.length) | 0];
      if (host && inside(host.x, host.z)) {
        state.ghosts.push({
          x: clamp(host.x + (rand() - 0.5) * 3, -29, 29), z: clamp(host.z + (rand() - 0.5) * 2, -5.5, 5.5),
          floor: host.floor, age: 0, ttl: 3 + rand() * 2, counted: false, detected: false
        });
      }
    }
    for (var i = state.ghosts.length - 1; i >= 0; i--) {
      state.ghosts[i].age += dt;
      if (state.ghosts[i].age >= state.ghosts[i].ttl) state.ghosts.splice(i, 1);
    }
    state.scanTimer -= dt;
    if (state.scanTimer <= 0) { state.scanTimer = 0.7; scan(state); }
    state.reportTimer -= dt;
    if (state.reportTimer <= 0) { state.reportTimer = 3; sendReport(state); }
    for (var j = state.packets.length - 1; j >= 0; j--) {
      var pk = state.packets[j]; pk.age += dt;
      if (pk.age >= pk.duration) { deliverSnapshot(state, pk.snapshot); state.packets.splice(j, 1); }
    }
    if (state.blackout) state.sniffers.forEach(function (s) { s.battery = Math.max(5, s.battery - dt * 0.35); });
    if (state.phase !== 's') state.dust = Math.max(0, state.dust - dt * 0.03);
    return state;
  }

  function liveMetrics(state) {
    var detected = 0, id;
    for (id in state.personReports) if (state.t - state.personReports[id].t <= 6) detected++;
    var insideN = 0, evacN = 0, trappedN = 0;
    state.people.forEach(function (p) {
      if (p.state === 'evacuated') evacN++;
      else if (p.state === 'trapped') trappedN++;
      else insideN++;
    });
    var st = state.stats;
    return {
      total: state.people.length, detected: detected, inside: insideN,
      evacuated: evacN, trapped: trappedN,
      precision: (st.tp + st.fp) ? (st.tp / (st.tp + st.fp) * 100) : 100,
      filtered: st.filtered, fp: st.fp
    };
  }
  function buildGatewayReport(state) {
    var g = state.gateway;
    var t0 = g.preQuake || g.lastSnapshot || makeSnapshot(state);
    var checked = Object.keys(g.checkedIn).length;
    var known = Object.keys(g.known).map(function (k) { return g.known[k]; });
    var insideKnown = known.filter(function (e) { return !g.checkedIn[e.id]; });
    var recent = insideKnown.filter(function (e) { return state.t - e.t <= 12; });
    var trappedKnown = insideKnown.filter(function (e) { return e.trappedHint; });
    var couldInside = Math.max(recent.length, Math.max(0, t0.count - checked));
    var unlocated = Math.max(0, couldInside - recent.length);
    var groups = {};
    insideKnown.forEach(function (e) {
      var k = 'Piso ' + (e.floor + 1) + ' · ' + e.zone;
      groups[k] = groups[k] || { label: k, floor: e.floor, count: 0, trapped: 0 };
      groups[k].count++; if (e.trappedHint) groups[k].trapped++;
    });
    var priority = Object.keys(groups).map(function (k) { return groups[k]; })
      .sort(function (a, b) { return (b.trapped - a.trapped) || (b.count - a.count); });
    var conf = 98;
    if (!g.lastSync) conf = 0;
    else {
      if (state.t - g.lastSync > 10) conf -= 20;
      if (mainSniffer(state).sniffer < 0.4 || !mainSniffer(state).online) conf -= 25;
      conf -= state.sniffers.filter(function (s) { return !s.online; }).length * 5;
      if (state.faults.macSat) conf -= 10;
      if (state.phase === 's') conf -= 15;
      conf = clamp(conf, 5, 99);
    }
    return {
      generatedAt: state.t, lastSync: g.lastSync, queued: g.queued,
      habia: t0.count, habiaByFloor: t0.byFloor,
      evacuados: checked, detectadosDentro: recent.length,
      podrianSeguirDentro: couldInside, noLocalizados: unlocated,
      atrapadosProbables: state.everQuake ? Math.min(couldInside, trappedKnown.length + unlocated) : 0,
      atrapadosLocalizados: trappedKnown.length,
      prioridad: priority, confianza: Math.round(conf),
      mag: state.profile ? state.profile.mag : null,
      snifferPrincipal: t0.mainSniffer, bateriaPrincipal: Math.round(mainSniffer(state).battery),
      sniffersActivos: state.sniffers.filter(function (s) { return s.online; }).length,
      sniffersTotal: state.sniffers.length
    };
  }
  function nearestTrapped(state, pos) {
    var best = null, bd = 1e9;
    state.people.forEach(function (p) {
      if (p.state !== 'trapped' || p.floor !== pos.floor) return;
      var d = Math.hypot(p.x - pos.x, p.z - pos.z);
      if (d < bd) { bd = d; best = p; }
    });
    return bd <= 2.8 ? best : null;
  }
  function rescuePerson(state, person) {
    if (!person || person.state !== 'trapped') return false;
    person.state = 'evacuating'; person.evacAt = state.t;
    if (!state.evac) state.evac = true;
    state.rescuedCount++;
    addEvent(state, 'npc', '¡Gracias! Estoy bien, voy hacia el punto de encuentro.');
    addEvent(state, 'info', 'Persona liberada en ' + zoneName(person.floor, person.x, person.z) + ' (Piso ' + (person.floor + 1) + ').');
    return true;
  }

  global.CyTSim = {
    FLOORS: FLOORS, FLOOR_H: FLOOR_H, MAIN: MAIN, WING: WING, STAIRS: STAIRS,
    ASSEMBLY: ASSEMBLY, GATEWAY_POS: GATEWAY_POS, ZONE_NAMES: ZONE_NAMES,
    clamp: clamp, inside: inside, zoneIdx: zoneIdx, zoneName: zoneName,
    magnitudeProfile: magnitudeProfile, createState: createState,
    mainSniffer: mainSniffer, makeSnapshot: makeSnapshot,
    triggerQuake: triggerQuake, activateVoiceAlert: activateVoiceAlert,
    setFault: setFault, applyScenario: applyScenario, step: step,
    liveMetrics: liveMetrics, buildGatewayReport: buildGatewayReport,
    nearestTrapped: nearestTrapped, rescuePerson: rescuePerson, addEvent: addEvent
  };
})(typeof window !== 'undefined' ? window : globalThis);
