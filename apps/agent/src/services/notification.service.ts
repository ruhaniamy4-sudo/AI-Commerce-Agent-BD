import nodemailer from "nodemailer";

export const sendEmail = async (to: string[], subject: string, text: string, html?: string) => {
    try {
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.warn("⚠️ Email credentials missing. Skipping email notification.");
            return;
        }

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: to.join(", "),
            subject,
            text,
            html,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`📧 Email sent: ${info.messageId}`);
    } catch (error) {
        console.error("❌ Error sending email:", error);
    }
};
