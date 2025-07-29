import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import nodemailer from 'nodemailer';

admin.initializeApp();
const db = admin.firestore();

// Gmail SMTP transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'your-email@gmail.com',
    pass: 'your-app-password', // Use App Password from Google Security
  },
});

// Export the function
export const sendSwiftReport = onSchedule(
  {
    schedule: 'every sunday 07:00',
    timeZone: 'Africa/Johannesburg',
  },
  async (event) => {
    const start = new Date();
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);

    const ordersSnap = await db
      .collection('orders')
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(start))
      .get();

    let total = 0;
    const salesMap: Record<string, number> = {};

    ordersSnap.forEach((doc) => {
      const data = doc.data();
      total += data.totalPrice || 0;
      salesMap[data.productName] = (salesMap[data.productName] || 0) + data.quantity;
    });

    const best = Object.entries(salesMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

    const lowStockSnap = await db.collection('products').get();
    const lowStockItems = lowStockSnap.docs
      .filter((doc) => (doc.data().stock || 0) <= 3)
      .map((doc) => doc.data().name);

    const html = `
      <h1>📩 Swift Weekly Report</h1>
      <p><strong>Total Revenue:</strong> R${total}</p>
      <p><strong>Top Product:</strong> ${best}</p>
      <p><strong>Low Stock Items:</strong> ${lowStockItems.join(', ') || 'None'}</p>
    `;

    await transporter.sendMail({
      from: 'SwiftMind <your-email@gmail.com>',
      to: 'youremail@yourdomain.com',
      subject: '📊 Your Weekly Swift Report',
      html,
    });

    console.log('✅ Swift Report sent!');
  }
);

