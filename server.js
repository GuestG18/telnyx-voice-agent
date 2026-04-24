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

      console.log("Speaking clear Romanian intro...");

      await telnyxAction(callControlId, "speak", {
        payload:
          "Salut! Spune-mi te rog pentru ce zi si la ce ora vrei programarea.",
        voice: "female",
        language: "ro-RO",
      });
    }

    if (eventType === "call.speak.ended") {
      console.log("Intro ended. Starting AI gather...");

      await telnyxAction(callControlId, "gather_using_ai", {
        parameters: {
          type: "object",
          properties: {
            appointment_day: {
              type: "string",
              description: "Ziua programarii",
            },
            appointment_time: {
              type: "string",
              description: "Ora programarii",
            },
            reason: {
              type: "string",
              description: "Motivul programarii",
            },
          },
          required: ["appointment_day", "appointment_time"],
        },
        assistant: {
          transcription: {
            language: "ro",
          },
        },
        send_partial_results: true,
      });
    }

    if (eventType === "call.ai_gather.partial_results") {
      console.log("PARTIAL RESULT:");
      console.log(JSON.stringify(payload, null, 2));
    }

    if (eventType === "call.ai_gather.ended") {
      console.log("FINAL RESULT:");
      console.log(JSON.stringify(payload, null, 2));

      await telnyxAction(callControlId, "hangup");
    }

    if (eventType === "call.conversation.ended") {
      console.log("CONVERSATION ENDED:");
      console.log(JSON.stringify(payload, null, 2));
    }
  } catch (err) {
    console.error("TELNYX ERROR:", err.response?.data || err.message);
  }
});

app.get("/", (req, res) => {
  res.send("Telnyx voice agent is running");
});

const port = process.env.PORT || 3000;

app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});
