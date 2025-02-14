import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins
  },
});

// Supabase Connection
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(express.json());

// Function to Create Tables If They Don't Exist
async function createTables() {
  await supabase.rpc("create_users_table");
  await supabase.rpc("create_messages_table");
}

// Create Users Table
async function createUsersTable() {
  const { error } = await supabase.rpc("create_users_table", {});
  if (error) console.error("Error creating users table:", error);
}

// Create Messages Table
async function createMessagesTable() {
  const { error } = await supabase.rpc("create_messages_table", {});
  if (error) console.error("Error creating messages table:", error);
}

// Sign Up
app.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;

  // Check if the user already exists
  const { data: existingUser } = await supabase
    .from("users")
    .select("*")
    .or(`username.eq.${username},email.eq.${email}`);

  if (existingUser.length > 0) {
    return res.status(400).json({ error: "Username or email already exists" });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Insert new user
  const { data, error } = await supabase
    .from("users")
    .insert([{ username, email, password: hashedPassword }]);

  if (error) return res.status(500).json({ error: error.message });

  res.status(201).json({ message: "User created successfully" });
});

// Log In
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  // Find user
  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("username", username)
    .single();

  if (error || !user) return res.status(400).json({ error: "Invalid credentials" });

  // Compare password
  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) return res.status(400).json({ error: "Invalid credentials" });

  res.json({ message: "Login successful", username: user.username });
});

// WebSocket Connection
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Handle incoming messages
  socket.on("sendMessage", async (data) => {
    const { sender, message } = data;

    // Store message in Supabase
    const { error } = await supabase.from("messages").insert([{ sender, message }]);

    if (error) {
      console.error("Error saving message:", error);
      return;
    }

    // Send message to all connected clients
    io.emit("receiveMessage", { sender, message });
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
  });
});

// Start server
const port = process.env.PORT || 3000;
server.listen(port, async () => {
  console.log(`Server running on port ${port}`);
  await createUsersTable();
  await createMessagesTable();
});
