import nodemailer from 'nodemailer';

async function sendTestEmail() {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // Use SSL
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_RECIPIENT,
    subject: '✅ GitHub Actions Email Test',
    text: 'This is a test email sent from a GitHub Actions workflow using Gmail and an App Password.',
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ Test email sent successfully.');
  } catch (error) {
    console.error('❌ Error sending test email:', error);
  }
}

sendTestEmail();
