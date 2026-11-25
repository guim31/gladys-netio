// -----------------------------------------------------------------------------
// Entry point of the Netio integration: SDK wiring only.
//
// Everything else lives in src/app.js (handlers, refresh cycle, commands),
// src/netio/ (JSON API client and parser), src/devices.js (what Gladys
// receives), src/widgets.js (the dashboard widget).
//
// Environment variables provided by the Gladys supervisor to the container:
// GLADYS_HOST_API_URL, GLADYS_INTEGRATION_TOKEN, GLADYS_INTEGRATION_SELECTOR
// (read by the SDK), LOG_LEVEL.
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { createApp } from './src/app.js';

const gladys = new GladysIntegration();
const app = createApp({ gladys });

// Handlers are registered before connect().
app.register();

gladys.handleShutdown(async (signal) => {
  logger.info(`Received ${signal}: stopping`);
  await app.stop();
});

logger.info('Starting the Netio integration');
gladys.connect().catch((err) => {
  logger.error(`Initial connection to Gladys failed (${err.message})`);
  process.exit(1);
});
