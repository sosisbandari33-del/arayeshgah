import { useNavigate } from 'react-router-dom'
import { Button, Card, EmptyState, ErrorState, LoadingState } from '../../ui'
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
          <span className="badge">نوبت‌دهی آنلاین بر اساس برنامه کاری</span>
          <Button variant="primary-pill" onClick={() => handleBookService(null)}>
            رزرو وقت حضوری
          </Button>
        </div>
      </div>

      {loading && (
        <Card className="services-state-card">
          <LoadingState variant="cards" count={4} label="در حال بارگذاری لیست خدمات..." />
        </Card>
      )}

      {!loading && error && (
        <ErrorState message={error} onRetry={onRetryServices} />
      )}

      {!loading && !error && services.length === 0 && (
        <Card className="services-state-card">
          <EmptyState
            icon="✂️"
            title="در حال حاضر خدمتی برای رزرو فعال نیست"
            description="به‌محض فعال شدن خدمات توسط مدیریت، فهرست آن‌ها در این بخش نمایش داده می‌شود."
          />
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
