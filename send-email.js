const nodemailer = require('nodemailer');

const user = process.env.GMAIL_USER;
const pass = process.env.GMAIL_APP_PASSWORD;

async function main() {
  let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });

  await transporter.sendMail({
    from: user,
    to: 'recipient@example.com', // CHANGE THIS!
    subject: 'Test Email from GitHub Actions',
    text: 'This is a test email sent from a GitHub Actions workflow!',
  });

  console.log('Email sent!');
}

main().catch(err => {
  console.error('Failed to send email:', err);
  process.exit(1);
});
