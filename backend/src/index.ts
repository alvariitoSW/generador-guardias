import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import residentRoutes from "./routes/residents";
import vacationRoutes from "./routes/vacations";
import preferenceRoutes from "./routes/preferences";
import serviceRoutes from "./routes/services";
import scheduleRoutes from "./routes/schedule";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/residents", residentRoutes);
app.use("/api/vacations", vacationRoutes);
app.use("/api/preferences", preferenceRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/schedule", scheduleRoutes);

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
});
