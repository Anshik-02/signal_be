import express, { Application } from "express";


const app=express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  res.send("PulseBoard backend is running 🚀");
});





export default app;
