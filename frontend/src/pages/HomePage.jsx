import { useNavigate } from 'react-router-dom'
import ServiceCard from '../components/ServiceCard'
import '../styles/home.css'

function HomePage({ services, loading, error, onRetryServices }) {
  const navigate = useNavigate()

  const handleBookService = (serviceId = null) => {
    const target = serviceId ? `/booking?service=${serviceId}` : '/booking'
    navigate(target)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
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
            onClick={() => handleBookService(null)}
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
          <button className="retry-btn" onClick={onRetryServices}>تلاش مجدد</button>
        </div>
      )}

      {!loading && !error && (
        <div className="services-grid">
          {services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onBook={handleBookService}
            />
          ))}
        </div>
      )}
    </main>
  )
}

export default HomePage
