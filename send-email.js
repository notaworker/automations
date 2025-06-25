const nodemailer = require('nodemailer');

// Get environment variables
const senderEmail = process.env.GMAIL_ADDRESS;
const appPassword = process.env.GMAIL_APP_PASSWORD;
const receiverEmail = process.env.TO_EMAIL;

// Create the email content
const subject = "GitHub Actions Test Email";
const body = "This is a test email sent from GitHub Actions using a Google App Password.";
const message = {
  from: senderEmail,
  to: receiverEmail,
  subject: subject,
  text: body
};

// Send the email
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: senderEmail,
    pass: appPassword
  }
});

transporter.sendMail(message, (error, info) => {
  if (error) {
    return console.log('Error:', error);
  }
  console.log('Email sent successfully:', info.response);
});
