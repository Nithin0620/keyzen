// Example 1: Direct SDK consumption
import { Keyzen } from '@keyzen/node';

async function main() {
  console.log('--- Method 1: Using Keyzen SDK directly ---');
  
  // Initialize with Service Token
  const keyzen = new Keyzen({
    token: process.env.KEYZEN_TOKEN || 'kzn_dev_sample_token',
    endpoint: process.env.KEYZEN_ENDPOINT || 'http://localhost:4000',
  });

  try {
    // Inject all environment variables straight into process.env in-memory
    await keyzen.injectEnv();
    console.log('✅ Secrets injected into process.env in-memory!');
  } catch (err) {
    console.log('ℹ Note: Keyzen server connection attempted.');
  }

  // Example 2: Accessing variables injected via CLI `keyzen run -- node index.js`
  console.log('\n--- Method 2: Zero-Code Zero-Disk Injection (via `keyzen run`) ---');
  console.log('STRIPE_KEY present in process.env:', Boolean(process.env.STRIPE_SECRET_KEY));
  console.log('DATABASE_URL present in process.env:', Boolean(process.env.DATABASE_URL));
}

main();
