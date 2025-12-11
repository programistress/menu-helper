import 'dotenv/config';
import { testDatabaseConnection, pool } from '../server/db.js';

async function runTest() {
    console.log('🔌 Testing database connection...\n');
    
    // Check if DATABASE_URL is set
    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL is not set in .env file');
        process.exit(1);
    }
    
    console.log('✅ DATABASE_URL is configured');
    console.log(`📊 NODE_ENV: ${process.env.NODE_ENV || 'not set'}\n`);
    
    // Test connection
    const isConnected = await testDatabaseConnection();
    
    if (isConnected) {
        console.log('\n🎉 Database connection successful!');
        console.log('\nNext steps:');
        console.log('  1. Run: npm run db:push');
        console.log('  2. Run: npm run db:studio (to view tables)');
    } else {
        console.error('\n❌ Database connection failed');
        console.log('\nCheck:');
        console.log('  1. Is your DATABASE_URL correct?');
        console.log('  2. Is Neon project active (not suspended)?');
        console.log('  3. Is SSL enabled? (add ?sslmode=require)');
    }
    
    // Close pool
    await pool.end();
}

runTest().catch(console.error);

