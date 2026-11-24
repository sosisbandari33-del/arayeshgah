# سامانه نوبت‌دهی آنلاین «پیرایش کلاسیک»

سامانه مستقل نوبت‌دهی آرایشگاه، طراحی‌شده جهت رزرو نوبت بدون نیاز به حساب کاربری برای مشتریان و مشاهده و مدیریت نوبت‌های روزانه برای صاحب آرایشگاه.

---

## وضعیت فعلی پروژه

* **فرانت‌اند:** React (Vite) + `react-router-dom` با معماری ماژولار (`api/`, `utils/`, `components/`, `pages/`, `styles/`)، پشتیبانی کامل از چینش راست‌چین (RTL)، فونت استاندارد وزیرمتن و طراحی واکنش‌گرا روی موبایل، تبلت و دسکتاپ.
* **بک‌اند:** FastAPI (Python) همراه با اعتبارسنجی ورودی‌ها، نرمال‌سازی ارقام فارسی و عربی، کنترل دقیق قوانین کسب‌وکار و تنظیمات CORS.
* **دیتابیس:** SQLite (`backend/barbershop.db`) شامل جداول خدمات (`services`) و نوبت‌ها (`appointments`).

---

## ساختار پوشه‌ها و فایل‌ها

```text
arayeshgah/
├── backend/
│   ├── main.py              # برنامه اصلی FastAPI و روت‌های API
│   ├── database.py          # مدیریت اتصالات SQLite و کوئری‌ها
│   ├── pytest.ini           # تنظیمات ابزار تست pytest
│   ├── tests/               # تست‌های خودکار HTTP برای همه‌ی اندپوینت‌ها (pytest + TestClient)
│   ├── barbershop.db        # دیتابیس SQLite (به‌صورت خودکار در اولین اجرا ساخته می‌شود و در گیت نیست)
│   ├── requirements.txt     # وابستگی‌های اجرای بک‌اند (fastapi, uvicorn)
│   └── requirements-dev.txt # وابستگی‌های تست بک‌اند (pytest, httpx)
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js        # لایه مرکزی ارتباط با API بک‌اند (/api)
│   │   ├── utils/
│   │   │   ├── date.js          # توابع تاریخ محلی و جابه‌جایی ایمن روزها
│   │   │   └── persian.js       # تبدیل ارقام فارسی/عربی و قالب‌بندی قیمت
│   │   ├── components/
│   │   │   ├── Header.jsx       # هدر و ناوبری مشترک
│   │   │   ├── Footer.jsx       # فوتر مشترک
│   │   │   ├── ServiceCard.jsx  # کارت نمایش هر خدمت
│   │   │   └── CancelModal.jsx  # مودال تأیید لغو نوبت
│   │   ├── pages/
│   │   │   ├── HomePage.jsx     # صفحه اصلی (/)
│   │   │   ├── BookingPage.jsx  # صفحه فرم رزرو نوبت مشتری (/booking)
│   │   │   └── OwnerAppointmentsPage.jsx # پنل مدیریت نوبت‌های صاحب کار (/owner)
│   │   ├── styles/
│   │   │   ├── tokens.css       # متغیرهای سیستم طراحی (رنگ‌ها، سایه‌ها)
│   │   │   ├── layout.css       # استایل‌های مشترک هدر، فوتر، دکمه‌ها و پیام‌ها
│   │   │   ├── home.css         # استایل صفحه اصلی و کارت خدمات
│   │   │   ├── booking.css      # استایل صفحه رزرو و رسید دیجیتال
│   │   │   └── owner.css        # استایل پنل مدیریت، جدول و مودال
│   │   ├── App.jsx              # مسیریابی اصلی (React Router) و چیدمان کلان
│   │   ├── index.css            # تنظیمات پایه و RTL
│   │   └── main.jsx
│   ├── index.html               # ساختار سند و فونت وزیرمتن
│   ├── vite.config.js           # پیکربندی سرور Vite و پروکسی داخلی
│   └── package.json
├── docs/
│   ├── README.md            # جدول مسیر و راهنمای مستندات پروژه
│   ├── AGENT_RULES.md       # قانون‌نامه‌ی ایجنت (ممنوع‌ها، اول بپرس، استانداردها)
│   ├── product/
│   │   └── PRD.md           # سند محصول و محدوده‌ی فعلی
│   ├── features/
│   │   ├── services.md      # FRD خدمات و تعرفه‌ها
│   │   ├── booking.md       # FRD رزرو نوبت (شامل قوانین R1 تا R3)
│   │   └── appointments-management.md # FRD مدیریت نوبت‌ها (شامل قانون R4)
│   └── architecture/
│       └── overview.md      # نمای کلی معماری و ارتباط بخش‌های سیستم
├── AGENTS.md                # پروتکل ۵ فازی کار ایجنت
└── README.md
```

---

## راهنمای کامل راه‌اندازی و اجرا (روی کامپیوتر تازه)

### پیش‌نیازها:
* پایتون نسخه ۳.۱۰ یا بالاتر ([دانلود Python](https://www.python.org/downloads/))
* نود جی‌اس نسخه ۱۸ یا بالاتر همراه با npm ([دانلود Node.js](https://nodejs.org/))
* گیت ([دانلود Git](https://git-scm.com/))

---

### مرحله اول: دریافت پروژه
```bash
git clone https://github.com/sosisbandari33-del/arayeshgah.git
cd arayeshgah
```

---

### مرحله دوم: راه‌اندازی بک‌اند (Python FastAPI)

در ترمینال اول، دستورات زیر را برای ساخت محیط مجازی، نصب وابستگی‌ها و اجرای سرور اجرا کنید:

#### در ویندوز (PowerShell / CMD):
```powershell
# ۱. ورود به پوشه بک‌اند
cd backend

# ۲. ساخت محیط مجازی پایتون
python -m venv venv

# ۳. فعال‌سازی محیط مجازی
.\venv\Scripts\activate

# ۴. نصب کتابخانه‌ها و وابستگی‌ها
pip install -r requirements.txt

# ۵. اجرای سرور توسعه با uvicorn
uvicorn main:app --reload
```

#### در لینوکس یا مک (Linux / macOS):
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

* **آدرس سرور بک‌اند:** `http://127.0.0.1:8000`
* **مستندات تعاملی Swagger:** `http://127.0.0.1:8000/docs`

---

### مرحله سوم: راه‌اندازی فرانت‌اند (React Vite)

در یک پنجره ترمینال جدید (ترمینال دوم)، دستورات زیر را برای نصب بسته‌ها و اجرای برنامه فرانت‌اند وارد کنید:

```bash
# ۱. ورود به پوشه فرانت‌اند
cd frontend

# ۲. نصب تمامی بسته‌ها و کتابخانه‌های فرانت‌اند
npm install

# ۳. اجرای سرور توسعه فرانت‌اند
npm run dev
```

* **آدرس برنامه در مرورگر:** `http://localhost:5173`

---

## مستندات فنی و محصول

برای مطالعه‌ی مشخصات محصول، رفتار هر فیچر، قوانین کسب‌وکار (R1 تا R4)، فهرست APIها و معماری سیستم، از جدول مسیر در [docs/README.md](docs/README.md) شروع کنید.

---

## اجرای تست‌های خودکار بک‌اند (`pytest`)

برای نصب ابزارهای تست و بررسی خودکار همه‌ی اندپوینت‌ها و قوانین کسب‌وکار (روی دیتابیس موقت، بدون تغییر در دیتابیس اصلی):

```powershell
# ۱. نصب ابزارهای تست (یک‌بار در محیط مجازی بک‌اند)
cd backend
.\venv\Scripts\pip install -r requirements-dev.txt

# ۲. اجرای همه‌ی تست‌ها
.\venv\Scripts\pytest -v

# ۳. اجرای تست‌های فقط یک فایل مشخص
.\venv\Scripts\pytest tests/test_slots_and_booking.py -v
```
