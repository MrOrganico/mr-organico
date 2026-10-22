/* =========================================================
   Mr Organico — منطق فروشگاه (کاتالوگ / محصول / سبد)
   ========================================================= */

const qs = new URLSearchParams(location.search);

/* ---------- سیستم وزن و قیمت توتون‌های فله ---------- */
const W_OPTIONS = [50, 100, 200, 300, 500, 1000];
const W_LABEL = { 50:'۵۰ گرم', 100:'۱۰۰ گرم', 200:'۲۰۰ گرم', 300:'۳۰۰ گرم', 500:'نیم‌کیلو', 1000:'۱ کیلو' };

/* قیمت هر وزن: اولویت با قیمت دستی PDF، سپس فرمول‌ها.
   قیمت کیلویی: از kiloPrice یا (برای توتون‌های بسته‌ای قدیمی) قیمت × ۱۰ استخراج می‌شود
   فرمول ۵۰ گرمی: قیمت کیلویی تقسیم بر ۲۰ × ۱.۲ (خرده‌فروشی ۲۰٪ بیشتر) */
function kiloOf(p){
  return p.kiloPrice || (p.cat === 'tobacco' && p.price ? p.price * 10 : 0);
}
function priceFor(p, w){
  const kilo = kiloOf(p);
  if(kilo){
    const g = w || 100;
    if(p.prices && p.prices[g] != null) return p.prices[g];
    if(g === 1000) return kilo;
    if(g === 500)  return Math.round(kilo / 2000) * 1000;
    let v = kilo * g / 1000;
    if(g === 50) v *= 1.2;
    return Math.round(v / 1000) * 1000;
  }
  return p.price || 0;
}
const hasWeights = p => !!kiloOf(p);
const minWeightPrice = p => Math.min(...W_OPTIONS.map(g => priceFor(p, g)));

/* ---------- کارت محصول ---------- */
function productCard(p, i = 0){
  const off = p.oldPrice && p.price > 0 ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
  const oos = p.stock === false;
  const noPrice = !p.price && !p.kiloPrice && !oos;   /* تماس برای قیمت */
  const fav = Fav.has(p.id);
  return `
  <article class="p-card reveal" style="transition-delay:${(i % 4) * 70}ms">
    <div class="p-thumb-wrap" style="position:relative">
      ${productThumb(p)}
      <div class="p-badges">
        ${p.badge ? `<span class="badge">${p.badge}</span>` : ''}
        ${off ? `<span class="badge off">${off.toLocaleString('fa-IR')}٪ تخفیف</span>` : ''}
        ${p.cat === 'tobacco' ? '<span class="badge organic">ارگانیک ۱۰۰٪</span>' : ''}
      </div>
      <button class="fav-btn ${fav ? 'on' : ''}" data-fav="${p.id}" aria-label="علاقه‌مندی">${I.heart}</button>
    </div>
    <div class="p-body">
      <span class="p-cat">${CATEGORIES[p.cat].name}</span>
      <a class="p-name" href="product.html?id=${p.id}">${p.name}</a>
      <div class="p-foot">
        <div class="p-price">
          ${oos
            ? '<span class="oos">ناموجود</span>'
            : noPrice
              ? '<span class="oos" style="color:var(--gold-2)">تماس برای قیمت</span>'
              : hasWeights(p)
                ? `<b>از ${PRICE_FMT(minWeightPrice(p))}</b><span class="unit">تومان</span>`
                : `<b>${PRICE_FMT(p.price)}</b><span class="unit">تومان ${p.unit || ''}</span>`}
          ${p.oldPrice && !oos && !noPrice && !hasWeights(p) ? `<s>${PRICE_FMT(p.oldPrice)}</s>` : ''}
        </div>
        <button class="add-btn" data-add="${p.id}" ${(oos || noPrice) ? 'disabled' : ''} aria-label="افزودن به سبد">
          ${(oos || noPrice) ? '📞' : I.plus}
        </button>
      </div>
    </div>
  </article>`;
}

/* اتصال رویدادهای کلی کارت‌ها */
function bindCards(root = document){
  root.querySelectorAll('[data-add]').forEach(b =>
    b.onclick = () => Cart.add(b.dataset.add));
  root.querySelectorAll('[data-fav]').forEach(b =>
    b.onclick = () => {
      const on = Fav.toggle(b.dataset.fav);
      b.classList.toggle('on', on);
    });
}

/* ---------- صفحه کاتالوگ ---------- */
function initShop(){
  const grid = document.getElementById('shopGrid');
  const found = document.getElementById('foundCount');
  let state = {
    cat: qs.get('cat') || 'all',
    q: '',
    sort: 'default',
  };

  /* فعال‌سازی چیپ دسته از URL */
  const chip = document.querySelector(`input[name="fcat"][value="${state.cat}"]`);
  if(chip) chip.checked = true;

  function apply(){
    let list = PRODUCTS.filter(p => state.cat === 'all' || p.cat === state.cat);
    if(state.q){
      const q = state.q.trim();
      list = list.filter(p => p.name.includes(q) || (p.desc || '').includes(q));
    }
    /* قیمت مبنا برای مرتب‌سازی: اول price، وگرنه قیمت کیلویی (۲۵ محصول فقط kiloPrice دارند) */
    const basePrice = p => p.price || kiloOf(p) || 0;
    if(state.sort === 'cheap')  list = [...list].sort((a, b) => basePrice(a) - basePrice(b));
    if(state.sort === 'expensive') list = [...list].sort((a, b) => basePrice(b) - basePrice(a));
    if(state.sort === 'off') list = [...list].sort((a, b) => {
      const ra = a.oldPrice && basePrice(a) ? 1 - basePrice(a) / a.oldPrice : 0;
      const rb = b.oldPrice && basePrice(b) ? 1 - basePrice(b) / b.oldPrice : 0;
      return rb - ra;
    });
    found.textContent = `${list.length.toLocaleString('fa-IR')} محصول یافت شد`;
    grid.innerHTML = list.length
      ? list.map(productCard).join('')
      : `<div class="empty-cart" style="grid-column:1/-1"><div class="big">🔍</div><p>محصولی با این مشخصات پیدا نشد</p></div>`;
    bindCards(grid);
    initReveal();
  }

  document.querySelectorAll('input[name="fcat"]').forEach(c =>
    c.onchange = () => { state.cat = c.value; apply(); });
  document.getElementById('sortSel').onchange = e => { state.sort = e.target.value; apply(); };
  document.getElementById('searchInput').oninput = e => { state.q = e.target.value; apply(); };
  document.getElementById('clearFilters').onclick = () => {
    state = { cat:'all', q:'', sort:'default' };
    document.querySelectorAll('input[name="fcat"]').forEach(c => c.checked = c.value === 'all');
    document.getElementById('searchInput').value = '';
    document.getElementById('sortSel').value = 'default';
    apply();
  };
  apply();
}

/* ---------- صفحه محصول (حرفه‌ای) ---------- */
function hashStr(s){ let h = 0; for(const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }

function productReviews(p){
  /* نظرات نمونه + نظرات ثبت‌شده کاربر در همین مرورگر */
  const h = hashStr(p.id);
  const base = [0, 1, 2].map(k => REVIEW_POOL[(h + k * 3) % REVIEW_POOL.length]);
  let mine = [];
  try{ mine = JSON.parse(localStorage.getItem('mo_rev_' + p.id) || '[]'); }catch(e){}
  return { base, mine };
}

/* ═══════════ سئوی داینامیک صفحه محصول ═══════════
   title / meta description / canonical / JSON-LD بر اساس محصول انتخاب‌شده */
function injectProductSEO(p){
  const BASE = 'https://mrorganico.github.io/mr-organico/';
  const url  = `${BASE}product.html?id=${encodeURIComponent(p.id)}`;
  const name = p.name.replace(/[<>&"]/g, '');
  const cat  = (CATEGORIES[p.cat] || {}).name || 'محصول';
  const desc = `${name} — ${cat} از Mr Organico${p.origin ? ' (' + p.origin + ')' : ''}. ` +
               `${p.weight ? 'وزن: ' + p.weight + '. ' : ''}` +
               `بدون مواد افزودنی و شیمیایی، بسته‌بندی زیپ‌دار و ارسال سراسر ایران. خرید توتون ارگانیک و پیپ دست‌ساز.`;
  const jdesc = desc.replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));

  const setMeta = (sel, attr, val, createTag) => {
    let el = document.head.querySelector(sel);
    if(!el && createTag){ el = document.createElement(createTag.tag); createTag.attrs.forEach(([k, v]) => el.setAttribute(k, v)); document.head.appendChild(el); }
    if(el) el.setAttribute(attr, val);
  };

  setMeta('meta[name="description"]', 'content', jdesc, { tag:'meta', attrs:[['name','description']] });
  setMeta('meta[property="og:title"]', 'content', jdesc ? `${name} | Mr Organico` : '', { tag:'meta', attrs:[['property','og:title']] });
  setMeta('meta[property="og:description"]', 'content', jdesc, { tag:'meta', attrs:[['property','og:description']] });
  setMeta('meta[property="og:url"]', 'content', url, { tag:'meta', attrs:[['property','og:url']] });
  setMeta('meta[property="og:type"]', 'content', 'product', { tag:'meta', attrs:[['property','og:type']] });
  setMeta('meta[name="twitter:title"]', 'content', `${name} | Mr Organico`, { tag:'meta', attrs:[['name','twitter:title']] });
  setMeta('meta[name="twitter:description"]', 'content', jdesc, { tag:'meta', attrs:[['name','twitter:description']] });
  setMeta('link[rel="canonical"]', 'href', url, { tag:'link', attrs:[['rel','canonical']] });

  /* قیمت نمایشی واقعی برای اسکیما */
  const kilo = kiloOf(p);
  const hasOffer = !!(p.price || kilo) && p.stock !== false;
  const offerPrice = p.price || (kilo ? priceFor(p, 100) : 0);
  const availability = p.stock === false
    ? 'https://schema.org/OutOfStock'
    : 'https://schema.org/InStock';

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    image: p.img ? [`${BASE}${p.img}`, `${BASE}images/og-image.jpg`] : [`${BASE}images/og-image.jpg`],
    description: jdesc,
    sku: p.id,
    mpn: p.id,
    brand: { '@type': 'Brand', name: 'Mr Organico', alternateName: 'میستر ارگانیک' },
    category: cat,
    material: p.cat === 'tobacco' ? 'توتون طبیعی ارگانیک' : undefined,
    audience: { '@type': 'PeopleAudience', suggestedMinimumAge: 18 },
    aggregateRating: undefined,
    offers: hasOffer ? {
      '@type': 'Offer',
      url,
      priceCurrency: 'IRR',
      price: String(offerPrice),
      availability,
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: 'Mr Organico', url: BASE }
    } : undefined
  };

  /* امتیاز و بازخورد */
  try{
    const { base, mine } = productReviews(p);
    const all = base.concat(mine.map(r => ({ r: r.r })));
    if(all.length){
      const avg = all.reduce((s, x) => s + x.r, 0) / all.length;
      ld.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: avg.toFixed(1),
        reviewCount: String(all.length),
        bestRating: '5',
        worstRating: '1'
      };
    }
  }catch(e){}

  /* حذف اسکیمای قبلی همین صفحه */
  document.head.querySelectorAll('script[data-dyn-ld="1"]').forEach(s => s.remove());
  const s = document.createElement('script');
  s.type = 'application/ld+json';
  s.setAttribute('data-dyn-ld', '1');
  s.textContent = JSON.stringify(ld, (k, v) => v === undefined ? undefined : v, 2);
  document.head.appendChild(s);
}

function initProduct(){
  const id = qs.get('id');
  const p = PRODUCTS.find(x => x.id === id);
  const box = document.getElementById('pdBox');
  if(!p){ box.innerHTML = '<div class="empty-cart"><div class="big">🚫</div><p>محصول یافت نشد</p><a class="btn btn-gold" href="products.html">بازگشت به فروشگاه</a></div>'; return; }
  document.title = `${p.name} | Mr Organico`;

  /* ─── سئوی داینامیک: توضیح متا + canonical + داده ساخت‌یافته محصول ─── */
  injectProductSEO(p);
  const off = p.oldPrice && p.price > 0 ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
  const oos = p.stock === false;
  const noPrice = !p.price && !p.kiloPrice && !oos;   /* تماس برای قیمت */
  const { base: revBase, mine: revMine } = productReviews(p);
  const avg = (() => {
    const all = revBase.concat(revMine.map(r => ({ r: r.r })));
    return all.reduce((s, x) => s + x.r, 0) / all.length;
  })();

  const starRow = r => '★★★★★'.slice(0, r) + '☆☆☆☆☆'.slice(0, 5 - r);

  box.innerHTML = `
    <div class="crumbs">
      <a href="index.html">خانه</a><span>/</span>
      <a href="products.html?cat=${p.cat}">${CATEGORIES[p.cat].name}</a><span>/</span>
      <b>${p.name}</b>
    </div>
    <div class="pd-layout">
      <div class="pd-gallery">
        <div class="gal-main" id="galMain" title="برای بزرگ‌نمایی کلیک کنید">
          ${p.img
            ? `<img src="${p.img}" alt="${p.name}">`
            : placeholderSVG(p.cat, p.icon)}
          <span class="gal-zoom">🔍 بزرگ‌نمایی</span>
        </div>
      </div>
      <div class="pd-info">
        <span class="p-cat">${CATEGORIES[p.cat].name}${p.sub === 'pipe' ? ' — پیپ' : p.sub === 'holder' ? ' — چوب سیگار' : ''}</span>
        <h1>${p.name}</h1>
        <div class="pd-rating">
          <span class="stars">${starRow(Math.round(avg))}</span>
          <span>${avg.toLocaleString('fa-IR', { maximumFractionDigits:1 })} از ۵</span>
          <span class="dot-sep">•</span>
          <a href="#pdReviews">${(revBase.length + revMine.length).toLocaleString('fa-IR')} دیدگاه</a>
        </div>
        <div class="pd-price" id="pdPrice">
          ${oos
            ? '<span class="oos">ناموجود — به‌زودی</span>'
            : noPrice
              ? '<span class="oos" style="color:var(--gold-2)">تماس برای قیمت</span>'
              : hasWeights(p)
                ? `<b>${PRICE_FMT(priceFor(p, 100))}</b><span>تومان — ${W_LABEL[100]}</span>`
                : `<b>${PRICE_FMT(p.price)}</b><span>تومان ${p.unit || ''}</span>`}
          ${p.oldPrice && !oos && !noPrice && !hasWeights(p) ? `<s>${PRICE_FMT(p.oldPrice)}</s> ${off ? `<span class="badge off">${off.toLocaleString('fa-IR')}٪</span>` : ''}` : ''}
        </div>
        ${hasWeights(p) ? `
        <div class="w-opts" id="wOpts">
          ${W_OPTIONS.map(g => `
            <button class="w-opt ${g === 100 ? 'on' : ''}" data-w="${g}">
              <b>${W_LABEL[g]}</b><small>${PRICE_FMT(priceFor(p, g))} تومان</small>
            </button>`).join('')}
        </div>` : ''}
        <p class="pd-desc">${p.desc}</p>
        ${p.cat === 'tobacco' && typeof SEO_TXT !== 'undefined' && SEO_TXT[p.id] ? `<div class="pd-seo">🔍 ${SEO_TXT[p.id]}</div>` : ''}
        <div class="pd-actions">
          ${oos
            ? `<button class="btn btn-ghost" disabled>فعلاً ناموجود</button>`
            : noPrice
              ? `<a class="btn btn-gold" href="tel:${PHONE_INTL}">📞 تماس برای قیمت و سفارش</a>`
              : `<button class="btn btn-gold" id="pdAdd">افزودن به سبد</button>
                 <button class="btn btn-ghost" id="pdBuy">خرید سریع</button>`}
          <a class="btn btn-green" href="${WA_LINK}?text=${encodeURIComponent('سلام، سفارش: ' + p.name)}" target="_blank">واتساپ</a>
          <a class="btn btn-ghost" href="tel:${PHONE_INTL}">مشاوره تلفنی</a>
        </div>
        <div class="pd-trust">
          <span>${I.check}ضمانت اصالت کالا</span>
          <span>${I.truck}ارسال سراسر کشور</span>
          <span>${I.shield}<a href="returns.html">بازگشت تا ۷ روز</a></span>
        </div>
      </div>
    </div>

    <div class="pd-tabs" id="pdTabs">
      <div class="pd-tabbar">
        <button class="pd-tab on" data-t="desc">توضیحات</button>
        <button class="pd-tab" data-t="spec">مشخصات</button>
        <button class="pd-tab" data-t="rev">نظرات (${(revBase.length + revMine.length).toLocaleString('fa-IR')})</button>
      </div>
      <div class="pd-panel on" data-p="desc">
        <p>${p.desc}</p>
        <p>
          این محصول از مجموعه <b>Mr Organico</b> بدون هیچ‌گونه افزودنی، طعم‌دهنده یا ماده
          نگه‌دارنده شیمیایی عرضه می‌شود. خشک‌سازی و تخمیر کاملاً طبیعی انجام شده و
          محصول در بسته‌بندی فویلی زیپ‌دار — برای قفل‌شدن رطوبت و عطر — ارسال می‌گردد.
        </p>
        <ul>
          <li>برش یکدست و بافت تازه با رطوبت متعادل</li>
          <li>خاستگاه مشخص و قابل استعلام</li>
          <li>مناسب مصرف روزانه و نگهداری بلندمدت در ظرف درب‌دار</li>
        </ul>
      </div>
      <div class="pd-panel" data-p="spec">
        <table class="spec-table">
          <tr><td>دسته‌بندی</td><td>${CATEGORIES[p.cat].name}</td></tr>
          ${p.aroma ? `<tr><td>عطر</td><td>${p.aroma}</td></tr>` : ''}
          ${p.taste ? `<tr><td>طعم</td><td>${p.taste}</td></tr>` : ''}
          ${p.strength ? `<tr><td>قدرت</td><td>${p.strength}</td></tr>` : ''}
          ${p.cut ? `<tr><td>نوع برش</td><td>${p.cut}</td></tr>` : ''}
          ${p.suitable ? `<tr><td>مناسب برای</td><td>${p.suitable}</td></tr>` : ''}
          ${hasWeights(p) ? `<tr><td>وزن‌های عرضه</td><td>۵۰ گرم تا ۱ کیلو — توزن</td></tr>` : ''}
          ${p.weight ? `<tr><td>وزن بسته</td><td>${p.weight}</td></tr>` : ''}
          ${p.origin ? `<tr><td>خاستگاه</td><td>${p.origin}</td></tr>` : ''}
          ${p.unit ? `<tr><td>واحد فروش</td><td>${p.unit}</td></tr>` : ''}
          <tr><td>مواد افزودنی</td><td>ندارد — ۱۰۰٪ طبیعی</td></tr>
          <tr><td>بسته‌بندی</td><td>فویلی زیپ‌دار حفظ رطوبت</td></tr>
          <tr><td>وضعیت</td><td>${oos ? 'ناموجود — به‌زودی' : 'موجود در انبار'}</td></tr>
        </table>
      </div>
      <div class="pd-panel" data-p="rev" id="pdReviews">
        <div class="rev-list">
          ${revMine.map(r => `
            <div class="rev-item mine">
              <div class="rev-head"><b>${r.n}</b><span class="rev-tag">دیدگاه شما</span><span class="stars">${starRow(r.r)}</span></div>
              <p>${r.t}</p>
            </div>`).join('')}
          ${revBase.map(r => `
            <div class="rev-item">
              <div class="rev-head"><b>${r.n}</b><span class="stars">${starRow(r.r)}</span></div>
              <p>${r.t}</p>
            </div>`).join('')}
        </div>
        <div class="rev-form">
          <h4>دیدگاه شما را ثبت کنید</h4>
          <div class="rev-grid">
            <input id="revName" placeholder="نام شما">
            <select id="revRate">
              <option value="5">★★★★★ عالی</option>
              <option value="4">★★★★ خوب</option>
              <option value="3">★★★ متوسط</option>
              <option value="2">★★ ضعیف</option>
              <option value="1">★ خیلی ضعیف</option>
            </select>
          </div>
          <textarea id="revText" placeholder="تجربه‌تان از این محصول را بنویسید..."></textarea>
          <button class="btn btn-gold" id="revSend">ثبت دیدگاه</button>
        </div>
      </div>
    </div>`;

  /* انتخاب وزن برای توتون‌های توزن */
  let selW = 100;
  const wOpts = document.getElementById('wOpts');
  if(wOpts){
    const priceEl = document.getElementById('pdPrice');
    wOpts.querySelectorAll('.w-opt').forEach(b => b.onclick = () => {
      selW = +b.dataset.w;
      wOpts.querySelectorAll('.w-opt').forEach(x => x.classList.toggle('on', x === b));
      priceEl.innerHTML = `<b>${PRICE_FMT(priceFor(p, selW))}</b><span>تومان — ${W_LABEL[selW]}</span>`;
    });
  }

  /* تب‌ها */
  box.querySelectorAll('.pd-tab').forEach(b => b.onclick = () => {
    box.querySelectorAll('.pd-tab').forEach(x => x.classList.toggle('on', x === b));
    box.querySelectorAll('.pd-panel').forEach(x => x.classList.toggle('on', x.dataset.p === b.dataset.t));
  });

  /* افزودن / خرید سریع */
  const addBtn = document.getElementById('pdAdd');
  if(addBtn) addBtn.onclick = () => Cart.add(p.id, 1, hasWeights(p) ? selW : null);
  const buyBtn = document.getElementById('pdBuy');
  if(buyBtn) buyBtn.onclick = () => { Cart.add(p.id, 1, hasWeights(p) ? selW : null); location.href = 'cart.html'; };

  /* ثبت دیدگاه */
  const revSend = document.getElementById('revSend');
  if(revSend) revSend.onclick = () => {
    const n = document.getElementById('revName').value.trim();
    const t = document.getElementById('revText').value.trim();
    const r = +document.getElementById('revRate').value;
    if(!n || !t){ toast('نام و متن دیدگاه را کامل کنید'); return; }
    let mine = [];
    try{ mine = JSON.parse(localStorage.getItem('mo_rev_' + p.id) || '[]'); }catch(e){}
    mine.unshift({ n, r, t });
    localStorage.setItem('mo_rev_' + p.id, JSON.stringify(mine.slice(0, 20)));
    toast('دیدگاه شما ثبت شد ✅');
    setTimeout(() => location.reload(), 900);
  };

  /* بزرگ‌نمایی گالری */
  const gal = document.getElementById('galMain');
  if(gal && p.img){
    gal.onclick = () => {
      const lb = document.createElement('div');
      lb.className = 'lightbox';
      lb.innerHTML = `<img src="${p.img}" alt="${p.name}"><button class="lb-close">✕</button>`;
      document.body.appendChild(lb);
      lb.onclick = e => { if(e.target === lb || e.target.closest('.lb-close')) lb.remove(); };
    };
  }

  /* محصولات مرتبط — نوار متحرک */
  const rel = PRODUCTS.filter(x => x.cat === p.cat && x.id !== p.id).slice(0, 12);
  if(rel.length) buildMarquee('relTrack', rel);
}

/* ---------- چرخ فلک سه‌بعدی محصولات ویژه ---------- */
const CHEV_R = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';
const CHEV_L = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';

function featuredCard(p){
  return `
  <article class="c3d-card">
    <a href="product.html?id=${p.id}">${productThumb(p)}</a>
    <div class="c3d-body">
      <span class="p-cat">${CATEGORIES[p.cat].name}</span>
      <a class="c3d-name" href="product.html?id=${p.id}">${p.name}</a>
      <div class="c3d-foot">
        <span class="c3d-price">${PRICE_FMT(priceFor(p))}<span class="unit">تومان</span></span>
        <button class="add-btn" data-add="${p.id}" aria-label="افزودن به سبد">${I.plus}</button>
      </div>
    </div>
  </article>`;
}

function initFeaturedCarousel(){
  const ring = document.getElementById('c3dRing');
  if(!ring) return;
  const items = FEATURED.map(id => PRODUCTS.find(p => p.id === id)).filter(Boolean);
  ring.innerHTML = items.map(featuredCard).join('');
  bindCards(ring);

  const n = items.length;
  const step = 360 / n;
  const cardW = ring.clientWidth || 236;
  const radius = Math.round((cardW / 2) / Math.tan(Math.PI / n)) + 42;
  [...ring.children].forEach((el, i) => {
    el.style.transform = `rotateY(${i * step}deg) translateZ(${radius}px)`;
  });

  const stage = document.getElementById('c3dStage');
  const BASE_SPEED = -0.16;           /* اسلوموشن: ~۱۰ درجه بر ثانیه — چرخه کامل ~۳۶ ثانیه */
  let angle = 0, vel = BASE_SPEED;
  let paused = false, dragging = false, lastX = 0, moved = 0;
  let target = null;                   /* زاویه هدف هنگام زدن دکمه */

  /* درگ با موس و لمس (بدون pointer capture تا کلیک لینک‌ها سالم بماند) */
  stage.addEventListener('pointerdown', e => {
    dragging = true; moved = 0; lastX = e.clientX; target = null;
  });
  window.addEventListener('pointermove', e => {
    if(!dragging) return;
    const d = e.clientX - lastX; lastX = e.clientX;
    moved += Math.abs(d);
    angle += d * .28;
    vel = d * .28;
  }, { passive:true });
  const endDrag = () => { dragging = false; };
  window.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  /* توقف روی هاور */
  stage.addEventListener('mouseenter', () => paused = true);
  stage.addEventListener('mouseleave', () => paused = false);

  /* جلوگیری از کلیک ناخواسته بعد از درگ */
  ring.addEventListener('click', e => { if(moved > 8){ e.preventDefault(); e.stopPropagation(); moved = 0; } }, true);

  /* دکمه‌ها */
  document.getElementById('c3dNext').onclick = () => { target = (target ?? angle) - step; };
  document.getElementById('c3dPrev').onclick = () => { target = (target ?? angle) + step; };

  function loop(){
    requestAnimationFrame(loop);
    if(target !== null){
      angle += (target - angle) * .08;
      if(Math.abs(target - angle) < .05){ angle = target; target = null; }
    } else if(!dragging && !paused){
      vel += (BASE_SPEED - vel) * .02;   /* بازگشت نرم به سرعت اسلوموشن */
      angle += vel;
    }
    ring.style.transform = `rotateY(${angle}deg)`;
  }
  loop();
}

/* ---------- افکت تیلت سه‌بعدی کارت‌ها ---------- */
function initTilt(){
  if(!matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  let current = null;
  document.addEventListener('pointerover', e => {
    const card = e.target.closest('.p-card:not(.c3d-card)');
    if(card !== current){
      if(current){ current.style.transform = ''; current = null; }
      if(card){ current = card; }
    }
  });
  document.addEventListener('pointermove', e => {
    if(!current) return;
    const r = current.getBoundingClientRect();
    if(e.clientX < r.left - 4 || e.clientX > r.right + 4 || e.clientY < r.top - 4 || e.clientY > r.bottom + 4) return;
    const px = (e.clientX - r.left) / r.width - .5;
    const py = (e.clientY - r.top) / r.height - .5;
    current.style.transform = `perspective(900px) translateY(-6px) rotateX(${(-py * 7).toFixed(2)}deg) rotateY(${(px * 7).toFixed(2)}deg)`;
  });
  document.addEventListener('pointerout', e => {
    if(current && !e.relatedTarget?.closest?.('.p-card')){
      current.style.transform = ''; current = null;
    }
  });
}

/* ---------- کاورفلو سه‌بعدی (استایل دوم شوی) ---------- */
function initCoverflow(stageId, ringId, dotsId, ids){
  const stage = document.getElementById(stageId);
  const ring  = document.getElementById(ringId);
  const dots  = document.getElementById(dotsId);
  if(!stage || !ring) return;
  const items = ids.map(id => PRODUCTS.find(p => p.id === id)).filter(Boolean);
  if(!items.length) return;
  ring.innerHTML = items.map(featuredCard).join('');
  bindCards(ring);
  if(dots) dots.innerHTML = items.map((_, i) =>
    `<button class="cf-dot" data-dot="${i}" aria-label="اسلاید ${i + 1}"></button>`).join('');

  const n = items.length;
  let cur = 0, timer = null;

  function layout(){
    [...ring.children].forEach((el, i) => {
      let rel = ((i - cur) % n + n) % n;
      if(rel > n / 2) rel -= n;
      const abs = Math.abs(rel);
      const x    = rel * 175;
      const rot  = rel === 0 ? 0 : (rel > 0 ? -46 : 46);
      const scl  = Math.max(.72, 1 - abs * .07);
      const z    = -abs * 95;
      const op   = abs > 3 ? 0 : Math.max(0, 1 - abs * .2);
      el.style.transform = `translateX(${x}px) translateZ(${z}px) rotateY(${rot}deg) scale(${scl})`;
      el.style.opacity = op;
      el.style.zIndex = 20 - abs;
      el.style.filter = `brightness(${Math.max(.55, 1 - abs * .13)})`;
      el.classList.toggle('cf-center', rel === 0);
    });
    if(dots) [...dots.children].forEach((d, i) => d.classList.toggle('on', i === cur));
  }

  const go = d => { cur = ((cur + d) % n + n) % n; layout(); };
  const play  = () => { stop(); timer = setInterval(() => go(1), 3400); };
  const stop  = () => { if(timer){ clearInterval(timer); timer = null; } };

  stage.addEventListener('mouseenter', stop);
  stage.addEventListener('mouseleave', play);
  const pb = document.getElementById(stageId.replace('Stage','Prev'));
  const nb = document.getElementById(stageId.replace('Stage','Next'));
  if(pb) pb.onclick = () => go(-1);
  if(nb) nb.onclick = () => go(1);
  if(dots) [...dots.children].forEach(d => d.onclick = () => { cur = +d.dataset.dot; layout(); });

  /* کلیک روی کارت کناری: فوکوس به همان کارت */
  ring.addEventListener('click', e => {
    const card = e.target.closest('.c3d-card');
    if(!card) return;
    const idx = [...ring.children].indexOf(card);
    if(idx !== cur){ e.preventDefault(); e.stopPropagation(); cur = idx; layout(); }
  }, true);

  layout();
  play();
}

/* ---------- نوار متحرک بی‌نهایت (استایل سوم شوی) ---------- */
function buildMarquee(trackId, products){
  const track = document.getElementById(trackId);
  if(!track) return;
  const card = p => `
    <a class="mq-card" href="product.html?id=${p.id}">
      <div class="mq-thumb">${productThumb(p)}</div>
      <div class="mq-body">
        <span class="mq-name">${p.name}</span>
        <span class="mq-price">${PRICE_FMT(priceFor(p))} <small>تومان</small></span>
      </div>
    </a>`;
  const html = products.map(card).join('');
  /* دو ست کامل و هم‌عرض — انیمیشن -۵۰% دقیقاً یک ست جابجا می‌شود → حلقه بی‌درز */
  track.innerHTML = `<div class="mq-set">${html}</div><div class="mq-set">${html}</div>`;
}

/* ---------- صفحه سبد خرید ---------- */
function initCartPage(){
  const list = document.getElementById('cartList');
  const sums = document.getElementById('cartSums');

  function render(){
    const items = Cart.read();
    Cart.badge();
    if(!items.length){
      list.innerHTML = `<div class="empty-cart"><div class="big">🛒</div><p>سبد خرید شما خالی است</p><a class="btn btn-gold" href="products.html">مشاهده محصولات</a></div>`;
      sums.innerHTML = '';
      return;
    }
    list.innerHTML = items.map((it, idx) => {
      const { id, qty, w } = it;
      const p = PRODUCTS.find(x => x.id === id); if(!p) return '';
      const ww = w || (p.kiloPrice ? 100 : null);
      return `
      <div class="cart-item">
        <div class="ci-thumb">${productThumb(p)}</div>
        <div style="flex:1">
          <a href="product.html?id=${p.id}"><h4>${p.name}</h4></a>
          <div class="ci-meta">${CATEGORIES[p.cat].name}${ww ? ' — ' + W_LABEL[ww] : ''}${p.unit && !ww ? ' — واحد: ' + p.unit : ''}</div>
          <div class="ci-price">${PRICE_FMT(priceFor(p, ww) * qty)} تومان</div>
        </div>
        <div style="display:grid;gap:10px;justify-items:center">
          <div class="qty">
            <button data-dec="${idx}">−</button><b>${qty.toLocaleString('fa-IR')}</b><button data-inc="${idx}">+</button>
          </div>
          <button class="ci-remove" data-rm="${idx}">${I.trash}حذف</button>
        </div>
      </div>`;
    }).join('');

    const sub = Cart.total();
    const ship = sub >= 5000000 ? 0 : 80000;
    sums.innerHTML = `
      <div class="sum-row"><span>جمع کالاها</span><span>${PRICE_FMT(sub)} تومان</span></div>
      <div class="sum-row"><span>هزینه ارسال</span><span>${ship === 0 ? 'رایگان 🎉' : PRICE_FMT(ship) + ' تومان'}</span></div>
      ${ship > 0 ? `<div class="sum-row" style="font-size:.8rem;color:var(--leaf-2)"><span>${I.truck} با ${PRICE_FMT(5000000 - sub)} تومان خرید بیشتر، ارسال رایگان می‌شود</span></div>` : ''}
      <div class="sum-row total"><span>مبلغ قابل پرداخت</span><b>${PRICE_FMT(sub + ship)} تومان</b></div>
      <button class="btn btn-gold btn-block" id="checkoutBtn" style="margin-top:14px">ثبت سفارش تلفنی / واتساپ</button>
      <p style="font-size:.78rem;color:var(--ink-soft);text-align:center;margin-top:10px">پرداخت پس از تأیید سفارش توسط کارشناس ما انجام می‌شود</p>`;

    list.querySelectorAll('[data-inc]').forEach(b => b.onclick = () => { Cart.setQtyAt(+b.dataset.inc, Cart.read()[+b.dataset.inc].qty + 1); render(); });
    list.querySelectorAll('[data-dec]').forEach(b => b.onclick = () => { Cart.setQtyAt(+b.dataset.dec, Cart.read()[+b.dataset.dec].qty - 1); render(); });
    list.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { Cart.removeAt(+b.dataset.rm); toast('ردیف حذف شد'); render(); });

    document.getElementById('checkoutBtn').onclick = () => {
      const name = document.getElementById('coName').value.trim();
      const phone = document.getElementById('coPhone').value.trim();
      const city = document.getElementById('coCity').value.trim();
      const addr = document.getElementById('coAddr').value.trim();
      if(!name || !phone || !city){ toast('نام، شماره تماس و شهر را کامل کنید'); return; }
      let text = `🌿 سفارش جدید — Mr Organico\n👤 ${name}\n📱 ${phone}\n🏙️ ${city}\n${addr ? '📍 ' + addr + '\n' : ''}\n`;
      Cart.read().forEach(({ id, qty, w }) => {
        const p = PRODUCTS.find(x => x.id === id);
        const ww = w || (p.kiloPrice ? 100 : null);
        text += `• ${p.name}${ww ? ' (' + W_LABEL[ww] + ')' : ''} × ${qty.toLocaleString('fa-IR')} = ${PRICE_FMT(priceFor(p, ww) * qty)} تومان\n`;
      });
      text += `\n💰 جمع: ${PRICE_FMT(sub)} تومان\n🚚 ارسال: ${ship === 0 ? 'رایگان' : PRICE_FMT(ship) + ' تومان'}\n🧾 کل: ${PRICE_FMT(sub + ship)} تومان`;
      window.open(`${WA_LINK}?text=${encodeURIComponent(text)}`, '_blank');
      toast('سفارش شما در واتساپ آماده ارسال شد');
    };
  }
  render();
}
