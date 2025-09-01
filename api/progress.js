const supabase = require('../lib/supabase');
const { requireAuth } = require('../lib/auth');

module.exports = async (req, res) => {
  try {
    // Verify authentication
    const user = requireAuth(req);

    if (req.method === 'GET') {
      // Get user progress
      const { data: progress, error } = await supabase
        .from('user_progress')
        .select(`
          *,
          flashcards!inner(card_index),
          flashcard_sets!inner(set_id)
        `)
        .eq('user_id', user.userId);

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

    } else if (req.method === 'POST') {
      // Save user progress
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
            .eq('user_id', user.userId)
            .eq('card_id', card.id)
            .single();

          const prevTimesSeen = existingProgress?.times_seen || 0;
          const prevTimesCorrect = existingProgress?.times_correct || 0;

          await supabase
            .from('user_progress')
            .upsert({
              user_id: user.userId,
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

    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    if (error.message.includes('token') || error.message.includes('authorization')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    console.error('Error with progress:', error);
    res.status(500).json({ error: 'Failed to handle progress request' });
  }
};