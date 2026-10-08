/* =========================================================
   Mr Organico — منطق مشترک
   هدر/فوتر، سبد خرید (localStorage)، تصاویر جایگزین، ابزارها
   ========================================================= */

/* ---------- ادغام تغییرات مدیر محصولات (از پنل admin) ----------
   تغییرات در localStorage ذخیره و روی PRODUCTS اعمال می‌شود.
   رکورد با deleted:true یعنی حذف‌شده از نمایش. */
(function applyAdminOverrides(){
  try{
    const ov = JSON.parse(localStorage.getItem('mo_products') || '[]');
    ov.forEach(o => {
      if(!o || !o.id) return;
      const i = PRODUCTS.findIndex(p => p.id === o.id);
      if(o.deleted){
        if(i > -1) PRODUCTS.splice(i, 1);
      } else if(i > -1){
        PRODUCTS[i] = Object.assign({}, PRODUCTS[i], o);
      } else {
        PRODUCTS.push(o);
      }
    });
  }catch(e){ /* داده خراب — نادیده بگیر */ }
})();

/* ---------- ابزارها ---------- */
const PRICE_FMT = n => n > 0 ? n.toLocaleString('fa-IR') : '—';
const fmtPrice = n => PRICE_FMT(n) + ' تومان';

function toast(msg){
  let t = document.querySelector('.toast');
  if(!t){ t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------- تصویر جایگزین اختصاصی (SVG درون‌خطی) ---------- */
const PH_ICONS = {
  leaf:  '<path d="M50 88C30 74 16 56 20 34 42 30 66 40 76 58c6 11 4 22-4 30-6 6-14 8-22 0z" fill="none" stroke="#4fb3d9" stroke-width="3"/><path d="M50 88C42 66 34 48 24 36" stroke="#7fd0e8" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
  pipe:  '<path d="M22 40c0-7 6-12 13-12s13 5 13 12v4c0 4 4 7 8 7h26c8 0 14 6 14 14 0 12-10 22-24 22H54c-16 0-26-11-26-26v-9z" fill="none" stroke="#4fb3d9" stroke-width="3"/><circle cx="35" cy="40" r="6" stroke="#7fd0e8" stroke-width="2.4" fill="none"/>',
  filter:'<rect x="34" y="24" width="32" height="54" rx="10" fill="none" stroke="#4fb3d9" stroke-width="3"/><path d="M42 38h16M42 52h16M42 66h16" stroke="#7fd0e8" stroke-width="2.6" stroke-linecap="round"/>',
  roller:'<rect x="26" y="34" width="48" height="30" rx="8" fill="none" stroke="#4fb3d9" stroke-width="3"/><circle cx="40" cy="49" r="6" stroke="#7fd0e8" stroke-width="2.4" fill="none"/><circle cx="60" cy="49" r="6" stroke="#7fd0e8" stroke-width="2.4" fill="none"/>',
  case:  '<rect x="24" y="30" width="52" height="40" rx="8" fill="none" stroke="#4fb3d9" stroke-width="3"/><path d="M32 30v40M50 30v40M68 30v40" stroke="#7fd0e8" stroke-width="2" opacity=".7"/>',
  smoke: '<path d="M36 78c0-10 6-12 6-22s-8-10-8-20c0-8 6-10 6-18M54 78c0-10 6-12 6-22s-8-10-8-20c0-8 6-10 6-18M72 78c0-10 6-12 6-22s-8-10-8-20c0-8 6-10 6-18" fill="none" stroke="#7fd0e8" stroke-width="2.6" stroke-linecap="round"/>',
};

function placeholderSVG(cat, icon){
  const key = icon || (CATEGORIES[cat] && CATEGORIES[cat].icon) || 'leaf';
  return `
  <div class="ph">
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${PH_ICONS[key] || PH_ICONS.leaf}</svg>
  </div>`;
}

function productThumb(p){
  if(p.img) return `<div class="p-thumb" style="background:#0d2230"><img src="${p.img}" alt="${p.name}" loading="lazy" style="width:100%;height:100%;object-fit:cover"></div>`;
  return `<div class="p-thumb">${placeholderSVG(p.cat, p.icon)}</div>`;
}

/* ---------- سبد خرید ---------- */
const Cart = {
  read(){ try{ return JSON.parse(localStorage.getItem('mo_cart') || '[]'); }catch{ return []; } },
  write(items){ localStorage.setItem('mo_cart', JSON.stringify(items)); Cart.badge(); },
  add(id, qty = 1, w = null){
    const p = PRODUCTS.find(x => x.id === id);
    if(!p) return;
    if(!priceFor(p, w)){ toast('برای قیمت و سفارش این محصول با ما تماس بگیرید 📞 ' + PHONE); return; }
    if(p.stock === false){ toast('این محصول فعلاً ناموجود است'); return; }
    const wk = w || (p.kiloPrice ? 100 : null);
    const items = Cart.read();
    const row = items.find(x => x.id === id && (x.w || null) === (wk || null));
    if(row) row.qty += qty; else items.push({ id, qty, w: wk });
    Cart.write(items);
    toast(`«${p.name}»${wk ? ' — ' + W_LABEL[wk] : ''} به سبد اضافه شد ✅`);
  },
  setQtyAt(i, qty){ const items = Cart.read(); if(items[i]){ items[i].qty = Math.max(1, Math.min(99, qty)); Cart.write(items); } },
  removeAt(i){ const items = Cart.read(); items.splice(i, 1); Cart.write(items); },
  setQty(id, qty){
    let items = Cart.read();
    qty = Math.max(1, Math.min(99, qty));
    const row = items.find(x => x.id === id);
    if(row){ row.qty = qty; Cart.write(items); }
  },
  remove(id){ Cart.write(Cart.read().filter(x => x.id !== id)); },
  clear(){ Cart.write([]); },
  count(){ return Cart.read().reduce((s, x) => s + x.qty, 0); },
  total(){ return Cart.read().reduce((s, x) => {
      const p = PRODUCTS.find(y => y.id === x.id);
      return s + (p ? priceFor(p, x.w || (p.kiloPrice ? 100 : null)) * x.qty : 0);
    }, 0); },
  badge(){
    const el = document.getElementById('cartCount');
    if(el) el.textContent = Cart.count().toLocaleString('fa-IR');
  },
};

/* علاقه‌مندی‌ها */
const Fav = {
  read(){ try{ return JSON.parse(localStorage.getItem('mo_fav') || '[]'); }catch{ return []; } },
  toggle(id){
    let f = Fav.read();
    const i = f.indexOf(id);
    if(i > -1){ f.splice(i, 1); toast('از علاقه‌مندی‌ها حذف شد'); }
    else{ f.push(id); toast('به علاقه‌مندی‌ها اضافه شد ❤️'); }
    localStorage.setItem('mo_fav', JSON.stringify(f));
    return i === -1;
  },
  has(id){ return Fav.read().includes(id); },
};

/* ---------- آیکون‌ها ---------- */
const I = {
  cart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  heart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5 0 0 0 0-7.8z"/></svg>',
  menu:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
  phone:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c1 .3 2 .6 3 .7a2 2 0 0 1 1.6 2z"/></svg>',
  truck:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
  shield:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4" stroke-linecap="round"/></svg>',
  headset:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>',
  leaf:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z"/><path d="M2 21c0-3 1.9-5.5 4.5-6.6C9.3 13 11 12 13 10"/></svg>',
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
  mail:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 6L2 7"/></svg>',
  pin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  globe:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/></svg>',
  trash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
  filter:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="7" y="3" width="10" height="18" rx="4"/><path d="M9.5 8h5M9.5 12h5M9.5 16h5"/></svg>',
  pipe:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8c0-2 1.6-3.4 3.5-3.4S12 6 12 8v1.2c0 1.1.9 2 2 2h3.5A3.5 3.5 0 0 1 21 14.7 5.3 5.3 0 0 1 15.7 20h-3.2A6.5 6.5 0 0 1 6 13.5V8z"/><circle cx="6.8" cy="7.6" r="1.4"/></svg>',
};

/* ---------- رندر هدر و فوتر ---------- */
const PHONE = '09109204131';
const PHONE_INTL = '+989109204131';
const WA_LINK = `https://wa.me/${PHONE_INTL.replace('+','')}`;

function renderHeader(active){
  const links = [
    ['index.html', 'خانه'],
    ['products.html', 'محصولات'],
    ['blog.html', 'مجله'],
    ['about.html', 'درباره ما'],
    ['contact.html', 'تماس با ما'],
  ];
  document.getElementById('siteHeader').innerHTML = `
    <div class="topbar">🌿 ارسال رایگان برای سفارش‌های بالای <b>۵ میلیون تومان</b> — مشاوره تخصصی: <b>${PHONE}</b></div>
    <header class="site">
      <div class="container nav">
        <a class="logo" href="index.html">
          <span class="logo-mark">
            <img src="images/logo-96.webp" alt="آرم Mr Organico">
          </span>
          <span class="logo-text"><strong>Mr Organico</strong><span>ارگانیک • اصیل • خالص</span></span>
        </a>
        <nav class="nav-links" id="navLinks">
          ${links.map(([href, label]) =>
            `<a href="${href}" class="${active === href ? 'active' : ''}">${label}</a>`).join('')}
        </nav>
        <div class="nav-actions">
          <a class="icon-btn" href="cart.html" aria-label="سبد خرید">
            ${I.cart}<span class="cart-count" id="cartCount">۰</span>
          </a>
          <button class="icon-btn menu-toggle" id="menuToggle" aria-label="منو">${I.menu}</button>
        </div>
      </div>
    </header>`;
  const t = document.getElementById('menuToggle');
  if(t) t.onclick = () => document.getElementById('navLinks').classList.toggle('open');
  Cart.badge();
  initScrollProgress();
}

/* ---------- نوار پیشرفت اسکرول ---------- */
function initScrollProgress(){
  let bar = document.getElementById('scrollBar');
  if(!bar){ bar = document.createElement('div'); bar.id = 'scrollBar'; document.body.appendChild(bar); }
  const update = () => {
    const h = document.documentElement;
    const max = h.scrollHeight - h.clientHeight;
    bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
  };
  window.addEventListener('scroll', update, { passive:true });
  window.addEventListener('resize', update);
  update();
}

function renderFooter(){
  document.getElementById('siteFooter').innerHTML = `
    <footer class="site">
      <div class="container">
        <div class="footer-grid">
          <div class="footer-about">
            <a class="logo" href="index.html">
              <span class="logo-mark"><img src="images/logo-96.webp" alt="آرم Mr Organico"></span>
              <span class="logo-text"><strong>Mr Organico</strong><span>ارگانیک • اصیل • خالص</span></span>
            </a>
            <p>مرجع تخصصی توتون ارگانیک، برگ طبیعی و پیپ دست‌ساز — بدون هیچ افزودنی و ماده شیمیایی. از مزرعه تا بسته‌بندی، تحت نظارت کامل.</p>
            <div style="display:flex;gap:10px">
              <a class="btn btn-green" style="padding:9px 18px;font-size:.85rem" href="${WA_LINK}" target="_blank">واتساپ</a>
              <a class="btn btn-ghost" style="padding:9px 18px;font-size:.85rem" href="tel:${PHONE_INTL}">${PHONE}</a>
            </div>
          </div>
          <div>
            <h4>دسترسی سریع</h4>
            <ul>
              <li><a href="index.html">صفحه اصلی</a></li>
              <li><a href="products.html">محصولات</a></li>
              <li><a href="blog.html">مجله تخصصی</a></li>
              <li><a href="about.html">درباره ما</a></li>
              <li><a href="cart.html">سبد خرید</a></li>
            </ul>
          </div>
          <div>
            <h4>اعتماد و شفافیت</h4>
            <ul>
              <li><a href="faq.html">سوالات متداول</a></li>
              <li><a href="terms.html">قوانین و مقررات</a></li>
              <li><a href="returns.html">رویه بازگشت کالا</a></li>
              <li><a href="privacy.html">حریم خصوصی</a></li>
              <li><a href="admin.html">ثبت و مدیریت محصولات</a></li>
            </ul>
          </div>
          <div>
            <h4>دسته محصولات</h4>
            <ul>
              <li><a href="products.html?cat=tobacco">توتون و برگ ارگانیک</a></li>
              <li><a href="products.html?cat=tube">پوکه و فیلتر</a></li>
              <li><a href="products.html?cat=accessory">پیپ و ادوات</a></li>
              <li><a href="about.html#export">صادرات و همکاری بین‌المللی</a></li>
            </ul>
          </div>
          <div>
            <h4>ارتباط با ما</h4>
            <ul class="footer-contact">
              <li>${I.phone}<a href="tel:${PHONE_INTL}">${PHONE}</a></li>
              <li>${I.mail}<a href="mailto:info@mrorganico.com">info@mrorganico.com</a></li>
              <li>${I.globe}صادرات به منطقه و بازار جهانی</li>
              <li>${I.headset}پشتیبانی همه‌روزه ۹ تا ۲۱</li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">
          © تمام حقوق مادی و معنوی این وب‌سایت متعلق به برند <b>Mr Organico</b> است — مالک: مهرشاد آزادی
        </div>
      </div>
    </footer>`;
}

/* ---------- هشدار سن ---------- */
function ageGate(){
  if(localStorage.getItem('mo_age_ok')) return;
  const el = document.createElement('div');
  el.className = 'age-overlay';
  el.innerHTML = `
    <div class="age-box">
      <div class="a-icon">🔞</div>
      <h2>ورود برای افراد بالای ۱۸ سال</h2>
      <p>محتوای این وب‌سایت صرفاً برای بزرگسالان است. با تأیید، اعلام می‌کنید که ۱۸ سال یا بیشتر دارید.</p>
      <div class="age-actions">
        <button class="btn btn-gold" id="ageYes">بله، ۱۸ سال دارم</button>
        <a class="btn btn-ghost" href="https://www.google.com">ترک صفحه</a>
      </div>
    </div>`;
  document.body.appendChild(el);
  el.querySelector('#ageYes').onclick = () => {
    localStorage.setItem('mo_age_ok', '1');
    el.classList.add('hidden');
  };
}

/* ---------- انیمیشن اسکرول ---------- */
function initReveal(){
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold:.12 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
}
