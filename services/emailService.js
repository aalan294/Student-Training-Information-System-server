const nodemailer = require('nodemailer');

const sendAbsenceEmail = async (studentEmail, date, session) => {
  const day = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
  const formattedDate = new Date(date).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const sessionText = session === 'FN' ? 'FN' : session === 'AN' ? 'AN' : session;

  // TODO: Replace with your email service provider's details
  const transporter = nodemailer.createTransport({
    service: 'gmail', // or your email service
    auth: {
      user: "noreply.placemettraining.srmrmp@gmail.com", // Your email address
      pass: "mhld kmix wuap logo", // Your email password or app password
    },
  });

  const mailOptions = {
    from: "noreply.placemettraining.srmrmp@gmail.com",
    to: studentEmail,
    subject: 'Absence from Placement Training – Action Required',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2c3e50; margin-bottom: 20px;">Subject: Absence from Placement Training – Action Required</h2>
        
        <p style="margin-bottom: 15px;"><strong>Greetings from SRM Institute of Science and Technology!</strong></p>
        
        <p style="margin-bottom: 15px;">Dear student,</p>
        
        <p style="margin-bottom: 15px;">
          You were absent for the Placement Training held on <strong>${formattedDate}</strong> during the <strong>${sessionText}</strong> session. 
          Please note that 100% attendance is mandatory for Placement Training sessions.
        </p>
        
        <p style="margin-bottom: 15px;">
          You are hereby instructed to meet your Faculty Advisor (FA), Department Training Coordinator, 
          Head of the Department (HoD) at the earliest for further approval to attend the training session and necessary action.
        </p>
        
        <p style="margin-bottom: 15px;">Regards,</p>
        <p style="margin-bottom: 5px;"><strong>Training Coordinator - Placement Training Cell</strong></p>
        <p style="margin-bottom: 5px;"><strong>SRM Institute of Science and Technology</strong></p>
      </div>
    `,
    text: `Subject: Absence from Placement Training – Action Required

Greetings from SRM Institute of Science and Technology!

Dear student,

You were absent for the Placement Training held on ${formattedDate} during the ${sessionText} session. Please note that 100% attendance is mandatory for Placement Training sessions.

You are hereby instructed to meet your Faculty Advisor (FA), Department Training Coordinator, Head of the Department (HoD) at the earliest for further approval to attend the training session and necessary action.

Regards,
Training Coordinator - Placement Training Cell
SRM Institute of Science and Technology`
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