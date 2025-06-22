const nodemailer = require('nodemailer');

const sendAbsenceEmail = async (studentEmail, date, session) => {
  const day = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });

  // TODO: Replace with your email service provider's details
  const transporter = nodemailer.createTransport({
    service: 'gmail', // or your email service
    auth: {
      user: "aalansasonsingarayan@gmail.com", // Your email address
      pass: "zrme jstx kfux wjsa", // Your email password or app password
    },
  });

  const mailOptions = {
    from: "aalansasonsingarayan@gmail.com",
    to: studentEmail,
    subject: 'Absence Notification',
    text: `You have been marked absent for ${date}, ${day}, ${session} session. Please meet the HOD with your parents to get in for the next session.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Absence email sent to ${studentEmail}`);
  } catch (error) {
    console.error(`Error sending email to ${studentEmail}:`, error);
    // Depending on requirements, you might want to throw the error
    // to let the calling function know that email sending failed.
  }
};

module.exports = { sendAbsenceEmail }; 