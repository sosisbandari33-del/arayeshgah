# سامانه نوبت‌دهی آنلاین «پیرایش کلاسیک»

سامانه مستقل نوبت‌دهی آرایشگاه، طراحی‌شده جهت رزرو نوبت بدون نیاز به حساب کاربری برای مشتریان و مشاهده و مدیریت نوبت‌های روزانه برای صاحب آرایشگاه.

---

## وضعیت فعلی پروژه

* **فرانت‌اند:** React (Vite) + `react-router-dom` با معماری فیچرمحور (`ui/`, `features/`, `api/`, `utils/`, `styles/`)، پشتیبانی کامل از چینش راست‌چین (RTL)، فونت استاندارد وزیرمتن و طراحی واکنش‌گرا روی موبایل، تبلت و دسکتاپ.
* **بک‌اند:** FastAPI (Python) با تفکیک لایه‌ی دریافت درخواست (`routes/`) از منطق کسب‌وکار (`services/`) و دیتابیس (`database.py`)، همراه با اعتبارسنجی مستقل ورودی‌ها، نرمال‌سازی ارقام فارسی و عربی و تنظیمات CORS.
* **دیتابیس:** SQLite (`backend/barbershop.db`) با سیستم migration نسخه‌دار (`schema_migrations`) شامل جداول مدیران (`admin_users`)، خدمات (`services`)، ساعات کاری هفتگی (`working_hours`)، تعطیلی‌ها و مرخصی‌ها (`time_offs`)، نوبت‌ها (`appointments`)، خدمات هر نوبت (`appointment_services`) و تنظیمات برنامه (`app_settings`).

---

## ساختار پوشه‌ها و فایل‌ها

```text
arayeshgah/
├── backend/
│   ├── main.py              # نقطه ورود FastAPI، CORS، مدیریت خطاها و ثبت روترها
│   ├── config.py            # خواندن متمرکز تنظیمات از .env
│   ├── schemas.py           # مدل‌های ورودی Pydantic
│   ├── migrations/          # migrationهای نسخه‌دار SQLite
│   ├── routes/              # لایه‌ی دریافت درخواست HTTP (health, services, auth, schedule, settings, appointments)
│   ├── services/            # لایه‌ی منطق کسب‌وکار مستقل از HTTP (catalog, auth, schedule, settings, appointments, errors)
│   ├── database.py          # لایه‌ی دسترسی به SQLite و کوئری‌ها
│   ├── pytest.ini           # تنظیمات ابزار تست pytest
│   ├── tests/               # تست‌های خودکار HTTP برای همه‌ی اندپوینت‌ها (pytest + TestClient)
│   ├── barbershop.db        # دیتابیس SQLite (به‌صورت خودکار در اولین اجرا ساخته می‌شود و در گیت نیست)
│   ├── requirements.txt     # وابستگی‌های اجرای بک‌اند (fastapi, uvicorn)
│   └── requirements-dev.txt # وابستگی‌های تست بک‌اند (pytest, httpx)
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js        # هسته‌ی مرکزی ارتباط با API بک‌اند (/api)
│   │   ├── ui/                  # اجزای عمومی رابط کاربری و ۴ حالت لیست (Button, Card, Input, Modal, Alert, LoadingState, ErrorState, EmptyState)
│   │   ├── features/
│   │   │   ├── auth/            # فیچر ورود و پنل مدیریت (AdminLoginPage, RequireAdminAuth, AdminLayout)
│   │   │   ├── services/        # فیچر خدمات مشتری و مدیر (ServicesPage, AdminServicesPage, ServiceCard, servicesApi)
│   │   │   ├── schedule/        # فیچر ساعات کاری، تعطیلی‌ها و مرخصی‌ها (AdminSchedulePage, scheduleApi, schedule.css)
│   │   │   ├── settings/        # فیچر صفحه‌ی تنظیمات کامل آرایشگاه (AdminSettingsPage, settingsApi, settings.css)
│   │   │   ├── booking/         # فیچر ویزارد ۴ مرحله‌ای رزرو و خلاصه کد پیگیری (BookingPage, BookingReceipt, bookingApi)
│   │   │   ├── tracking/        # فیچر پیگیری و لغو نوبت مشتری با کد ۶ رقمی (TrackingPage, trackingApi, tracking.css)
│   │   │   └── appointments/    # فیچر مدیریت نوبت‌ها (AppointmentsPage, CancelAppointmentModal, appointmentsApi)
│   │   ├── components/          # پوسته‌ی مشترک صفحه (Header, Footer)
│   │   ├── utils/               # توابع کمکی تاریخ محلی و ارقام فارسی
│   │   ├── styles/              # متغیرهای سیستم طراحی (tokens.css) و چیدمان پایه (layout.css)
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
│   │   ├── admin-auth.md    # FRD احراز هویت مدیر و حفاظت پنل مدیریت
│   │   ├── services.md      # FRD خدمات و تعرفه‌ها (شامل R5 و R8)
│   │   ├── working-hours.md # FRD ساعات کاری، تعطیلی‌ها و مرخصی‌ها (شامل R6 و R7)
│   │   ├── booking.md       # FRD رزرو ۴ مرحله‌ای نوبت بر اساس مدت خدمات (شامل R3، R5 تا R8 و R10)
│   │   ├── appointment-tracking.md # FRD پیگیری و لغو نوبت مشتری با کد ۶ رقمی (شامل R9)
│   │   ├── appointments-management.md # FRD مدیریت نوبت‌ها (شامل R4)
│   │   └── settings.md      # FRD صفحه‌ی تنظیمات کامل آرایشگاه و حساب مدیر
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

### مرحله دوم: تنظیم فایل `.env` و راه‌اندازی بک‌اند (Python FastAPI)

ابتدا در ریشه‌ی پروژه یک کپی از فایل نمونه‌ی `.env.example` با نام `.env` بسازید و شماره موبایل، رمز عبور اولیه‌ی مدیر و کلید امضا را در آن تنظیم کنید:

```powershell
# در ویندوز (از ریشه پروژه)
Copy-Item .env.example .env
```

سپس در ترمینال اول، دستورات زیر را برای ساخت محیط مجازی، نصب وابستگی‌ها و اجرای سرور اجرا کنید:

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

برای مطالعه‌ی مشخصات محصول، رفتار هر فیچر، قوانین کسب‌وکار (`R3` تا `R10`)، فهرست APIها و معماری سیستم، از جدول مسیر در [docs/README.md](docs/README.md) شروع کنید.

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
