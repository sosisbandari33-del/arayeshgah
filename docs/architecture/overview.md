# نمای کلی معماری (Architecture Overview)

این سند ساختار فنی فعلی پروژه، اجزای اصلی آن و نحوه‌ی ارتباط این بخش‌ها با یکدیگر را توضیح می‌دهد. جزئیات دقیق پیاده‌سازی را مستقیماً از کد بخوانید.

## پشته فنی فعلی
- **فرانت‌اند:** React 19، Vite 8 و `react-router-dom` (راست‌چین فارسی با فونت وزیرمتن از Google Fonts).
- **بک‌اند:** Python و FastAPI اجراشده روی Uvicorn.
- **دیتابیس:** SQLite محلی (فایل `backend/barbershop.db` که هنگام اولین اجرا به‌صورت خودکار ساخته می‌شود و در گیت نیست).

## بخش‌های اصلی پروژه

### ۱. فرانت‌اند (`frontend/src/`)
- **ورودی و مسیریابی (`main.jsx` و `App.jsx`):** راه‌اندازی `BrowserRouter`، نگهداری لیست خدمات دریافت‌شده و نگاشت مسیرهای `/`، `/booking` و `/owner` به صفحات هر فیچر (مسیرهای ناشناخته به `/` هدایت می‌شوند).
- **اجزای عمومی رابط کاربری (`ui/`):** کامپوننت‌های پایه‌ی قابل استفاده در کل برنامه شامل `Button`، `Card`، `Input`، `Select`، `Modal` و `Alert`.
- **پوشه‌ی فیچرها (`features/`):** هر فیچر شامل صفحه، کامپوننت‌های اختصاصی، فایل API و استایل اختصاصی خود است:
  - `features/services/` (`ServicesPage`، `ServiceCard`، `servicesApi.js`، `services.css`)
  - `features/booking/` (`BookingPage`، `BookingReceipt`، `bookingApi.js`، `booking.css`)
  - `features/appointments/` (`AppointmentsPage`، `CancelAppointmentModal`، `appointmentsApi.js`، `appointments.css`)
- **پوسته‌ی مشترک و ابزارها:** `components/` (`Header` و `Footer`)، هسته‌ی مرکزی درخواست‌های شبکه (`api/client.js` روی مسیر `/api`)، توابع کمکی (`utils/date.js` و `utils/persian.js`) و استایل‌های پایه (`styles/tokens.css` و `styles/layout.css`).

### ۲. بک‌اند (`backend/`)
بک‌اند به سه لایه‌ی مستقل تفکیک شده است:
- **لایه‌ی دریافت درخواست HTTP (`main.py`، `schemas.py` و `routes/`):**
  - `main.py`: ساخت نمونه‌ی FastAPI، تنظیم CORS، مدیریت یکپارچه‌ی خطاهای اعتبارسنجی و ترجمه‌ی خطاهای دامنه‌ی کسب‌وکار به پاسخ HTTP فارسی، و ثبت روترها.
  - `schemas.py`: مدل‌های ورودی Pydantic.
  - `routes/` (`health.py`، `services.py`، `appointments.py`): دریافت درخواست‌های HTTP و فراخوانی لایه‌ی منطق کسب‌وکار بدون منطق تکراری.
- **لایه‌ی منطق کسب‌وکار (`services/`):** مستقل از FastAPI و HTTP شامل `errors.py` (خطاهای دامنه)، `catalog.py` (منطق خدمات) و `appointments.py` (قوانین کسب‌وکار R1 تا R4، نرمال‌سازی ارقام فارسی و اعتبارسنجی مستقل ورودی‌ها).
- **لایه‌ی دیتابیس (`database.py`):** مدیریت اتصالات SQLite با فعال‌سازی `PRAGMA foreign_keys = ON` و بستن تضمینی اتصالات، ساخت جداول و تزریق خدمات اولیه.
- **تست‌های خودکار (`tests/` و `pytest.ini`):** مجموعه‌ی تست‌های HTTP با `pytest` و `TestClient` (مبتنی بر `httpx`) روی دیتابیس SQLite موقت برای قفل کردن رفتار فعلی هر ۶ اندپوینت، قوانین کسب‌وکار و قیدهای دیتابیس.

### ۳. دیتابیس (`barbershop.db`)
دیتابیس شامل دو جدول است (برای نام و نوع دقیق ستون‌ها، `backend/database.py` را بخوانید):
- **جدول `services`:** نگهداری لیست خدمات، قیمت و مدت‌زمان هر خدمت.
- **جدول `appointments`:** نگهداری نوبت‌های ثبت‌شده با کلید خارجی به `services`، ثبت `created_at` به وقت محلی سیستم و یک شاخص یکتایی جزئی (`idx_unique_active_slot`) روی ترکیب تاریخ و ساعت برای نوبت‌های فعال تا جلوی رزرو همزمان در سطح دیتابیس گرفته شود.

## نحوه‌ی ارتباط بخش‌ها با هم
1. کاربر با رابط کاربری React در مرورگر (`http://localhost:5173`) تعامل می‌کند.
2. هر فیچر از طریق فایل `*Api.js` خود و هسته‌ی مشترک `frontend/src/api/client.js` درخواست‌های JSON را به مسیر نسبی `/api/...` می‌فرستد.
3. سرور توسعه‌ی Vite (تنظیم‌شده در `frontend/vite.config.js`) تمام درخواست‌های `/api` را به سرور بک‌اند FastAPI در `http://127.0.0.1:8000` پروکسی می‌کند.
4. روتر مربوطه در `backend/routes/` درخواست را دریافت کرده و به تابع منطق کسب‌وکار در `backend/services/` می‌سپارد؛ لایه‌ی `services/` پس از اعتبارسنجی و بررسی قوانین، از طریق `backend/database.py` با `barbershop.db` کار می‌کند.
5. پاسخ موفق یا خطای فارسی (در قالب JSON با کلید `detail`) به فرانت‌اند برگردانده و در رابط کاربری نمایش داده می‌شود.
6. اندپوینت `GET /api/test` برای بررسی سلامت و برقراری ارتباط با بک‌اند در دسترس است.
