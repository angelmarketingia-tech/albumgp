export function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnv } = require('./lib/env/validate');
    validateEnv();
  }
}
