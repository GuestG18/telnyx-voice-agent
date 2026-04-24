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

  // VERY IMPORTANT: respond fast
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
    // 1. Incoming call
    if (eventType === "call.initiated") {
      console.log("Answering call...");
      await telnyxAction(callControlId, "answer");
    }

    // 2. After answer → start AI conversation
    if (eventType === "call.answered") {
      console.log("Starting AI gather...");

      await telnyxAction(callControlId, "gather_using_ai", {
        parameters: {
          type: "object",
          properties: {
            appointment_day: {
              type: "string",
              description: "Ziua pentru programare",
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
          greeting:
            "Salut! Spune-mi te rog pentru ce zi, la ce ora si pentru ce motiv vrei programarea.",
          transcription: {
            language: "ro",
          },
        },
        send_partial_results: true,
        gather_ended_speech: "Perfect, am notat. Multumesc!",
      });
    }

    // 3. Partial speech (optional debug)
    if (eventType === "call.ai_gather.partial_results") {
      console.log("PARTIAL RESULT:");
      console.log(JSON.stringify(payload, null, 2));
    }

    // 4. Final result
    if (eventType === "call.ai_gather.ended") {
      console.log("FINAL RESULT:");
      console.log(JSON.stringify(payload, null, 2));

      // 👉 HERE later we will:
      // - save to Google Sheets
      // - check Google Calendar availability

      await telnyxAction(callControlId, "speak", {
        payload: "Programarea ta a fost inregistrata. O zi buna!",
        voice: "female",
        language: "ro-RO",
      });
    }

    // 5. End call AFTER confirmation speech
    if (eventType === "call.speak.ended") {
      console.log("Call finished. Hanging up...");
      await telnyxAction(callControlId, "hangup");
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
