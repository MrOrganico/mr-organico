/* =========================================================
   Mr Organico — دروازه امنیتی پنل مدیریت (admin-auth.js)
   ---------------------------------------------------------
   • رمز عبور هرگز به‌صورت متن ساده ذخیره نمی‌شود.
   • فقط هش PBKDF2-HMAC-SHA256 (۱۵۰,۰۰۰ تکرار) + salt نگه‌داری می‌شود.
   • قفل زمانی: پس از ۵ تلاش ناموفق، ورود موقتاً غیرفعال می‌شود.
   • نشست ورود: ۴ ساعت معتبر است و با بستن تب تمام می‌شود.
   • تعویض رمز: از داخل خود پنل (نیاز به رمز فعلی).

   💡 تغییر رمز پیش‌فرض:
      ۱) وارد پنل شوید، ۲) دکمه «تغییر رمز عبور»، ۳) رمز جدید را وارد کنید.
      (هش رمز جدید در localStorage مرورگر شما ذخیره می‌شود)
   ========================================================= */

const AdminAuth = (function(){

  /* ---------- رکورد پیش‌فرض (رمز اولیه) ---------- */
  const DEFAULT_AUTH = {
    v:     1,
    iter:  150000,
    salt:  'fd78b01279f129d8e4279b3bc4dba1fe',
    hash:  '2673a159f03037119015c3169450f0be65adafd49ec197b74520c2367acb1b2c',
    at:    0
  };

  const AUTH_KEY  = 'mo_admin_auth';   // localStorage — رمز تعویض‌شده توسط مدیر
  const LOCK_KEY  = 'mo_admin_lock';   // localStorage — شمارنده تلاش ناموفق
  const SESS_KEY  = 'mo_admin_sess';   // sessionStorage — انقضای نشست
  const SESS_TTL  = 4 * 60 * 60 * 1000; // ۴ ساعت
  const MAX_FAIL  = 5;                 // تلاش مجاز پشت‌سرهم
  const BASE_LOCK = 60 * 1000;         // ۱ دقیقه قفل اولیه

  /* ---------- ابزارهای کوچک ---------- */
  const hexToBytes = h => {
    const a = new Uint8Array(h.length / 2);
    for(let i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16);
    return a;
  };
  const bytesToHex = b => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');

  function utf8(str){
    if(typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    const out = [];
    for(let i = 0; i < str.length; i++){
      let c = str.charCodeAt(i);
      if(c < 0x80) out.push(c);
      else if(c < 0x800){ out.push(0xc0 | (c >> 6), 0x80 | (c & 63)); }
      else if(c >= 0xd800 && c < 0xdc00){
        const c2 = str.charCodeAt(++i);
        const u = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff);
        out.push(0xf0 | (u >> 18), 0x80 | ((u >> 12) & 63), 0x80 | ((u >> 6) & 63), 0x80 | (u & 63));
      } else { out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); }
    }
    return new Uint8Array(out);
  }

  /* ---------- SHA-256 خالص (برای محیط‌های بدون crypto.subtle مثل file://) ---------- */
  const K = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ];
  const rr = (x, n) => (x >>> n) | (x << (32 - n));

  function sha256(msg){
    const bitLen = msg.length * 8;
    const total  = Math.ceil((msg.length + 9) / 64) * 64;
    const buf    = new Uint8Array(total);
    buf.set(msg); buf[msg.length] = 0x80;
    const dv = new DataView(buf.buffer);
    dv.setUint32(total - 8, Math.floor(bitLen / 4294967296));
    dv.setUint32(total - 4, bitLen >>> 0);

    const h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const w = new Int32Array(64);

    for(let off = 0; off < total; off += 64){
      for(let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
      for(let i = 16; i < 64; i++){
        const s0 = rr(w[i-15], 7) ^ rr(w[i-15], 18) ^ (w[i-15] >>> 3);
        const s1 = rr(w[i-2], 17) ^ rr(w[i-2], 19) ^ (w[i-2] >>> 10);
        w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0;
      }
      let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for(let i = 0; i < 64; i++){
        const S1   = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25);
        const ch   = (e & f) ^ (~e & g);
        const t1   = (hh + S1 + ch + K[i] + w[i]) | 0;
        const S0   = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22);
        const maj  = (a & b) ^ (a & c) ^ (b & c);
        const t2   = (S0 + maj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0;
        d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h[0]=(h[0]+a)|0; h[1]=(h[1]+b)|0; h[2]=(h[2]+c)|0; h[3]=(h[3]+d)|0;
      h[4]=(h[4]+e)|0; h[5]=(h[5]+f)|0; h[6]=(h[6]+g)|0; h[7]=(h[7]+hh)|0;
    }
    const out = new Uint8Array(32);
    const odv = new DataView(out.buffer);
    for(let i = 0; i < 8; i++) odv.setUint32(i * 4, h[i] >>> 0);
    return out;
  }

  const cat = (a, b) => { const o = new Uint8Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; };

  function hmacSha256(key, msg){
    let k = key;
    if(k.length > 64) k = sha256(k);
    const ipad = new Uint8Array(64), opad = new Uint8Array(64);
    for(let i = 0; i < 64; i++){
      const v = i < k.length ? k[i] : 0;
      ipad[i] = v ^ 0x36; opad[i] = v ^ 0x5c;
    }
    return sha256(cat(opad, sha256(cat(ipad, msg))));
  }

  function pbkdf2Js(pw, salt, iter, dkLen){
    const hLen = 32, blocks = Math.ceil(dkLen / hLen);
    const out = new Uint8Array(blocks * hLen);
    for(let b = 1; b <= blocks; b++){
      const idx = new Uint8Array([(b >>> 24) & 255, (b >>> 16) & 255, (b >>> 8) & 255, b & 255]);
      let u = hmacSha256(pw, cat(salt, idx));
      const t = Uint8Array.from(u);
      for(let i = 1; i < iter; i++){
        u = hmacSha256(pw, u);
        for(let j = 0; j < hLen; j++) t[j] ^= u[j];
      }
      out.set(t, (b - 1) * hLen);
    }
    return out.slice(0, dkLen);
  }

  /* ---------- محاسبه هش (سخت‌افزاری در صورت امکان) ---------- */
  function derive(password, saltHex, iter){
    const pwBytes = utf8(password), saltBytes = hexToBytes(saltHex);
    const subtle = (typeof crypto !== 'undefined') && crypto.subtle;
    if(subtle && subtle.importKey && subtle.deriveBits){
      return subtle.importKey('raw', pwBytes, 'PBKDF2', false, ['deriveBits'])
        .then(k => subtle.deriveBits({ name:'PBKDF2', salt:saltBytes, iterations:iter, hash:'SHA-256' }, k, 256))
        .then(bits => bytesToHex(new Uint8Array(bits)))
        .catch(() => bytesToHex(pbkdf2Js(pwBytes, saltBytes, iter, 32)));
    }
    /* محیط بدون crypto.subtle — اجرای همزمان در پس‌زمینه تا رابط کاربری قفل نشود */
    return new Promise(res => setTimeout(() => res(bytesToHex(pbkdf2Js(pwBytes, saltBytes, iter, 32))), 30));
  }

  /* مقایسه کم‌زمانی (جلوگیری از حدس مرحله‌ای) */
  function safeEqual(a, b){
    if(a.length !== b.length) return false;
    let diff = 0;
    for(let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  /* ---------- رکورد فعال ---------- */
  const record = () => {
    try{
      const saved = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
      if(saved && saved.hash && saved.salt) return saved;
    }catch(e){}
    return DEFAULT_AUTH;
  };

  /* ---------- قفل زمانی ---------- */
  const readLock = () => { try{ return JSON.parse(localStorage.getItem(LOCK_KEY) || 'null') || { fails:0, until:0 }; }catch(e){ return { fails:0, until:0 }; } };
  const writeLock = o => { try{ localStorage.setItem(LOCK_KEY, JSON.stringify(o)); }catch(e){} };

  function remainingLock(){
    const l = readLock();
    return Math.max(0, l.until - Date.now());
  }

  function registerFail(){
    const l = readLock();
    l.fails = (l.fails || 0) + 1;
    if(l.fails >= MAX_FAIL){
      const over = l.fails - MAX_FAIL;
      const wait = Math.min(BASE_LOCK * Math.pow(2, over), 15 * 60 * 1000);
      l.until = Date.now() + wait;
      l.fails = 0;                      // شمارش بعد از رفع قفل از نو
      writeLock(l);
      return wait;
    }
    writeLock(l);
    return 0;
  }

  function clearLock(){ writeLock({ fails:0, until:0 }); }

  /* ---------- نشست ---------- */
  function isUnlocked(){
    try{
      const exp = +(sessionStorage.getItem(SESS_KEY) || 0);
      return exp > Date.now();
    }catch(e){ return false; }
  }
  function startSession(){
    try{ sessionStorage.setItem(SESS_KEY, String(Date.now() + SESS_TTL)); }catch(e){}
  }
  function endSession(){
    try{ sessionStorage.removeItem(SESS_KEY); }catch(e){}
  }

  /* ---------- API ---------- */
  function verify(password){
    const rec = record();
    return derive(password, rec.salt, rec.iter).then(h => safeEqual(h, rec.hash));
  }

  function unlock(password){
    const wait = remainingLock();
    if(wait > 0) return Promise.resolve({ ok:false, wait });
    return verify(password).then(ok => {
      if(ok){ clearLock(); startSession(); return { ok:true, wait:0 }; }
      const newWait = registerFail();
      return { ok:false, wait:newWait, left: readLock() };
    });
  }

  function changePassword(oldPw, newPw){
    if(!newPw || newPw.length < 8) return Promise.resolve({ ok:false, msg:'رمز جدید باید حداقل ۸ کاراکتر باشد.' });
    if(newPw === oldPw)             return Promise.resolve({ ok:false, msg:'رمز جدید باید با رمز فعلی متفاوت باشد.' });
    return verify(oldPw).then(cur => {
      if(!cur) return { ok:false, msg:'رمز فعلی نادرست است.' };
      const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
      return derive(newPw, salt, DEFAULT_AUTH.iter).then(h => {
        try{
          localStorage.setItem(AUTH_KEY, JSON.stringify({ v:1, iter:DEFAULT_AUTH.iter, salt, hash:h, at:Date.now() }));
        }catch(e){ return { ok:false, msg:'ذخیره‌سازی در مرورگر ممکن نشد.' }; }
        return { ok:true, msg:'رمز عبور با موفقیت تغییر کرد ✅' };
      });
    });
  }

  function resetPassword(){
    try{ localStorage.removeItem(AUTH_KEY); clearLock(); }catch(e){}
  }

  return {
    unlock, verify, changePassword, resetPassword,
    isUnlocked, startSession, endSession,
    remainingLock, MAX_FAIL,
    /* برای استفاده احتمالی آینده */
    meta: () => { const r = record(); return { iter:r.iter, isCustom: !!r.at }; }
  };
})();
