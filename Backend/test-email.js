require('dotenv').config();
console.log("Loaded EMAIL_USER:", process.env.EMAIL_USER);
console.log("Loaded EMAIL_PASS:", process.env.EMAIL_PASS );
const nodemailer = require('nodemailer');

// This script tests your .env email credentials directly.

const user = process.env.EMAIL_USER;
const pass = process.env.EMAIL_PASS;

console.log(`Attempting to log in with user: ${user}`);
if (!user || !pass) {
    console.error("❌ ERROR: EMAIL_USER or EMAIL_PASS is missing from your .env file.");
    process.exit(1);
}

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: user,
        pass: pass
    }
});

const mailOptions = {
    from: user,
    to: user, // Sending a test email to yourself
    subject: 'Nodemailer Test',
    text: 'If you received this, your email credentials are working correctly!'
};

transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        console.error("❌ TEST FAILED: Could not send email.");
        console.error(error); // This will print the same 535 error if credentials are wrong
    } else {
        console.log("✅ TEST SUCCESSFUL: Email sent successfully!");
        console.log("Response:", info.response);
    }
});