const express = require('express');
require('dotenv').config();

const app = express();

app.use(express.json());
app.use(express.static('.'));

// Load API routes
const signup = require('./api/auth/signup.js');
const signin = require('./api/auth/signin.js'); 
const signout = require('./api/auth/signout.js');
const flashcards = require('./api/flashcards.js');
const progress = require('./api/progress.js');

app.use('/api/auth/signup', signup);
app.use('/api/auth/signin', signin);
app.use('/api/auth/signout', signout);
app.use('/api/flashcards', flashcards);
app.use('/api/progress', progress);

app.listen(3000, () => {
  console.log('🚀 Development server running on http://localhost:3000');
  console.log('📚 Testing Vercel-ready serverless functions locally');
});