#!/usr/bin/env node

// Simple script to generate a secure API key for the worker service

const crypto = require('crypto');

const apiKey = crypto.randomBytes(32).toString('hex');

console.log('\n===========================================');
console.log('   CF Monitor Worker - API Key Generator');
console.log('===========================================\n');
console.log('Generated API Key:');
console.log('\x1b[32m%s\x1b[0m', apiKey);
console.log('\n⚠️  IMPORTANT:');
console.log('1. Save this key securely');
console.log('2. Add to Railway environment variables as AGENT_API_KEY');
console.log('3. Add to main app environment variables as AGENT_API_KEY');
console.log('4. Never commit this key to version control\n');
console.log('===========================================\n');
