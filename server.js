const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json({ limit: "10mb" }));

const TELNYX_API_KEY = process.env.TELNYX_API_KEY;
const TELNYX_CONNECTION_ID = process.env.TELNYX_CONNECTION_ID;
const TELNYX_FROM_NUMBER = process.env.TELNYX_FROM_NUMBER;
const MY_PHONE_NUMBER = process.env.MY_PHONE_NUMBER;

const appointments = [];

function mask(value) {
  if (!value) return "missing";
  if (value.length <= 10) return "loaded";
  return `loaded (${value.slice(0, 6)}...${value.slice(-4)})`;
}

function debugEnv() {
  return {
    TELNYX_API_KEY: mask(TELNYX_API_KEY),
    TELNYX_CONNECTION_ID: TELNYX_CONNECTION_ID || "missing",
    TELNYX_FROM_NUMBER: TELNYX_FROM_NUMBER || "missing",
    MY_PHONE_NUMBER: MY_PHONE_NUMBER || "missing",
  };
}

app.get("/", (req, res) => {
  res.send("Backend running. Telnyx AI handles voice agent calls.");
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    mode: "telnyx-ai-only",
    env: debugEnv(),
  });
});

app.get("/call-me", async (req, res) => {
  try {
    console.log("CALL-ME ENV DEBUG:");
    console.log(JSON.stringify(debugEnv(), null, 2));

    if (
      !TELNYX_API_KEY ||
      !TELNYX_CONNECTION_ID ||
      !TELNYX_FROM_NUMBER ||
      !MY_PHONE_NUMBER
    ) {
      return res.status(400).json({
        error:
          "Missing TELNYX_API_KEY, TELNYX_CONNECTION_ID, TELNYX_FROM_NUMBER, or MY_PHONE_NUMBER",
        env: debugEnv(),
      });
    }

    const toNumber = req.query.to || MY_PHONE_NUMBER;

    const response = await axios.post(
      "https://api.telnyx.com/v2/calls",
      {
        connection_id: TELNYX_CONNECTION_ID,
        from: TELNYX_FROM_NUMBER,
        to: toNumber,
      },
      {
        headers: {
          Authorization: `Bearer ${TELNYX_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Telnyx outbound call started:");
    console.log(JSON.stringify(response.data, null, 2));

    res.json({
      message: "Telnyx is calling now.",
      to: toNumber,
      data: response.data,
    });
  } catch (err) {
    console.error("TELNYX CALLBACK ERROR:", err.response?.data || err.message);
    res.status(500).json(err.response?.data || { error: err.message });
  }
});

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  const eventType = req.body?.data?.event_type;
  const payload = req.body?.data?.payload;

  console.log("TELNYX WEBHOOK:", eventType);
  console.log(JSON.stringify(payload, null, 2));

  if (eventType === "call.ai_gather.partial_results") {
    console.log("AI PARTIAL RESULT:");
    console.log(JSON.stringify(payload, null, 2));
  }

  if (eventType === "call.ai_gather.ended") {
    console.log("AI FINAL RESULT:");
    console.log(JSON.stringify(payload, null, 2));

    const result = payload?.result || payload?.partial_results || {};

    const appointment = {
      name: result.name || null,
      phone: payload?.from || null,
      day: result.appointment_day || result.day || null,
      time: result.appointment_time || result.time || null,
      reason: result.reason || null,
      raw: result,
      created_at: new Date().toISOString(),
    };

    appointments.push(appointment);

    console.log("APPOINTMENT SAVED:");
    console.log(JSON.stringify(appointment, null, 2));
  }

  if (eventType === "call.conversation.ended") {
    console.log("CONVERSATION ENDED:");
    console.log(JSON.stringify(payload, null, 2));
  }

  if (eventType === "call.hangup") {
    console.log("CALL ENDED:");
    console.log(payload?.hangup_cause || "unknown");
  }
});

app.post("/telnyx/save-appointment", (req, res) => {
  console.log("TELNYX TOOL SAVE APPOINTMENT:");
  console.log(JSON.stringify(req.body, null, 2));

  const params = req.body?.parameters || req.body;

  const appointment = {
    name: params.name || null,
    phone: params.phone || null,
    day: params.day || params.appointment_day || null,
    time: params.time || params.appointment_time || null,
    reason: params.reason || null,
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
