import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

var supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

var anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function verifyWebhook(body, hmacHeader) {
  var hash = crypto
    .createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET)
    .update(body, "utf8")
    .digest("base64");
  return hash === hmacHeader;
}

function buildPrompt(quizType, scores) {
  if (quizType === "lifetrap") {
    var scoresText = Object.entries(scores)
      .map(function(e) { return e[0] + ": " + e[1] + "/5"; })
      .join("\n");
    return "You are a compassionate clinical psychologist writing a personal psychological report based on Schema Therapy lifetraps.\n\nThe person scored (1-5, higher = more active schema):\n" + scoresText + "\n\nWrite a detailed personal report in HTML. Include:\n1. A warm personal introduction (2 paragraphs)\n2. Their top 3-4 most active lifetraps with deep explanations of how each shows up in daily life\n3. How these patterns affect their relationships\n4. Practical healing steps for each lifetrap\n5. A compassionate closing message\n\nUse <h2> tags for section headings and <p> tags for paragraphs. Write 1800-2200 words. Be specific, warm, and personal.";
  }
  if (quizType === "mbti") {
    var mbtiType = scores.type || "INFJ";
    var dimText = Object.entries(scores)
      .filter(function(e) { return e[0] !== "type"; })
      .map(function(e) { return e[0] + ": " + e[1] + "%"; })
      .join("\n");
    return "You are a personality psychologist writing a personal MBTI report for a " + mbtiType + ".\n\nDimension scores:\n" + dimText + "\n\nWrite a detailed personal report in HTML. Include:\n1. A personal introduction to their " + mbtiType + " personality (2 paragraphs)\n2. How they think and process the world\n3. Relationships: strengths and growth areas\n4. Work and career environments where they thrive\n5. Their unique strengths\n6. Areas for personal growth\n7. A personal closing message\n\nUse <h2> tags for headings and <p> tags for paragraphs. Write 1800-2200 words.";
  }
  if (quizType === "bigfive") {
    var b5Text = Object.entries(scores)
      .map(function(e) { return e[0] + ": " + e[1] + "/100"; })
      .join("\n");
    return "You are a personality psychologist writing a personal Big Five personality report.\n\nBig Five scores (0-100):\n" + b5Text + "\n\nWrite a detailed personal report in HTML. Include:\n1. Their overall personality portrait (2 paragraphs)\n2. Each of the five dimensions explained personally\n3. How this profile shapes their relationships\n4. Career strengths and ideal work environments\n5. Personal growth opportunities\n6. A warm closing message\n\nUse <h2> tags for headings and <p> tags for paragraphs. Write 1800-2200 words.";
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  var hmac = req.headers["x-shopify-hmac-sha256"];
  var rawBody = JSON.stringify(req.body);

  if (process.env.SHOPIFY_WEBHOOK_SECRET) {
    if (!verifyWebhook(rawBody, hmac)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  var order = req.body;
  var email = order.email;
  var orderId = String(order.id);

  var attrs = order.note_attributes || [];
  var quizType = null;
  var scoresRaw = null;
  for (var i = 0; i < attrs.length; i++) {
    if (attrs[i].name === "quiz_type") quizType = attrs[i].value;
    if (attrs[i].name === "quiz_scores") scoresRaw = attrs[i].value;
  }

  if (!quizType || !scoresRaw) {
    return res.status(200).json({ ok: true, message: "No quiz data" });
  }

  var scores;
  try {
    scores = JSON.parse(scoresRaw);
  } catch (e) {
    return res.status(200).json({ ok: true, message: "Invalid scores" });
  }

  var token = crypto
    .createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET || "depthly-secret")
    .update(orderId)
    .digest("hex")
    .substring(0, 24);

  var prompt = buildPrompt(quizType, scores);
  if (!prompt) {
    return res.status(200).json({ ok: true, message: "Unknown quiz type" });
  }

  try {
    var message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }]
    });

    var reportHtml = message.content[0].text;
    reportHtml = reportHtml.replace(/^```html\s*/i, '').replace(/\s*```$/, '').trim();

    var result = await supabase.from("reports").insert({
      token: token,
      order_id: orderId,
      quiz_type: quizType,
      scores: scores,
      report_html: reportHtml,
      email: email
    });

    if (result.error) throw result.error;

    return res.status(200).json({ ok: true, token: token });
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).json({ error: err.message });
  }
}
