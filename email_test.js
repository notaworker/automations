import nodemailer from 'nodemailer';

async function sendTestEmail() {
  const transporter = nodemailer.createTransport({
    service: 'gmail', // You can change this to another provider
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_RECIPIENT,
    subject: 'Test Email from GitHub Actions',
    text: 'This is a test email sent from a GitHub Actions workflow.',
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Test email sent successfully.');
  } catch (error) {
    console.error('Error sending test email:', error);
  }
}

sendTestEmail();
