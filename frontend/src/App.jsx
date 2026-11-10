import { useState, useEffect } from 'react'
import BookingPage from './BookingPage'
import OwnerAppointmentsPage from './OwnerAppointmentsPage'
import './App.css'

function App() {
  const [currentView, setCurrentView] = useState('home') // 'home' | 'booking' | 'owner'
  const [selectedServiceId, setSelectedServiceId] = useState(null)
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchServices = () => {
    setLoading(true)
    setError(null)
    fetch('http://127.0.0.1:8000/api/services')
      .then((res) => {
        if (!res.ok) {
          throw new Error('خطا در دریافت لیست خدمات از سرور')
        }
        return res.json()
      })
      .then((data) => {
        setServices(data)
        setLoading(false)
      })
      .catch((err) => {
        let msg = err.message
        if (!msg || msg.includes('Failed to fetch') || msg.includes('NetworkError') || err.name === 'TypeError') {
          msg = 'سرور در دسترس نیست'
        }
        setError(msg)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchServices()
  }, [])

  const handleStartBooking = (serviceId = null) => {
    setSelectedServiceId(serviceId)
    setCurrentView('booking')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleOpenOwnerPanel = () => {
    setCurrentView('owner')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="app-container">
      {/* هدر سایت و ناوبری */}
      <header className="header">
        <div className="header-top">
          <div className="logo-section">
            <span className="logo-badge">✂️</span>
            <div>
              <h1 className="salon-name">پیرایش کلاسیک</h1>
              <p className="salon-tagline">ارائه بهترین و باکیفیت‌ترین خدمات پیرایش و اصلاح آقایان</p>
            </div>
          </div>
          
          <div className="header-nav">
            {currentView !== 'home' && (
              <button 
                className="btn btn-header-secondary"
                onClick={() => setCurrentView('home')}
              >
                🏠 صفحه اصلی
              </button>
            )}

            {currentView !== 'booking' && (
              <button 
                className="btn btn-header-action"
                onClick={() => handleStartBooking(null)}
              >
                📅 نوبت بگیر
              </button>
            )}

            {currentView !== 'owner' && (
              <button 
                className="btn btn-header-outline"
                onClick={handleOpenOwnerPanel}
              >
                📋 پنل نوبت‌ها (مدیریت)
              </button>
            )}
          </div>
        </div>
      </header>

      {/* محتوای صفحات */}
      {currentView === 'booking' && (
        <BookingPage
          services={services}
          preSelectedServiceId={selectedServiceId}
          onBack={() => setCurrentView('home')}
        />
      )}

      {currentView === 'owner' && (
        <OwnerAppointmentsPage
          onBack={() => setCurrentView('home')}
        />
      )}

      {currentView === 'home' && (
        <main className="main-content">
          <div className="section-header">
            <div>
              <h2>لیست خدمات و تعرفه‌ها</h2>
              <p className="section-subtitle">خدمت مورد نظر خود را انتخاب کرده و سریع نوبت بگیرید.</p>
            </div>
            <div className="header-actions">
              <span className="badge">ساعت کاری: ۱۰:۰۰ الی ۲۰:۰۰</span>
              <button 
                className="btn btn-primary-pill"
                onClick={() => handleStartBooking(null)}
              >
                رزرو وقت حضوری
              </button>
            </div>
          </div>

          {loading && (
            <div className="status-box loading">
              <p>در حال بارگذاری لیست خدمات...</p>
            </div>
          )}

          {error && (
            <div className="status-box error">
              <p>❌ برقراری ارتباط با سرور ممکن نیست ({error})</p>
              <p className="hint">لطفاً مطمئن شوید بک‌اند روی پورت ۸۰۰۰ فعال است.</p>
              <button className="retry-btn" onClick={fetchServices}>تلاش مجدد</button>
            </div>
          )}

          {!loading && !error && (
            <div className="services-grid">
              {services.map((service) => (
                <div key={service.id} className="service-card">
                  <div className="service-header">
                    <h3 className="service-title">{service.name}</h3>
                  </div>
                  
                  <div className="service-details">
                    <div className="detail-item">
                      <span className="label">مدت زمان:</span>
                      <span className="value">⏱ {service.duration} دقیقه</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">قیمت:</span>
                      <span className="price-value">
                        {Number(service.price).toLocaleString('fa-IR')} <small>تومان</small>
                      </span>
                    </div>
                  </div>

                  <button 
                    className="book-btn"
                    onClick={() => handleStartBooking(service.id)}
                  >
                    رزرو نوبت این خدمت
                  </button>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* فوتر */}
      <footer className="footer">
        <p>سیستم نوبت‌دهی پیرایش کلاسیک &copy; تمامی حقوق محفوظ است.</p>
      </footer>
    </div>
  )
}

export default App
