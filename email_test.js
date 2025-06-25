import nodemailer from 'nodemailer';

const apiKey = process.env.SENDGRID_API_KEY;
const recipient = process.env.EMAIL_RECIPIENT;

async function main() {
  let transporter = nodemailer.createTransport({
    service: 'SendGrid',
    auth: { user: 'apikey', pass: apiKey }
  });

  try {
    let info = await transporter.sendMail({
      from: `"GitHub Actions Test" <your_verified_sendgrid_email@example.com>`,
      to: recipient,
      subject: "GitHub Actions SendGrid Test",
      text: "This is a test email sent from GitHub Actions using SendGrid."
    });
    console.log("✅ Email sent:", info.response);
  } catch (err) {
    console.error("❌ Error sending test email:", err);
    process.exit(1);
  }
}

main();
