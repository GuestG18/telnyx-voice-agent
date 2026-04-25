const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json({ limit: "10mb" }));

const TELNYX_API_KEY = process.env.TELNYX_API_KEY;
const TELNYX_CONNECTION_ID = process.env.TELNYX_CONNECTION_ID; // old Voice API / Call Control app ID
const TELNYX_FROM_NUMBER = process.env.TELNYX_FROM_NUMBER;
const MY_PHONE_NUMBER = process.env.MY_PHONE_NUMBER;

const ELEVEN_SIP_URI =
  process.env.ELEVEN_SIP_URI || "sip:sip.rtc.elevenlabs.io:5060";

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
    ELEVEN_SIP_URI,
  };
}

async function telnyxAction(callControlId, action, payload = {}) {
  return axios.post(
    `https://api.telnyx.com/v2/calls/${callControlId}/actions/${action}`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${TELNYX_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );
}

app.get("/", (req, res) => {
  res.send("Backend running. Telnyx callback transfers to ElevenLabs SIP.");
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    mode: "telnyx-transfer-to-elevenlabs-sip",
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
      message:
        "Telnyx is calling now. When answered, backend will transfer call to ElevenLabs SIP.",
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
  const callControlId = payload?.call_control_id;
  const direction = payload?.direction;

  console.log("TELNYX WEBHOOK:", eventType);
  console.log(JSON.stringify(payload, null, 2));

  if (!TELNYX_API_KEY || !callControlId) return;

  try {
    if (eventType === "call.answered" && direction === "outgoing") {
      console.log("Outbound call answered. Transferring to ElevenLabs SIP...");

      await telnyxAction(callControlId, "transfer", {
        to: ELEVEN_SIP_URI,
        timeout_secs: 60,
      });

      console.log("Transfer command sent to:", ELEVEN_SIP_URI);
    }

    if (eventType === "call.hangup") {
      console.log("Call ended:", payload?.hangup_cause);
    }
  } catch (err) {
    console.error("TELNYX WEBHOOK ACTION ERROR:", err.response?.data || err.message);
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
