const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json({ limit: "10mb" }));

const ELEVEN_API_KEY = process.env.ELEVEN_API_KEY;
const ELEVEN_AGENT_ID = process.env.ELEVEN_AGENT_ID;
const ELEVEN_PHONE_NUMBER_ID = process.env.ELEVEN_PHONE_NUMBER_ID;
const MY_PHONE_NUMBER = process.env.MY_PHONE_NUMBER;

const appointments = [];

function debugEnv() {
  return {
    ELEVEN_API_KEY: ELEVEN_API_KEY
      ? `loaded (${ELEVEN_API_KEY.slice(0, 6)}...${ELEVEN_API_KEY.slice(-4)})`
      : "missing",
    ELEVEN_AGENT_ID: ELEVEN_AGENT_ID || "missing",
    ELEVEN_PHONE_NUMBER_ID: ELEVEN_PHONE_NUMBER_ID || "missing",
    MY_PHONE_NUMBER: MY_PHONE_NUMBER || "missing",
  };
}

app.get("/", (req, res) => {
  res.send("Backend running. ElevenLabs handles calls via SIP.");
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    mode: "elevenlabs-sip",
    env: debugEnv(),
  });
});

app.get("/call-me", async (req, res) => {
  try {
    console.log("CALL-ME ENV DEBUG:");
    console.log(JSON.stringify(debugEnv(), null, 2));

    if (
      !ELEVEN_API_KEY ||
      !ELEVEN_AGENT_ID ||
      !ELEVEN_PHONE_NUMBER_ID ||
      !MY_PHONE_NUMBER
    ) {
      return res.status(400).json({
        error:
          "Missing ELEVEN_API_KEY, ELEVEN_AGENT_ID, ELEVEN_PHONE_NUMBER_ID, or MY_PHONE_NUMBER",
        env: debugEnv(),
      });
    }

    const response = await axios.post(
      "https://api.elevenlabs.io/v1/convai/twilio/outbound-call",
      {
        agent_id: ELEVEN_AGENT_ID,
        agent_phone_number_id: ELEVEN_PHONE_NUMBER_ID,
        to_number: MY_PHONE_NUMBER,
      },
      {
        headers: {
          "xi-api-key": ELEVEN_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("ElevenLabs outbound call started:");
    console.log(JSON.stringify(response.data, null, 2));

    res.json({
      message: "ElevenLabs agent is calling you now...",
      data: response.data,
    });
  } catch (err) {
    console.error(
      "ELEVENLABS OUTBOUND ERROR:",
      err.response?.data || err.message
    );

    res.status(500).json(err.response?.data || { error: err.message });
  }
});

app.post("/elevenlabs/schedule-appointment", (req, res) => {
  console.log("ELEVENLABS TOOL CALL:");
  console.log(JSON.stringify(req.body, null, 2));

  const params = req.body?.parameters || req.body;

  const appointment = {
    name: params.name || null,
    phone: params.phone || null,
    day: params.day || params.appointment_day || null,
    time: params.time || params.appointment_time || null,
    reason: params.reason || null,
    conversation_id: req.body?.conversation_id || null,
    created_at: new Date().toISOString(),
  };

  appointments.push(appointment);

  console.log("APPOINTMENT SAVED:");
  console.log(JSON.stringify(appointment, null, 2));

  res.json({
    success: true,
    message: "Programarea a fost salvată cu succes.",
    appointment,
  });
});

app.post("/elevenlabs/post-call", (req, res) => {
  console.log("ELEVENLABS POST-CALL WEBHOOK:");
  console.log(JSON.stringify(req.body, null, 2));

  res.sendStatus(200);
});

app.get("/appointments", (req, res) => {
  res.json({
    count: appointments.length,
    appointments,
  });
});

const port = process.env.PORT || 3000;

app.listen(port, "0.0.0.0", () => {
  console.log(`Backend running on port ${port}`);
  console.log("STARTUP ENV DEBUG:");
  console.log(JSON.stringify(debugEnv(), null, 2));
});
