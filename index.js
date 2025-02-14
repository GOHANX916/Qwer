require("dotenv").config();
const WebSocket = require("ws");
const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());
const server = app.listen(process.env.PORT || 10000, () => {
    console.log(`Server running on port ${server.address().port}`);
    console.log("WebSocket server is live and accepting connections...");
});

const wss = new WebSocket.Server({ server });

// Supabase connection
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// User signup
app.post("/signup", async (req, res) => {
    const { email, password, username } = req.body;
    
    // Check if username already exists
    const { data: existingUser } = await supabase
        .from("users")
        .select("username")
        .eq("username", username)
        .single();
    
    if (existingUser) return res.status(400).json({ error: "Username already taken" });
    
    const { user, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } }
    });
    
    if (error) return res.status(400).json({ error: error.message });
    
    // Save user details to database
    await supabase.from("users").insert([{ email, username }]);
    
    res.status(200).json({ message: "Signup successful! Check your email to confirm." });
});

// User login
app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    
    // Get user by username
    const { data: user, error } = await supabase
        .from("users")
        .select("email")
        .eq("username", username)
        .single();
    
    if (!user) return res.status(400).json({ error: "Invalid username or password" });
    
    // Log in with email
    const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password
    });
    
    if (loginError) return res.status(400).json({ error: loginError.message });
    
    res.status(200).json({ message: "Login successful!", token: data.session.access_token, username });
});

wss.on("connection", async (ws, req) => {
    console.log("New client connected");

    ws.on("message", async (message) => {
        const data = JSON.parse(message);
        console.log(`Received from ${data.sender}: ${data.content}`);

        // Save message to Supabase
        const { error } = await supabase.from("messages").insert([
            { sender: data.sender, content: data.content }
        ]);

        if (error) {
            console.error("Error saving message to Supabase:", error);
        }

        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
            }
        });
    });

    ws.on("close", () => console.log("Client disconnected"));
});
