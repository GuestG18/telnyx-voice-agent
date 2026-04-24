const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const TELNYX_API_KEY = process.env.TELNYX_API_KEY;

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

app.post("/webhook", async (req, res) => {
  console.log("CALL EVENT:", JSON.stringify(req.body, null, 2));

  res.sendStatus(200);

  const eventType = req.body?.data?.event_type;
  const payload = req.body?.data?.payload;
  const callControlId = payload?.call_control_id;

  if (!TELNYX_API_KEY) {
    console.error("Missing TELNYX_API_KEY environment variable");
    return;
  }

  if (!callControlId) {
    console.log("No call_control_id found in event");
    return;
  }

  try {
    if (eventType === "call.initiated") {
      console.log("Answering call...");

      await telnyxAction(callControlId, "answer");
    }

    if (eventType === "call.answered") {
      console.log("Call answered. Starting speech gather...");

      await telnyxAction(callControlId, "gather_using_speak", {
        payload:
          "Salut! Spune-mi te rog pentru ce zi și la ce oră vrei programarea.",
        voice: "female",
        language: "ro-RO",
        minimum_digits: 1,
        maximum_digits: 1,
        valid_digits: "1234567890",
        timeout_millis: 10000,
      });
    }

    if (eventType === "call.gather.ended") {
      console.log("Gather ended:");
      console.log(JSON.stringify(payload, null, 2));

      await telnyxAction(callControlId, "speak", {
        payload: "Am primit răspunsul tău. Mulțumesc!",
        voice: "female",
        language: "ro-RO",
      });
    }

    if (eventType === "call.speak.ended") {
      console.log("Speech ended. Hanging up...");

      await telnyxAction(callControlId, "hangup");
    }
  } catch (err) {
    console.error("TELNYX API ERROR:", err.response?.data || err.message);
  }
});

app.get("/", (req, res) => {
  res.send("Telnyx voice agent is running");
});

const port = process.env.PORT || 3000;

app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});
