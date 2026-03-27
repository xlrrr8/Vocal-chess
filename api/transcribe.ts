import type { VercelRequest, VercelResponse } from '@vercel/node';

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY not configured on server' });
  }

  try {
    // Forward the multipart/form-data request to Groq
    const groqResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': req.headers['content-type'] as string,
      },
      // Since it's a serverless function, we need to handle the body correctly.
      // Vercel's node runtime provides the body, but for multipart it's easier 
      // to just pass through if using an edge function, but for standard node 
      // we'll need to handle the buffer.
      body: req.body,
    });

    const data = await groqResponse.json();
    return res.status(groqResponse.status).json(data);
  } catch (error) {
    console.error('Proxy Error:', error);
    return res.status(500).json({ error: 'Failed to proxy request to Groq' });
  }
}

export default handler;
