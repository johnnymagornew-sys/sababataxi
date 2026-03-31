export async function sendWhatsApp(phone: string, message: string) {
  const url = process.env.WHATSAPP_SERVICE_URL
  if (!url) return
  try {
    await fetch(`${url}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, message }),
    })
  } catch (err) {
    console.error('WhatsApp error:', err)
  }
}
