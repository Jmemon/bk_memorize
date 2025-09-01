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

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const { data: existing } = await supabase
      .from('accounts')
      .select('id')
      .eq('username', username)
      .single();

    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Create user with Supabase Auth
    const email = `${username.toLowerCase()}@flashcards.local`;
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { username },
      email_confirm: true
    });

    if (authError) {
      throw authError;
    }

    // Create account record
    const passwordHash = await bcrypt.hash(password, 12);
    const { error: accountError } = await supabase
      .from('accounts')
      .insert({
        id: authUser.user.id,
        username,
        password_hash: passwordHash
      });

    if (accountError) {
      throw accountError;
    }

    // Generate JWT token
    const token = generateToken({
      userId: authUser.user.id,
      username
    });

    res.json({
      success: true,
      token,
      user: { username }
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: error.message || 'Signup failed' });
  }
};