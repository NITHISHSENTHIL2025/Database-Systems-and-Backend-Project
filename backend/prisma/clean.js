import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%'`);
  const names = rows.map(row => `"${String(row.tablename).replaceAll('"','""')}"`);
  if (names.length) await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${names.join(', ')} RESTART IDENTITY CASCADE`);
  console.log(`Cleared ${names.length} application tables. Schema kept intact.`);
}

main().catch(error=>{console.error(error);process.exit(1)}).finally(async()=>prisma.$disconnect());
