import { bridgeRequest, bridgeUrl } from './app/connection.ts';
import { normalizeBridgeState } from './app/bridge-state.ts';

const originalFetch = globalThis.fetch;
globalThis.fetch = async (...args) => {
  const started = Date.now();
  const response = await originalFetch(...args);
  const location = response.headers.get('location');
  console.log(JSON.stringify({ status: response.status, elapsedMs: Date.now() - started, host: new URL(args[0]).hostname,
    redirectHost: location ? new URL(location, args[0]).hostname : null }));
  return response;
};
try {
  if (process.argv[2]) {
    const access = await bridgeRequest(await bridgeUrl(), { action: 'check_access', email: process.argv[2] });
    console.log(JSON.stringify({ accessCheck: true, allowed: access.allowed === true }));
    if (access.allowed !== true) throw new Error('The test account is not approved for this portal.');
  }
  const data = normalizeBridgeState(await bridgeRequest(await bridgeUrl(), { action: 'get_state' }));
  const validState = ['mentors', 'programTypes', 'boys', 'programs', 'attendance', 'invitations', 'calendarEvents'].every(key => Array.isArray(data[key]))
    && !!data.websiteContent && typeof data.websiteContent === 'object' && !Array.isArray(data.websiteContent)
    && !!data.websiteSettings && typeof data.websiteSettings === 'object' && !Array.isArray(data.websiteSettings)
    && typeof data.refreshedAt === 'string';
  console.log(JSON.stringify({ passed: validState, validState }));
  if (!validState) process.exitCode = 1;
} catch (error) {
  const safeMessage = String(error.message).replaceAll(process.env.MENTORING_SHEETS_TOKEN || '\0', '[private token]').replaceAll(process.env.MENTORING_SHEETS_URL || '\0', '[private URL]').replace(/https?:\/\/\S+/g, '[private URL]');
  console.log(JSON.stringify({ passed: false, errorType: error.name,
    networkCode: error.cause?.code, message: safeMessage,
    category: /deploy|permission|denied/i.test(error.message) ? 'deployment/access' : /HTTP/.test(error.message) ? error.message.match(/HTTP \d+/)?.[0] : /fetch failed/.test(error.message) ? 'network' : 'bridge response' }));
  process.exitCode = 1;
}
