import { useNavigate } from 'react-router-dom'
import { Button, Card } from '../../ui'
import ServiceCard from './ServiceCard'
import './services.css'

function ServicesPage({ services, loading, error, onRetryServices }) {
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
          <Button variant="primary-pill" onClick={() => handleBookService(null)}>
            رزرو وقت حضوری
          </Button>
        </div>
      </div>

      {loading && (
        <Card className="status-box loading">
          <p>در حال بارگذاری لیست خدمات...</p>
        </Card>
      )}

      {error && (
        <Card className="status-box error">
          <p>❌ برقراری ارتباط با سرور ممکن نیست ({error})</p>
          <p className="hint">لطفاً مطمئن شوید بک‌اند روی پورت ۸۰۰۰ فعال است.</p>
          <Button variant="retry" onClick={onRetryServices}>
            تلاش مجدد
          </Button>
        </Card>
      )}

      {!loading && !error && services.length === 0 && (
        <Card className="status-box">
          <p>در حال حاضر هیچ خدمت فعالی برای رزرو ثبت نشده است.</p>
        </Card>
      )}

      {!loading && !error && services.length > 0 && (
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

export default ServicesPage
