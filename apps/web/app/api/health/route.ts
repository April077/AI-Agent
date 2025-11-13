// app/api/health/route.ts

export const dynamic = 'force-dynamic';

export async function GET() {
  const healthData = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    nextjs: {
      version: '15.5.4',
      ready: true,
    },
    env_check: {
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ? '✓ set' : '✗ missing',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? '✓ set' : '✗ missing',
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? '✓ set' : '✗ missing',
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? '✓ set' : '✗ missing',
    },
    memory: {
      used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
    },
  };

  console.log('Health check called:', healthData);

  return Response.json(healthData, { 
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}