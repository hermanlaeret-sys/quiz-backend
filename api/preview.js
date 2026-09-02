import { createClient } from "@supabase/supabase-js";

var supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://byauline.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  var email = req.query.email;
  if (!email || email.indexOf('@') < 0) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  var result = await supabase
    .from('quiz_sessions')
    .select('quiz_type, scores, created_at')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (result.error || !result.data) {
    return res.status(404).json({ error: 'Not found' });
  }

  return res.status(200).json({ session: result.data });
}
