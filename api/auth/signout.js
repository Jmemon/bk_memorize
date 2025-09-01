module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // With JWT, signout is handled client-side by removing the token
  // No server-side session to invalidate
  res.json({ success: true });
};