import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import app from "./app";
dotenv.config();


type Player = {
  id: string;
  name: string | null;
  color: number; // Hex color for tint
  x: number;
  y: number;
  dir: "up" | "down" | "left" | "right";
  status: "active" | "idle";
  lastSeen: number;
  lastSeq: number;
  isMoving: boolean;
  emote: string | null;
  emoteUntil: number;
  lastEmoteTime: number;
  state: "idle" | "walk" | "dance";
  danceType: string | null;
};

const users = new Map<string, Player>();
const PORT = process.env.PORT || 5000;
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket) => {
  console.log("🟢 socket connected:", socket.id);

  // user joins immediately
  const player: Player = {
    id: socket.id,
    name: null,
    color: Math.floor(Math.random() * 16777215), // Random hex color
    x: 200 + Math.random() * 300,
    y: 200 + Math.random() * 300,
    dir: "down",
    status: "active",
    lastSeen: Date.now(),
    lastSeq: 0,
    isMoving: false,
    emote: null,
    emoteUntil: 0,
    lastEmoteTime: 0,
    state: "idle",
    danceType: null,
  };

  users.set(socket.id, player);

  socket.on("SET_NAME", ({ name }) => {
    const p = users.get(socket.id);
    if (!p) return;

    // Validation
    const cleanName = name ? name.trim().slice(0, 16) : null;
    if (!cleanName) return;

    p.name = cleanName;
    console.log(`👤 User named: ${cleanName} (${socket.id})`);

    // notify everyone after name is set
    io.emit("USER_JOINED", p);
  });

  socket.on("MOVE", ({ vx, vy, dir, dt, seq }) => {
    const p = users.get(socket.id);
    if (!p) return;

    const delta = dt / 1000; // ms → seconds
    const speed = 120;       // pixels per second

    p.x += vx * speed * delta;
    p.y += vy * speed * delta;

    if (dir) p.dir = dir;

    p.lastSeen = Date.now();
    p.status = "active";
    p.lastSeq = seq;
    p.isMoving = vx !== 0 || vy !== 0;

    // Stop dancing if moving
    if (p.isMoving) {
      p.state = "walk";
    } else {
      // If we are not moving, only set to idle if we aren't already dancing
      if (p.state !== "dance") {
        p.state = "idle";
      }
    }
  });

  socket.on("DANCE", ({ type }) => {
    const p = users.get(socket.id);
    if (!p) return;

    if (p.state === "dance") {
      p.state = "idle";
      p.danceType = null;
      console.log(`💃 Dance STOPPED for: ${p.name}`);
    } else {
      p.state = "dance";
      p.danceType = type || "dance1";
      p.isMoving = false;
      console.log(`💃 Dance STARTED for: ${p.name} (${type})`);
    }
  });

  socket.on("STOP_DANCE", () => {
    const p = users.get(socket.id);
    if (!p) return;

    p.state = "idle";
    p.danceType = null;
    console.log(`💃 Dance STOP_DANCE for: ${p.name}`);
  });

  socket.on("EMOTE", ({ type }) => {
    const p = users.get(socket.id);
    if (!p) return;

    const now = Date.now();
    // 1s cooldown
    if (now < p.lastEmoteTime + 1000) return;

    // Validate type (simple emoji mapping)
    const validEmotes = ["👋", "❤️", "😄", "😡"];
    if (!validEmotes.includes(type)) return;

    p.emote = type;
    p.emoteUntil = now + 2000; // Show for 2 seconds
    p.lastEmoteTime = now;
  });

  socket.on("disconnect", () => {
    users.delete(socket.id);
    io.emit("USER_LEFT", socket.id);
    console.log("🔴 user left:", socket.id);
  });
});

setInterval(() => {
  const now = Date.now();
  users.forEach((p) => {
    // If we haven't received a MOVE update in 100ms, consider the player stopped
    if (now - p.lastSeen > 100) {
      p.isMoving = false;
    }

    // Auto-clear emotes
    if (p.emote && now > p.emoteUntil) {
      p.emote = null;
    }
  });

  io.emit("STATE_SNAPSHOT", {
    users: [...users.values()].filter(p => p.name !== null),
    timestamp: now,
  });
}, 50);



httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
