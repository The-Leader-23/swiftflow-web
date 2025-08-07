'use client';

import { useState, useEffect } from 'react';
import { getEmailSettings, updateEmailSettings } from '@/lib/emailSettings';

export default function EmailSettings({ userId }: { userId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'off'>('daily');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEmailSettings(userId).then((settings) => {
      if (settings) {
        setEnabled(settings.enabled ?? false);
        setRecipient(settings.recipient ?? '');
        setFrequency(settings.frequency ?? 'daily');
      }
      setLoading(false);
    });
  }, [userId]);

  const saveSettings = async () => {
    await updateEmailSettings(userId, {
      enabled,
      recipient,
      frequency,
    });
    alert('✅ Email settings saved!');
  };

  if (loading) return <p>Loading settings...</p>;

  return (
    <div className="mt-8 p-6 border rounded-lg bg-white shadow space-y-4">
      <h2 className="text-xl font-bold">📧 Email Report Settings</h2>

      <label className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <span>Enable Email Reports</span>
      </label>

      <input
        type="email"
        value={recipient}
        onChange={(e) => setRecipient(e.target.value)}
        placeholder="Enter recipient email"
        className="w-full p-2 border rounded text-black"
      />

      <div>
        <label className="font-medium block mb-1">Report Frequency</label>
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as any)}
          className="w-full p-2 border rounded text-black"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="off">Off</option>
        </select>
      </div>

      <button
        onClick={saveSettings}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Save Settings
      </button>
    </div>
  );
}

