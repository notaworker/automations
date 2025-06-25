import nodemailer from 'nodemailer';

const senderEmail = process.env.GMAIL_ADDRESS;
const appPassword = process.env.GMAIL_APP_PASSWORD;
const receiverEmail = process.env.TO_EMAIL;

const subject = "GitHub Actions Test Email";
const body = "This is a test email sent from GitHub Actions using a Google App Password.";

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: senderEmail,
    pass: appPassword
  }
});

const message = {
  from: senderEmail,
  to: receiverEmail,
  subject: subject,
  text: body
};

transporter.sendMail(message, (error, info) => {
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Email sent successfully:', info.response);
  }
});
