import { Button, Card } from '../../ui'

function BookingReceipt({ appointment, onNewBooking, onGoHome }) {
  return (
    <div className="booking-container">
      <Card className="success-card">
        <div className="success-icon">✅</div>
        <h2>نوبت شما با موفقیت ثبت شد!</h2>
        <p className="success-subtitle">اطلاعات نوبت شما در سیستم ذخیره گردید.</p>

        <div className="receipt-box">
          <div className="receipt-item">
            <span className="receipt-label">شماره پیگیری:</span>
            <span className="receipt-value">#{appointment.id}</span>
          </div>
          <div className="receipt-item">
            <span className="receipt-label">نام مشتری:</span>
            <span className="receipt-value">{appointment.customer_name}</span>
          </div>
          <div className="receipt-item">
            <span className="receipt-label">شماره تماس:</span>
            <span className="receipt-value">{appointment.customer_phone}</span>
          </div>
          <div className="receipt-item">
            <span className="receipt-label">خدمت انتخابی:</span>
            <span className="receipt-value">{appointment.service_name}</span>
          </div>
          <div className="receipt-item">
            <span className="receipt-label">تاریخ نوبت:</span>
            <span className="receipt-value">{appointment.date}</span>
          </div>
          <div className="receipt-item">
            <span className="receipt-label">ساعت نوبت:</span>
            <span className="receipt-value time-badge">{appointment.start_time}</span>
          </div>
          <div className="receipt-item">
            <span className="receipt-label">وضعیت:</span>
            <span className="status-pill">{appointment.status}</span>
          </div>
        </div>

        <div className="success-actions">
          <Button variant="secondary" onClick={onNewBooking}>
            ثبت نوبت دیگر
          </Button>
          <Button variant="primary" onClick={onGoHome}>
            بازگشت به صفحه اصلی
          </Button>
        </div>
      </Card>
    </div>
  )
}

export default BookingReceipt
