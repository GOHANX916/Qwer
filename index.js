import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(cors());
app.use(express.json());

// User Sign-Up
app.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const { data, error } = await supabase.from("users").insert([
    { username, email, password: hashedPassword }
  ]);

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ message: "User registered successfully!", data });
});

// User Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  
  const { data, error } = await supabase.from("users").select("*").eq("username", username).single();
  if (error || !data) return res.status(400).json({ error: "Invalid username or password" });

  const isMatch = await bcrypt.compare(password, data.password);
  if (!isMatch) return res.status(400).json({ error: "Invalid username or password" });

  res.json({ message: "Login successful", user: data });
});

// WebSocket for Real-Time Chat
io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("sendMessage", async ({ sender, message }) => {
    const { data, error } = await supabase.from("messages").insert([
      { sender, message }
    ]);
    if (error) return;
    io.emit("receiveMessage", { sender, message });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
