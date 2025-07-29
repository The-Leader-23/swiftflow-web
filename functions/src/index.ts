import { setGlobalOptions } from 'firebase-functions/v2';
import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { sendSwiftReport } from './sendSwiftReports';

setGlobalOptions({ maxInstances: 10 });

// 🔁 Manual test function
export const helloWorld = onRequest((request, response) => {
  logger.info('Hello from Firebase logs!', { structuredData: true });
  response.send('Hello from Firebase!');
});

// 🧠 Automated Swift Weekly Email (runs every Sunday @ 7AM)
export { sendSwiftReport };
