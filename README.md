# Brothers Karamazov Flashcard Study App

A modern, interactive flashcard app for studying *The Brothers Karamazov* with AI-powered answer evaluation using Claude.

## Features

- 🔐 **Secure Authentication** - User accounts with progress tracking
- 🤖 **AI Answer Evaluation** - Claude AI provides intelligent feedback on answers
- 📊 **Progress Tracking** - Persistent progress across sessions
- 🎯 **Two Study Modes** - Random or sequential card order
- 📱 **Responsive Design** - Works on all devices
- 🎨 **Beautiful 3D UI** - Smooth animations and card flip effects
- ☁️ **Cloud Database** - Supabase backend with real-time sync

## Setup Instructions

### 1. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **Settings > API** and copy your:
   - Project URL
   - Anon/Public Key
3. Run the database migration:
   - Go to **SQL Editor** in Supabase dashboard
   - Copy and paste the contents of `supabase/migrations/001_initial_schema.sql`
   - Run the query

### 2. Edge Function Setup

1. Install Supabase CLI:
   ```bash
   brew install supabase/tap/supabase
   ```

2. Login and link your project:
   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   ```

3. Deploy the Edge Function:
   ```bash
   supabase functions deploy check-answer
   ```

4. Set your Anthropic API key as a secret:
   ```bash
   supabase secrets set ANTHROPIC_API_KEY=your_claude_api_key_here
   ```

### 3. Configure the App

1. Open `flashcard-app.html`
2. Replace the configuration values at the top:
   ```javascript
   const SUPABASE_URL = 'YOUR_SUPABASE_URL';
   const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
   ```

### 4. Get Anthropic API Key

1. Sign up at [console.anthropic.com](https://console.anthropic.com)
2. Generate an API key
3. Use it in step 2.4 above

## Deployment Options

### Option 1: Vercel (Recommended)
1. Push code to GitHub
2. Connect GitHub repo to Vercel
3. Deploy automatically

### Option 2: Netlify
1. Drag and drop the HTML file to [netlify.com](https://netlify.com)
2. Get instant deployment

### Option 3: GitHub Pages
1. Push to GitHub repository
2. Enable GitHub Pages in repository settings
3. Access via `username.github.io/repository-name`

### Option 4: Local Development
Simply open `flashcard-app.html` in a web browser. The app will work with localStorage fallback if Supabase isn't configured.

## File Structure

```
bk_memorize/
├── flashcard-app.html          # Main application file
├── README.md                   # This file
└── supabase/
    ├── functions/
    │   └── check-answer/
    │       └── index.ts        # Edge function for Claude API
    └── migrations/
        └── 001_initial_schema.sql # Database schema
```

## Usage

1. **Login/Signup**: Enter a username and password
2. **Choose Set**: Select either "Chain" or "Chapters" study set
3. **Study**: 
   - Read the question
   - Type your answer
   - Get AI feedback
   - Card auto-flips to show correct answer
   - Auto-advances after 3 seconds
4. **Track Progress**: View statistics on home screen

## Database Schema

- **accounts**: User authentication
- **flashcard_sets**: Study set metadata
- **flashcards**: Individual flashcard content
- **user_progress**: Per-user progress tracking
- **study_sessions**: Session statistics

## Security Features

- ✅ API keys secured in Supabase Edge Functions
- ✅ Row Level Security (RLS) policies
- ✅ No client-side API key exposure
- ✅ Secure authentication with Supabase Auth

## Customization

### Adding New Flashcard Sets
1. Add data to the `mockData` object in the HTML
2. Run the app - it will automatically sync to the database
3. Update the home screen buttons to reference new sets

### Modifying AI Evaluation
Edit the prompt in `supabase/functions/check-answer/index.ts` and redeploy:
```bash
supabase functions deploy check-answer
```

## Support

For issues or questions:
1. Check the browser console for error messages
2. Verify Supabase configuration
3. Ensure Edge Function is deployed
4. Confirm API keys are set correctly

## License

This project is for educational purposes. *The Brothers Karamazov* content is in the public domain.