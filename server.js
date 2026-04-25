const express = require("express");

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Voice agent backend is running. ElevenLabs now handles calls via SIP.");
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    mode: "elevenlabs-sip",
    message: "Telnyx calls should route directly to ElevenLabs Agent Radu.",
  });
});

app.post("/webhook", (req, res) => {
  console.log("Webhook received:");
  console.log(JSON.stringify(req.body, null, 2));

  res.sendStatus(200);
});

const port = process.env.PORT || 3000;

app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});
