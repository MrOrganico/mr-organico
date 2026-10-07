/* =========================================================
   Mr Organico — ذرات نورونی تعاملی سه‌بعدی (Three.js)
   شبکه ذرات درخشان متصل با خطوط نور (Plexus/Neural)
   رنگ‌ها: چندرنگ و روان (سفید، آبی، سبز، زرد، قرمز)
   نزدیک موس: رنگ می‌جرقه و روشن‌تر می‌شود + گریز ذرات + پارالاکس
   💡 استفاده: initHeroParticles(document.getElementById('heroParticles'))
   ========================================================= */

function initHeroParticles(canvas){
  if(!canvas || typeof THREE === 'undefined') return; // در نبود کتابخانه، بی‌صدا رد شو

  let renderer;
  try{
    renderer = new THREE.WebGLRenderer({ canvas, alpha:true, antialias:true, powerPreference:'high-performance' });
  }catch(e){ return; } // وب‌جی‌ال در دسترس نیست

  const isMobile = matchMedia('(max-width: 768px)').matches;
  const COUNT    = isMobile ? 420 : 850;   // گره‌های شبکه
  const RADIUS   = 15;
  const LINK_D   = 4.6;                    // فاصله اتصال نورونی
  const MAX_LINK = isMobile ? 900 : 2100;  // سقف خطوط (کارایی)

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, .1, 100);
  camera.position.set(0, 0, 19);

  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  /* ---------- ساخت گره‌ها ---------- */
  const positions = new Float32Array(COUNT * 3);
  const base      = new Float32Array(COUNT * 3);
  const colors    = new Float32Array(COUNT * 3);
  const sizes     = new Float32Array(COUNT);
  const phases    = new Float32Array(COUNT);

  /* پارامترهای رنگ هر ذره — چندرنگ و روان */
  const hue   = new Float32Array(COUNT);   // رنگ پایه (۰ تا ۱)
  const sat   = new Float32Array(COUNT);   // اشباع (۰ = سفید یخی)
  const light = new Float32Array(COUNT);   // روشنایی پایه
  const drift = new Float32Array(COUNT);   // سرعت چرخش رنگ در زمان

  const BASE_HUES = [0.00, 0.13, 0.38, 0.52, 0.58]; // قرمز، زرد، سبز، فیروزه‌ای، آبی

  for(let i = 0; i < COUNT; i++){
    const r     = Math.pow(Math.random(), .6) * RADIUS;
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta) * .74;
    const z = r * Math.cos(phi) * .8;
    positions.set([x, y, z], i * 3);
    base.set([x, y, z], i * 3);

    if(Math.random() < .28){          /* اقلیت: سفیدهای یخی بدون اشباع */
      sat[i] = 0;
      hue[i] = .55;
    } else {
      sat[i] = .68 + Math.random() * .3;
      hue[i] = BASE_HUES[(Math.random() * BASE_HUES.length) | 0] + (Math.random() - .5) * .05;
    }
    light[i] = .68 + Math.random() * .22;
    drift[i] = (.012 + Math.random() * .045) * (Math.random() < .5 ? -1 : 1);

    sizes[i]  = (i % 23 === 0 ? 3.4 : 0) + 1.1 + Math.random() * 1.9; // هر ۲۳ گره یه نور درشت‌تر
    phases[i] = Math.random() * Math.PI * 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aPhase',   new THREE.BufferAttribute(phases, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime:{ value:0 }, uPixel:{ value: Math.min(devicePixelRatio,2) } },
    vertexShader: `
      attribute float aSize;
      attribute float aPhase;
      varying vec3 vColor;
      varying float vTwinkle;
      uniform float uTime;
      uniform float uPixel;
      void main(){
        vColor = color;
        vTwinkle = 0.62 + 0.38 * sin(uTime * 1.6 + aPhase);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixel * vTwinkle * (95.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vColor;
      varying float vTwinkle;
      void main(){
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        float glow = pow(smoothstep(0.5, 0.0, d), 2.2);
        float core = smoothstep(0.16, 0.0, d) * 0.9;
        float a = (glow * 0.55 + core) * vTwinkle;
        gl_FragColor = vec4(vColor, a);
      }`,
    vertexColors: true,
  });

  const points = new THREE.Points(geo, mat);
  scene.add(points);

  /* ---------- اتصالات نورونی (Plexus) — با رنگ گرادیانی از گره‌ها ---------- */
  const pairs = [];
  outer:
  for(let i = 0; i < COUNT; i++){
    for(let j = i + 1; j < COUNT; j++){
      const dx = base[i*3]   - base[j*3];
      const dy = base[i*3+1] - base[j*3+1];
      const dz = base[i*3+2] - base[j*3+2];
      if(dx*dx + dy*dy + dz*dz < LINK_D * LINK_D){
        pairs.push(i, j);
        if(pairs.length >= MAX_LINK * 2) break outer;
      }
    }
  }
  const linePos = new Float32Array(pairs.length * 3);
  const lineCol = new Float32Array(pairs.length * 3);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  lineGeo.setAttribute('color',    new THREE.BufferAttribute(lineCol, 3));
  const lineMat = new THREE.LineBasicMaterial({
    vertexColors: true, transparent:true, opacity:.2,
    blending: THREE.AdditiveBlending, depthWrite:false,
  });
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  scene.add(lines);

  /* ---------- موس و لمس ---------- */
  const mouse = { x:0, y:0, tx:0, ty:0, active:false };
  function setFromEvent(cx, cy){
    const rect = canvas.getBoundingClientRect();
    mouse.tx = ((cx - rect.left) / rect.width) * 2 - 1;
    mouse.ty = -((cy - rect.top) / rect.height) * 2 + 1;
    mouse.active = true;
  }
  const onMove  = e => setFromEvent(e.clientX, e.clientY);
  const onTouch = e => { if(e.touches[0]) setFromEvent(e.touches[0].clientX, e.touches[0].clientY); };
  const onLeave = () => { mouse.active = false; };
  window.addEventListener('pointermove', onMove, { passive:true });
  window.addEventListener('touchmove', onTouch, { passive:true });
  document.addEventListener('mouseleave', onLeave);

  /* ---------- تغییر اندازه ---------- */
  function resize(){
    const w = canvas.clientWidth  || canvas.parentElement.clientWidth;
    const h = canvas.clientHeight || canvas.parentElement.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  /* فقط وقتی دیده می‌شود رندر کن */
  let visible = true;
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold:0 });
  io.observe(canvas);

  /* ---------- حلقه انیمیشن ---------- */
  const posAttr  = geo.getAttribute('position');
  const lineAttr = lineGeo.getAttribute('position');
  const lineColAttr = lineGeo.getAttribute('color');
  const projV = new THREE.Vector3();
  const tmpC  = new THREE.Color();
  const REACH = 3.6, PUSH = 2.8;

  function tick(t){
    requestAnimationFrame(tick);
    if(!visible) return;
    const time = t * 0.001;

    mouse.x += (mouse.tx - mouse.x) * .06;
    mouse.y += (mouse.ty - mouse.y) * .06;
    mat.uniforms.uTime.value = time;

    points.rotation.y = time * .03;
    points.rotation.x = Math.sin(time * .12) * .05;

    const arr = posAttr.array;
    const hasMouse = mouse.active, mx = mouse.x, my = mouse.y;

    for(let i = 0; i < COUNT; i++){
      const ix = i * 3;
      const bx = base[ix], by = base[ix+1], bz = base[ix+2];
      let nx = bx + Math.sin(time * .5 + phases[i]) * .2;
      let ny = by + Math.cos(time * .42 + phases[i] * 1.3) * .17;
      let nz = bz;

      /* رنگ روان: چرخش آرام رنگ در زمان + جرقه رنگی نزدیک موس */
      let shift = 0, boost = 0;
      if(hasMouse){
        projV.set(nx, ny, nz).project(camera);
        const dx = projV.x - mx, dy = projV.y - my;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if(dist < REACH && dist > 0.0001){
          const f = 1 - dist / REACH;
          nx += (dx / dist) * f * PUSH;   /* گریز از موس */
          ny += (dy / dist) * f * PUSH;
          shift = f * .3;                  /* پرش رنگی کنار موس */
          boost = f * .3;                  /* روشن‌تر شدن */
        }
      }
      let h = (hue[i] + time * drift[i] + shift) % 1;
      if(h < 0) h += 1;
      tmpC.setHSL(h, sat[i], Math.min(1, light[i] + boost));
      colors[ix] = tmpC.r; colors[ix+1] = tmpC.g; colors[ix+2] = tmpC.b;

      arr[ix] = nx; arr[ix+1] = ny; arr[ix+2] = nz;
    }
    posAttr.needsUpdate = true;
    geo.getAttribute('color').needsUpdate = true;

    /* هم‌گام‌سازی خطوط و رنگ‌شان با گره‌ها */
    const la = lineAttr.array, lc = lineCol.array;
    for(let k = 0; k < pairs.length; k++){
      const pi = pairs[k] * 3;
      la[k*3]   = arr[pi];
      la[k*3+1] = arr[pi+1];
      la[k*3+2] = arr[pi+2];
      lc[k*3]   = colors[pi];
      lc[k*3+1] = colors[pi+1];
      lc[k*3+2] = colors[pi+2];
    }
    lineAttr.needsUpdate = true;
    lineColAttr.needsUpdate = true;

    /* پارالاکس دوربین */
    camera.position.x += (mx * 2.4 - camera.position.x) * .04;
    camera.position.y += (my * 1.6 - camera.position.y) * .04;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }
  requestAnimationFrame(tick);

  window.addEventListener('pagehide', () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('touchmove', onTouch);
    io.disconnect();
    geo.dispose(); mat.dispose(); lineGeo.dispose(); lineMat.dispose(); renderer.dispose();
  }, { once:true });
}
