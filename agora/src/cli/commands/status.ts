export async function statusCommand(options: { port: string }): Promise<void> {
  const port = parseInt(options.port, 10);
  const url = `http://localhost:${port}/health`;

  try {
    const response = await fetch(url);
    const data = await response.json() as Record<string, unknown>;

    if (response.ok && data.status === 'ok') {
      console.log(`AGORA server is running on port ${port}`);
      console.log(`  Status: ${data.status}`);
    } else {
      console.log(`AGORA server responded with unexpected status:`, data);
    }
  } catch {
    console.error(`AGORA server is not running on port ${port}`);
    process.exit(1);
  }
}
