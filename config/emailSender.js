const nodemailer = require('nodemailer');
require('dotenv').config();

async function sendConfirmationEmail(payment) {
  const { memberEmail, memberName, managerEmail, managerName, amount, month } = payment;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: `${process.env.EMAIL_USER}`, // username
      pass:  `${process.env.EMAIL_PASS}`    // email key password
    }
  });

 const mailOptions = {
  from: `"Smart Mess" <${managerEmail}>`,
  to: memberEmail,
  subject: `Payment Confirmation for ${month}`,
  html: `
  <div style="font-family: 'Helvetica Neue', sans-serif; background-color: #f4f7f8; padding: 40px;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.05); overflow: hidden;">
      
      <div style="background: #10B981; padding: 24px 32px; color: white;">
        <h2 style="margin: 0; font-size: 24px;">✅ Payment Confirmation</h2>
        <p style="margin: 8px 0 0; font-size: 14px;">Month: ${month}</p>
      </div>

      <div style="padding: 32px;">
        <p style="font-size: 16px; color: #333;">Hi <strong>${memberName}</strong>,</p>

        <p style="font-size: 15px; line-height: 1.6; color: #555;">
          We have successfully received your payment of 
          <strong style="color: #10B981;">৳${amount}</strong> for the month of <strong>${month}</strong>.
        </p>

        <div style="margin: 30px 0; border-radius: 12px; background-color: #f0fdf4; padding: 24px; border: 1px solid #d1fae5;">
          <table style="width: 100%; font-size: 14px;">
            <tr>
              <td style="padding: 10px 0; color: #555;">👤 Member Name:</td>
              <td style="text-align: right; color: #333;"><strong>${memberName}</strong></td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #555;">💳 Paid Amount:</td>
              <td style="text-align: right; color: #10B981;"><strong>৳${amount}</strong></td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #555;">📆 Month:</td>
              <td style="text-align: right;"><strong>${month}</strong></td>
            </tr>
          </table>
        </div>

        <p style="font-size: 14px; color: #666;">
          If you have any questions or concerns, feel free to contact your mess manager:
        </p>

        <div style="margin-top: 12px; padding: 16px; background-color: #ecfdf5; border-left: 4px solid #10B981; border-radius: 8px;">
          <p style="margin: 0; font-size: 14px; color: #333;"><strong>${managerName}</strong></p>
          <p style="margin: 4px 0 0;"><a href="mailto:${managerEmail}" style="color: #059669; text-decoration: none;">${managerEmail}</a></p>
        </div>

        <p style="font-size: 13px; color: #999; margin-top: 40px;">Thank you for using Smart Mess. Stay organized, stay smart!</p>
      </div>

      <div style="background-color: #f9fafb; text-align: center; padding: 20px; font-size: 12px; color: #999;">
        &copy; ${new Date().getFullYear()} Smart Mess. All rights reserved.
      </div>
    </div>
  </div>
  `
};


  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
  }
}

module.exports = sendConfirmationEmail;
