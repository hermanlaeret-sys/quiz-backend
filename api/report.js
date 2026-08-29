import { createClient } from "@supabase/supabase-js";

var supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Access-Control-Allow-Origin", "https://byauline.com");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  var orderId = req.query.order_id;
  var token = req.query.token;

  if (!orderId && !token) {
    return res.status(400).json({ error: "order_id or token required" });
  }

  var query = supabase.from("reports").select("quiz_type, report_html, created_at");

  if (orderId) {
    query = query.eq("order_id", orderId);
  } else {
    query = query.eq("token", token);
  }

  var result = await query.single();

  if (result.error || !result.data) {
    return res.status(404).json({ error: "Report not found" });
  }

  return res.status(200).json({ report: result.data });
}
