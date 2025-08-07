import { db } from "./firebaseAdmin"; // this is now admin.firestore()
import { getEmailSettings, updateEmailSettings } from './emailSettings';

// ✅ Replace this with your real email service later (like Resend or SendGrid)
async function sendEmail(to: string, subject: string, html: string) {
  console.log(`📨 Sending email to ${to}: ${subject}`);
  console.log(html);
  // Here you'd call your actual email sending API
}

export async function sendSwiftReports(frequency: "daily" | "weekly") {
  const usersSnap = await db.collection("users").get();

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() - (frequency === "weekly" ? 7 : 1));
  cutoff.setHours(0, 0, 0, 0);

  for (const userDoc of usersSnap.docs) {
    const userId = userDoc.id;
    const settings = await getEmailSettings(userId);

    if (!settings?.enabled || settings.frequency !== frequency) continue;

    const ordersSnap = await db
      .collection("users")
      .doc(userId)
      .collection("orders")
      .where("timestamp", ">=", cutoff)
      .get();

    const financeSnap = await db
      .collection("users")
      .doc(userId)
      .collection("finance")
      .where("timestamp", ">=", cutoff)
      .get();

    const productsSnap = await db
      .collection("users")
      .doc(userId)
      .collection("products")
      .get();

    const orderCount = ordersSnap.size;
    let totalRevenue = 0;
    financeSnap.forEach((doc) => {
      const data = doc.data();
      if (data.type === "income") {
        totalRevenue += data.amount || 0;
      }
    });

    const lowStock: string[] = [];
    productsSnap.forEach((doc) => {
      const data = doc.data();
      if ((data.stock || 0) <= 3) {
        lowStock.push(data.name);
      }
    });

    const subject = `🧾 SwiftFlow ${frequency === "daily" ? "Daily" : "Weekly"} Report`;
    const html = `
      <h2>📊 Your ${frequency} summary is here!</h2>
      <p><strong>Orders:</strong> ${orderCount}</p>
      <p><strong>Total Revenue:</strong> R${totalRevenue}</p>
            ${
  lowStock.length > 0 ?
    `<p><strong>⚠️ Low Stock:</strong> ${lowStock.join(", ")}</p>` :
    "<p>✅ All stock levels are healthy</p>"
}
      <br/>
      <p>— Your SwiftFlow AI Assistant 🚀</p>
    `;

    await sendEmail(settings.recipient, subject, html);
  }

  console.log("✅ Swift reports sent");
}

