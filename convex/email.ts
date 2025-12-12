
interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail({ to, subject, text, html }: EmailOptions) {
  const apiKey = process.env.BREVO_API_KEY;
  
  if (!apiKey) {
    // In development, just log the email
    console.log(`[DEV EMAIL] To: ${to}, Subject: ${subject}`);
    console.log(`[DEV EMAIL] Body: ${text}`);
    return;
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: process.env.EMAIL_FROM_NAME || 'Your App',
        email: process.env.EMAIL_FROM_ADDRESS || 'noreply@yourdomain.com',
      },
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html || `<p>${text}</p>`,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Failed to send email:', error);
    throw new Error(`Failed to send email: ${response.status}`);
  }

  return response.json();
}