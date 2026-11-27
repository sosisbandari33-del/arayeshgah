# نمای کلی معماری (Architecture Overview)

این سند ساختار فنی فعلی پروژه، اجزای اصلی آن و نحوه‌ی ارتباط این بخش‌ها با یکدیگر را توضیح می‌دهد. جزئیات دقیق پیاده‌سازی را مستقیماً از کد بخوانید.

## پشته فنی فعلی
- **فرانت‌اند:** React 19، Vite 8 و `react-router-dom` (راست‌چین فارسی با فونت وزیرمتن از Google Fonts).
- **بک‌اند:** Python و FastAPI اجراشده روی Uvicorn.
- **دیتابیس:** SQLite محلی (`backend/barbershop.db`) با سیستم migration نسخه‌دار.

## بخش‌های اصلی پروژه

### ۱. فرانت‌اند (`frontend/src/`)
- **ورودی و مسیریابی (`main.jsx` و `App.jsx`):** راه‌اندازی `BrowserRouter` و نگاشت مسیرهای عمومی (`/` و `/booking`)، مسیر ورود مدیر (`/admin/login`) و مسیرهای محافظت‌شده‌ی پنل مدیریت (`/admin/appointments`، `/admin/services` و `/admin/schedule` زیر گارد `RequireAdminAuth` و چیدمان `AdminLayout`).
- **اجزای عمومی رابط کاربری (`ui/`):** کامپوننت‌های پایه‌ی قابل استفاده در کل برنامه شامل `Button`، `Card`، `Input`، `Select`، `Modal` و `Alert`.
- **پوشه‌ی فیچرها (`features/`):**
  - `features/auth/`: صفحه‌ی ورود مدیر (`AdminLoginPage`)، گارد دسترسی (`RequireAdminAuth`)، پوسته‌ی پنل مدیریت و خروج (`AdminLayout`)، ذخیره‌سازی نشست (`authStorage.js`)، `authApi.js` و `auth.css`.
  - `features/services/`: `ServicesPage` (نمایش خدمات فعال به مشتری)، `AdminServicesPage` (مدیریت خدمات توسط صاحب کار)، `ServiceCard`، `servicesApi.js`، `services.css`.
  - `features/schedule/`: `AdminSchedulePage` (مدیریت ساعات کاری هفتگی، تعطیلی‌ها و مرخصی‌ها همراه با هشدار تداخل)، `scheduleApi.js`، `schedule.css`.
  - `features/booking/`: `BookingPage`، `BookingReceipt`، `bookingApi.js`، `booking.css`.
  - `features/appointments/`: `AppointmentsPage`، `CancelAppointmentModal`، `appointmentsApi.js`، `appointments.css`.
- **پوسته‌ی مشترک و ابزارها:** `components/` (`Header` و `Footer`)، هسته‌ی مرکزی درخواست‌های شبکه (`api/client.js` روی `/api` با ارسال خودکار هدر `Bearer` و پاک‌سازی نشست در صورت دریافت `401`)، توابع کمکی (`utils/date.js` و `utils/persian.js`) و استایل‌های پایه (`styles/tokens.css` و `styles/layout.css`).

### ۲. بک‌اند (`backend/`)
- **تنظیمات متمرکز (`config.py`):** تنها نقطه‌ی مجاز خواندن مقادیر محیطی از `.env` (`ADMIN_PHONE`، `ADMIN_PASSWORD`، `AUTH_SECRET_KEY`).
- **لایه‌ی دریافت درخواست HTTP (`main.py`، `schemas.py` و `routes/`):**
  - `main.py`: اجرای migrationها و ساخت حساب اولیه‌ی مدیر در راه‌اندازی، تنظیم CORS، مدیریت یکپارچه‌ی خطاهای `422`/`401`/`404`/`400` به زبان فارسی و ثبت روترها.
  - `routes/` (`health.py`، `services.py`، `auth.py`، `schedule.py`، `appointments.py`): دریافت درخواست‌ها، اعمال وابستگی `require_admin` روی اندپوینت‌های مدیریتی و فراخوانی لایه‌ی منطق کسب‌وکار.
- **لایه‌ی منطق کسب‌وکار (`services/`):** مستقل از FastAPI شامل `errors.py`، `catalog.py`، `auth.py` (هش رمز با `PBKDF2-HMAC-SHA256` و توکن امضاشده‌ی `HMAC-SHA256`)، `schedule.py` (ساعات کاری هفتگی، تعطیلی، مرخصی ساعتی و تشخیص نوبت‌های متداخل) و `appointments.py` (اعتبارسنجی فیلدبه‌فیلد و قوانین کسب‌وکار).
- **لایه‌ی دیتابیس و Migrationها (`database.py` و `migrations/`):** مدیریت اتصالات SQLite با `PRAGMA foreign_keys = ON` و اجرای ترتیبی migrationها با ثبت نسخه در جدول `schema_migrations`.
- **تست‌های خودکار (`tests/` و `pytest.ini`):** تست‌های HTTP با `pytest` و `TestClient` روی دیتابیس و تنظیمات محیطی ایزوله.

### ۳. دیتابیس (`barbershop.db`)
دیتابیس شامل جداول زیر است (برای ستون‌های دقیق، فایل‌های `backend/migrations/` را بخوانید):
- **`schema_migrations`:** ثبت نسخه‌ی migrationهای اجراشده.
- **`services`:** نگهداری لیست خدمات، قیمت، مدت‌زمان (به دقیقه) و وضعیت فعال/غیرفعال (`is_active`).
- **`appointments` و `appointment_services`:** نگهداری نوبت‌ها (شامل ساعت شروع و پایان، مجموع مدت، مجموع قیمت و `created_at` محلی) و نگاشت یک یا چند خدمت هر نوبت با کلید خارجی به `services`.
- **`admin_users`:** نگهداری شماره‌ی موبایل یکتا و هش رمز عبور مدیر.
- **`working_hours`:** نگهداری ساعت شروع، پایان و وضعیت تعطیلی هر یک از ۷ روز هفته (شنبه تا جمعه).
- **`time_offs`:** نگهداری تعطیلی‌های تاریخ خاص و مرخصی‌های چندساعته در یک روز.

## نحوه‌ی ارتباط بخش‌ها با هم
1. مرورگر (`http://localhost:5173`) از طریق فایل‌های `*Api.js` و هسته‌ی `frontend/src/api/client.js` درخواست‌های JSON را به `/api/...` می‌فرستد (و در صورت ورود مدیر، هدر `Authorization: Bearer <token>` را ضمیمه می‌کند).
2. پروکسی Vite درخواست‌های `/api` را به FastAPI (`http://127.0.0.1:8000`) هدایت می‌کند.
3. در روت‌های مدیریتی، ابتدا `require_admin` توکن را بررسی می‌کند و در صورت نبود یا نامعتبر بودن با کد `401` رد می‌کند؛ سپس منطق کسب‌وکار در `backend/services/` اجرا و از طریق `backend/database.py` در SQLite ذخیره یا خوانده می‌شود.
