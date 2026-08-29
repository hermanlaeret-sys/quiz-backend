export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://byauline.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  var email = req.query.email;
  if (!email || email.indexOf('@') < 0) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  await fetch('https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Klaviyo-API-Key ' + process.env.KLAVIYO_PRIVATE_KEY,
      'revision': '2024-02-15'
    },
    body: JSON.stringify({data:{
      type: 'profile-subscription-bulk-create-job',
      attributes: {profiles:{data:[{
        type: 'profile',
        attributes: {
          email: email,
          subscriptions: {email:{marketing:{consent:'SUBSCRIBED'}}}
        }
      }]}},
      relationships: {list:{data:{type:'list',id:'Ygn22q'}}}
    }})
  });

  return res.status(200).json({ ok: true });
}
