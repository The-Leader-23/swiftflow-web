// functions/src/sendSwiftReports.ts
import { db } from './firebaseAdmin';
import { getEmailSettings } from './emailSettings';
import sgMail from '@sendgrid/mail';
import { defineSecret } from 'firebase-functions/params';

export const SENDGRID_API_KEY = defineSecret('SENDGRID_API_KEY');

function renderReportHTML(opts: {
  frequency: 'daily' | 'weekly';
  orderCount: number;
  totalRevenue: number;
  lowStock: string[];
}) {
  const { frequency, orderCount, totalRevenue, lowStock } = opts;
  return `
    <div style="font-family: Inter, -apple-system, Segoe UI, Roboto, Arial, sans-serif; line-height:1.6; color:#111;">
      <h2>📊 Your ${frequency} SwiftFlow summary</h2>
      <p><strong>Orders:</strong> ${orderCount}</p>
      <p><strong>Total Revenue:</strong> R${totalRevenue.toFixed(2)}</p>
      ${lowStock.length ? `<p><strong>⚠️ Low Stock:</strong> ${lowStock.join(', ')}</p>` : '<p>✅ All stock levels are healthy</p>'}
    </div>`;
}

export async function sendSwiftReports(frequency: 'daily' | 'weekly') {
  // use the secret (index.ts attaches it via `secrets: [...]`)
  sgMail.setApiKey(SENDGRID_API_KEY.value());

  const usersSnap = await db.collection('users').get();

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() - (frequency === 'weekly' ? 7 : 1));
  cutoff.setHours(0, 0, 0, 0);

  for (const userDoc of usersSnap.docs) {
    const userId = userDoc.id;
    const settings = await getEmailSettings(userId);
    if (!settings?.enabled || settings.frequency !== frequency) continue;

    const userEmail = settings.recipient || (userDoc.get('email') as string) || '';
    if (!userEmail) continue;

    const [ordersSnap, financeSnap, productsSnap] = await Promise.all([
      db.collection('users').doc(userId).collection('orders').where('timestamp', '>=', cutoff).get(),
      db.collection('users').doc(userId).collection('finance').where('timestamp', '>=', cutoff).get(),
      db.collection('users').doc(userId).collection('products').get(),
    ]);

    const orderCount = ordersSnap.size;

    let totalRevenue = 0;
    financeSnap.forEach((d) => {
      const data = d.data() as { type?: string; amount?: number };
      if (data.type === 'income') totalRevenue += Number(data.amount || 0);
    });

    const lowStock: string[] = [];
    productsSnap.forEach((d) => {
      const data = d.data() as { name?: string; stock?: number };
      if (Number(data.stock || 0) <= 3) lowStock.push(String(data.name || 'Unnamed item'));
    });

    await sgMail.send({
      to: userEmail,
      from: { email: 'no-reply@swiftflow.world', name: 'SwiftFlow Reports' },
      subject: `🧾 SwiftFlow ${frequency === 'daily' ? 'Daily' : 'Weekly'} Report`,
      html: renderReportHTML({ frequency, orderCount, totalRevenue, lowStock }),
      // replyTo: 'support@swiftflow.world', // optional
    });
  }
}

