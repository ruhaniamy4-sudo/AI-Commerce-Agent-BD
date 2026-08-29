const url = process.env.AGENT_HEALTH_URL || 'http://localhost:4000/health';
try {
  const response = await fetch(url);
  const health = await response.json();
  console.log(JSON.stringify(health, null, 2));
  if (!response.ok) process.exitCode = 1;
} catch (error) {
  console.error(`Health check failed for ${url}: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
