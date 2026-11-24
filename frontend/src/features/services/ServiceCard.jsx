import { Button, Card } from '../../ui'
import { formatPrice } from '../../utils/persian'

function ServiceCard({ service, onBook }) {
  return (
    <Card className="service-card">
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
            {formatPrice(service.price)} <small>تومان</small>
          </span>
        </div>
      </div>

      <Button variant="book" onClick={() => onBook(service.id)}>
        رزرو نوبت این خدمت
      </Button>
    </Card>
  )
}

export default ServiceCard
