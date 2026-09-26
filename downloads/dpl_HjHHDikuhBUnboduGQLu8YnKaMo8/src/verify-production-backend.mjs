// Opt-in read-only verification. Never print credentials or returned records.
if (process.env.MENTORING_VERIFY_URL && process.env.MENTORING_VERIFY_EMAIL) {
  let stage = 'configuration';
  try {
    const { bridgeRequest, bridgeUrl } = await import('./app/connection.ts');
    const { normalizeBridgeState } = await import('./app/bridge-state.ts');
    const url = await bridgeUrl();
    if (url !== process.env.MENTORING_VERIFY_URL.trim()) throw new Error('URL mismatch');
    stage = 'authorized read';
    const started = Date.now();
    const result = await bridgeRequest(url, {
      action: 'check_access', email: process.env.MENTORING_VERIFY_EMAIL, includeState: true,
    });
    if (result.allowed !== true) { stage = 'account approval'; throw new Error('Access denied'); }
    if (!result.state) { stage = 'combined-request backend version'; throw new Error('Old backend'); }
    stage = 'response validation';
    const state = normalizeBridgeState(result.state);
    if (!['mentors', 'boys', 'programs', 'programTypes', 'attendance', 'invitations', 'calendarEvents'].every(key => Array.isArray(state[key]))) throw new Error('Invalid state');
    console.log(JSON.stringify({ backendVerification: 'passed', configuredUrlMatches: true, combinedAuthorizedRead: true, elapsedMs: Date.now() - started, recordsModified: false }));
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const reason = /Unauthorized request/i.test(message) ? 'Backend rejected the connection token'
      : /Missing Sheet tab|Missing sheet/i.test(message) ? 'Required spreadsheet tab is missing'
      : /Connection key is not configured/i.test(message) ? 'Vercel connection token is missing'
      : /permission|access denied|Google denied access/i.test(message) ? 'Deployment or spreadsheet access denied'
      : /HTTP [0-9]{3}/.test(message) ? message.match(/HTTP [0-9]{3}/)[0]
      : /timed out|timeout/i.test(message) ? 'Request timed out'
      : /Invalid argument: id|Unexpected error.*openById/i.test(message) ? 'Spreadsheet ID is missing or inaccessible'
      : /Deploy as a Web app/i.test(message) ? 'Apps Script deployment is not accessible as a web app'
      : 'Backend response failed validation';
    console.error(JSON.stringify({ backendVerification: 'failed', stage, reason }));
    process.exitCode = 1;
  }
}
