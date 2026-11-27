function Footer({ salonName }) {
  return (
    <footer className="footer">
      <p>
        سامانه نوبت‌دهی {salonName ? `«${salonName}»` : ''} &copy; تمامی حقوق محفوظ است.
      </p>
    </footer>
  )
}

export default Footer
