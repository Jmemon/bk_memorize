const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase with service role key (server-side only)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files from current directory

// In-memory sessions (use Redis in production)
const sessions = new Map();

// Utility functions
function generateSessionToken() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

async function hashPassword(password) {
  return await bcrypt.hash(password, 12);
}

async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

// Auth endpoints
app.post('/api/auth/signup', async (req, res) => {
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
    const passwordHash = await hashPassword(password);
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

    // Create session
    const sessionToken = generateSessionToken();
    sessions.set(sessionToken, {
      userId: authUser.user.id,
      username,
      createdAt: new Date()
    });

    res.json({
      success: true,
      token: sessionToken,
      user: { username }
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: error.message || 'Signup failed' });
  }
});

app.post('/api/auth/signin', async (req, res) => {
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
    const isValid = await verifyPassword(password, account.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create session
    const sessionToken = generateSessionToken();
    sessions.set(sessionToken, {
      userId: account.id,
      username: account.username,
      createdAt: new Date()
    });

    res.json({
      success: true,
      token: sessionToken,
      user: { username: account.username }
    });

  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ error: 'Signin failed' });
  }
});

app.post('/api/auth/signout', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      sessions.delete(token);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Signout failed' });
  }
});

// Middleware to check authentication
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const session = sessions.get(token);
  
  if (!session) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  req.user = session;
  next();
}

// Flashcard endpoints
app.get('/api/flashcards', requireAuth, async (req, res) => {
  try {
    const { data: cards, error } = await supabase
      .from('flashcards')
      .select(`
        *,
        flashcard_sets!inner(id, set_id)
      `)
      .order('card_index');

    if (error) throw error;

    // Organize cards by set
    const flashcardData = { chain: [], chapters: [] };
    
    cards?.forEach(card => {
      const setId = card.flashcard_sets.set_id;
      if (flashcardData[setId]) {
        flashcardData[setId].push({
          front: card.front,
          back: card.back,
          index: card.card_index
        });
      }
    });

    res.json(flashcardData);

  } catch (error) {
    console.error('Error loading flashcards:', error);
    res.status(500).json({ error: 'Failed to load flashcards' });
  }
});

app.get('/api/progress', requireAuth, async (req, res) => {
  try {
    const { data: progress, error } = await supabase
      .from('user_progress')
      .select(`
        *,
        flashcards!inner(card_index),
        flashcard_sets!inner(set_id)
      `)
      .eq('user_id', req.user.userId);

    if (error) throw error;

    // Format progress data
    const formattedProgress = {};
    progress?.forEach(p => {
      const setId = p.flashcard_sets.set_id;
      if (!formattedProgress[setId]) {
        formattedProgress[setId] = { correct: [], seen: [] };
      }
      const cardIndex = p.flashcards.card_index;
      formattedProgress[setId].seen.push(cardIndex);
      if (p.is_correct) {
        formattedProgress[setId].correct.push(cardIndex);
      }
    });

    res.json(formattedProgress);

  } catch (error) {
    console.error('Error fetching progress:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

app.post('/api/progress', requireAuth, async (req, res) => {
  try {
    const { setId, stats } = req.body;
    
    // Get set UUID
    const { data: sets, error: setError } = await supabase
      .from('flashcard_sets')
      .select('id')
      .eq('set_id', setId)
      .single();

    if (setError || !sets) {
      return res.status(400).json({ error: `Set ${setId} not found` });
    }

    // Get flashcards for this set
    const { data: flashcards, error: cardsError } = await supabase
      .from('flashcards')
      .select('id, card_index')
      .eq('set_id', sets.id);

    if (cardsError) {
      throw cardsError;
    }

    // Update progress for each card
    for (const card of flashcards) {
      const cardIndex = card.card_index;
      const isCorrect = stats.correct.includes(cardIndex);
      const wasSeen = stats.seen.includes(cardIndex);

      if (wasSeen) {
        // Get existing progress
        const { data: existingProgress } = await supabase
          .from('user_progress')
          .select('times_seen, times_correct')
          .eq('user_id', req.user.userId)
          .eq('card_id', card.id)
          .single();

        const prevTimesSeen = existingProgress?.times_seen || 0;
        const prevTimesCorrect = existingProgress?.times_correct || 0;

        await supabase
          .from('user_progress')
          .upsert({
            user_id: req.user.userId,
            set_id: sets.id,
            card_id: card.id,
            is_correct: isCorrect,
            times_seen: prevTimesSeen + 1,
            times_correct: prevTimesCorrect + (isCorrect ? 1 : 0),
            last_seen: new Date().toISOString()
          }, {
            onConflict: 'user_id,card_id'
          });
      }
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Error saving progress:', error);
    res.status(500).json({ error: 'Failed to save progress' });
  }
});

// Clean up old sessions periodically
setInterval(() => {
  const now = new Date();
  for (const [token, session] of sessions.entries()) {
    // Remove sessions older than 24 hours
    if (now - session.createdAt > 24 * 60 * 60 * 1000) {
      sessions.delete(token);
    }
  }
}, 60 * 60 * 1000); // Run every hour

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📚 Flashcard app available at http://localhost:${PORT}`);
});