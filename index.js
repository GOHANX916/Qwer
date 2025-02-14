require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Supabase Setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY. Check your environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('✅ Supabase connected successfully.');

// Sign Up Route
app.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const { user, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username }
    }
  });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.status(201).json({ message: 'Signup successful! Check your email to verify your account.', user });
});

// Login Route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  // Fetch user by username
  const { data: users, error: fetchError } = await supabase
    .from('users')
    .select('email')
    .eq('username', username)
    .single();

  if (fetchError || !users) {
    return res.status(400).json({ error: 'User not found.' });
  }

  // Sign in with email
  const { data, error } = await supabase.auth.signInWithPassword({
    email: users.email,
    password
  });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.status(200).json({ message: 'Login successful!', user: data.user });
});

// Server Health Check
app.get('/', (req, res) => {
  res.send('✅ Server is running successfully.');
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
