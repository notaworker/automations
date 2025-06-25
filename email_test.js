import nodemailer from 'nodemailer';

const user = process.env.EMAIL_USER;
const pass = process.env.EMAIL_PASS;
const recipient = process.env.EMAIL_RECIPIENT;

async function main() {
  let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });

  try {
    let info = await transporter.sendMail({
      from: `"GitHub Actions Test" <${user}>`,
      to: recipient,
      subject: "GitHub Actions App Password Test",
      text: "This is a test email sent from GitHub Actions using a Google App Password."
    });
    console.log("✅ Email sent:", info.response);
  } catch (err) {
    console.error("❌ Error sending test email:", err);
    process.exit(1);
  }
}

main();
