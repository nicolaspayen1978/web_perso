// scripts/logEnvironment.js
console.log('🛠️ Build started...');
console.log(`🌍 VERCEL_ENV: ${process.env.VERCEL_ENV || 'undefined'}`);
console.log(`🌱 KV_MODE: ${process.env.KV_MODE || 'undefined'}`);
console.log(`🔧 NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);