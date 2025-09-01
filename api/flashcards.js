const supabase = require('../lib/supabase');
const { requireAuth } = require('../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify authentication
    const user = requireAuth(req);

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
    if (error.message.includes('token') || error.message.includes('authorization')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    console.error('Error loading flashcards:', error);
    res.status(500).json({ error: 'Failed to load flashcards' });
  }
};