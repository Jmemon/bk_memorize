const bcrypt = require('bcryptjs');
const supabase = require('../../lib/supabase');
const { generateToken } = require('../../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Get account from database
    const { data: account, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !account) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, account.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = generateToken({
      userId: account.id,
      username: account.username
    });

    res.json({
      success: true,
      token,
      user: { username: account.username }
    });

  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ error: 'Signin failed' });
  }
};