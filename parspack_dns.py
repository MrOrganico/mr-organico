"""
اسکریپت اتوماسیون مرورگر برای تنظیم DNS دامنه organico.com در پنل پارس‌پک

پیش‌نیازها:
  pip install playwright
  playwright install chromium

نحوهٔ اجرا:
  python parspack_dns.py

نکات:
  - مرورگر Chrome باید بسته باشد قبل از اجرای اسکریپت (پروفایل Chrome قفل می‌شود)
  - اسکریپت از پروفایل اصلی Chrome شما استفاده می‌کند، بنابراین Gmail از قبل لاگین است
  - تمام حرکات ماوس و تایپ با تاخیر طبیعی انسانی شبیه‌سازی می‌شوند
"""

import asyncio
import random
import time
from playwright.async_api import async_playwright

# ─── تنظیمات ───────────────────────────────────────────────
CHROME_USER_DATA = r"C:\Users\mehrs\AppData\Local\Google\Chrome\User Data"
PARSPACK_URL = "https://my.parspack.com"
TARGET_DOMAIN = "organico.com"

# رکوردهای DNS برای Vercel
DNS_RECORDS = [
    {"type": "TXT",  "host": "_vercel.organico.com", "value": "vc-domain-verify=organico.com,1bc51e10161c3e5e101b"},
    {"type": "A",    "host": "@",                     "value": "76.76.21.21"},
    {"type": "CNAME","host": "www",                   "value": "cname.vercel-dns.com"},
]

# ─── توابع کمکی انسانی ─────────────────────────────────────

async def human_delay(min_ms=300, max_ms=1200):
    """تاخیر تصادفی انسانی بین اقدامات."""
    await asyncio.sleep(random.uniform(min_ms / 1000, max_ms / 1000))

async def human_type(page, selector, text, min_delay=50, max_delay=180):
    """تایپ کردن متن با سرعت طبیعی انسانی."""
    element = await page.wait_for_selector(selector, timeout=15000)
    await element.click()
    await human_delay(200, 500)
    for char in text:
        await page.keyboard.type(char, delay=random.randint(min_delay, max_delay))
        if random.random() < 0.05:  # 5% chance of a small pause (thinking)
            await asyncio.sleep(random.uniform(0.1, 0.4))
    await human_delay(300, 600)

async def human_click(page, selector, timeout=15000):
    """کلیک با حرکت طبیعی ماوس."""
    element = await page.wait_for_selector(selector, timeout=timeout)
    box = await element.bounding_box()
    if box:
        # حرکت ماوس به مرکز عنصر با مسیر طبیعی
        x = box['x'] + box['width'] / 2 + random.uniform(-5, 5)
        y = box['y'] + box['height'] / 2 + random.uniform(-3, 3)
        await page.mouse.move(x, y, steps=random.randint(10, 25))
        await human_delay(100, 300)
    await element.click()
    await human_delay(500, 1200)

async def scroll_naturally(page, amount=300):
    """اسکرول طبیعی."""
    await page.mouse.wheel(0, amount)
    await human_delay(400, 800)

async def wait_for_page_load(page, timeout=30000):
    """منتظر بارگذاری کامل صفحه."""
    await page.wait_for_load_state("networkidle", timeout=timeout)
    await human_delay(1000, 2000)

# ─── تابع اصلی ─────────────────────────────────────────────

async def main():
    async with async_playwright() as p:
        # استفاده از پروفایل اصلی Chrome
        context = await p.chromium.launch_persistent_context(
            user_data_dir=CHROME_USER_DATA,
            headless=False,
            args=[
                "--start-maximized",
                "--disable-blink-features=AutomationControlled",
            ],
            viewport=None,  # use default Chrome viewport
            slow_mo=random.randint(50, 150),  # تاخیر طبیعی بین اقدامات
        )

        page = await context.new_page()

        # ─── گام ۱: باز کردن پنل پارس‌پک ─────────────────────
        print("🌐 در حال باز کردن پنل پارس‌پک...")
        await page.goto(PARSPACK_URL, wait_until="networkidle")
        await wait_for_page_load(page)
        await human_delay(2000, 4000)

        # بررسی لاگین بودن
        # اگر صفحهٔ لاگین نشان داده شد، یعنی session منقضی شده
        if "login" in page.url.lower() or "auth" in page.url.lower():
            print("⚠️  صفحهٔ لاگین نشان داده شد. لطفاً دستی لاگین کنید.")
            print("   (Gmail شما باید از قبل لاگین باشد)")
            await human_delay(5000, 10000)
            # منتظر بمان تا کاربر لاگین کند
            await page.wait_for_url("**/dashboard/**", timeout=120000)
            print("✅ لاگین موفق")
        else:
            print("✅ از قبل لاگین هستید")

        await human_delay(2000, 4000)

        # ─── گام ۲: رفتن به بخش دامنه ────────────────────────
        print("🔍 در حال جستجوی بخش دامنه‌ها...")
        # تلاش برای پیدا کردن لینک دامنه در منو
        try:
            await human_click(page, 'a:has-text("دامنه")', timeout=10000)
        except Exception:
            try:
                await human_click(page, 'a:has-text("Domain")', timeout=10000)
            except Exception:
                print("⚠️  لینک دامنه پیدا نشد. لطفاً دستی به بخش دامنه بروید.")
                await human_delay(10000, 15000)

        await wait_for_page_load(page)
        await human_delay(2000, 4000)

        # ─── گام ۳: پیدا کردن دامنه organico.com ─────────────
        print(f"🔍 در حال جستجوی دامنه {TARGET_DOMAIN}...")
        try:
            # جستجوی دامنه در لیست
            domain_link = await page.wait_for_selector(
                f'a:has-text("{TARGET_DOMAIN}")', timeout=15000
            )
            await human_click(page, f'a:has-text("{TARGET_DOMAIN}")')
            await wait_for_page_load(page)
            print(f"✅ دامنه {TARGET_DOMAIN} پیدا شد")
        except Exception:
            print(f"⚠️  دامنه {TARGET_DOMAIN} در لیست پیدا نشد.")
            print("   لطفاً دستی روی دامنه کلیک کنید.")
            await human_delay(15000, 20000)

        await human_delay(2000, 4000)

        # ─── گام ۴: رفتن به بخش DNS ──────────────────────────
        print("🔧 در حال رفتن به بخش DNS...")
        try:
            # تلاش برای پیدا کردن تب/لینک DNS
            await human_click(page, 'a:has-text("DNS")', timeout=10000)
        except Exception:
            try:
                await human_click(page, 'button:has-text("DNS")', timeout=10000)
            except Exception:
                try:
                    await human_click(page, 'a:has-text("رکوردهای DNS")', timeout=10000)
                except Exception:
                    print("⚠️  بخش DNS پیدا نشد. لطفاً دستی به بخش DNS بروید.")
                    await human_delay(15000, 20000)

        await wait_for_page_load(page)
        await human_delay(2000, 4000)

        # ─── گام ۵: اضافه کردن رکوردهای DNS ─────────────────
        for record in DNS_RECORDS:
            print(f"➕ در حال اضافه کردن رکورد {record['type']}: {record['host']} → {record['value']}")

            try:
                # کلیک روی دکمهٔ «افزودن رکورد»
                await human_click(page, 'button:has-text("افزودن")', timeout=10000)
                await human_delay(1000, 2000)

                # انتخاب نوع رکورد
                type_selector = 'select[name="type"], select[id*="type"], select[id*="recordType"]'
                type_el = await page.wait_for_selector(type_selector, timeout=10000)
                await type_el.select_option(record["type"])
                await human_delay(500, 1000)

                # وارد کردن Host
                host_selector = 'input[name="host"], input[name="name"], input[placeholder*="host"], input[placeholder*="نام"]'
                await human_type(page, host_selector, record["host"])
                await human_delay(300, 600)

                # وارد کردن Value
                value_selector = 'input[name="value"], input[name="data"], input[placeholder*="value"], input[placeholder*="مقدار"]'
                await human_type(page, value_selector, record["value"])
                await human_delay(300, 600)

                # کلیک روی دکمهٔ «ذخیره» یا «ثبت»
                await human_click(page, 'button:has-text("ذخیره"), button:has-text("ثبت"), button:has-text("Save"), button[type="submit"]', timeout=10000)
                await human_delay(2000, 4000)

                print(f"   ✅ رکورد {record['type']} اضافه شد")

            except Exception as e:
                print(f"   ⚠️  خطا در اضافه کردن رکورد {record['type']}: {e}")
                print("   لطفاً دستی این رکورد را اضافه کنید.")
                await human_delay(10000, 15000)

        # ─── گام ۶: تأیید نهایی ───────────────────────────────
        print("\n" + "="*60)
        print("✅ فرآیند تکمیل شد!")
        print("رکوردهای DNS برای organico.com تنظیم شدند.")
        print("لطفاً ۲-۴۸ ساعت صبر کنید تا DNS propagate شود.")
        print("سپس به من بگویید «دامنه را چک کن» تا بررسی کنم.")
        print("="*60)

        # نگه داشتن مرورگر باز برای بررسی دستی
        print("\nمرورگر ۶۰ ثانیهٔ دیگر باز می‌ماند...")
        await asyncio.sleep(60)

        await context.close()


if __name__ == "__main__":
    print("="*60)
    print("  اسکریپت تنظیم DNS دامنه organico.com برای Vercel")
    print("="*60)
    print()
    print("⚠️  قبل از اجرا:")
    print("  1. Google Chrome را کاملاً ببندید (پروفایل قفل می‌شود)")
    print("  2. مطمئن شوید Gmail در Chrome لاگین است")
    print("  3. pip install playwright && playwright install chromium")
    print()
    asyncio.run(main())
