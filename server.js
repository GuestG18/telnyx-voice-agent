const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const TELNYX_API_KEY = process.env.TELNYX_API_KEY;
const TELNYX_CONNECTION_ID = process.env.TELNYX_CONNECTION_ID;
const TELNYX_FROM_NUMBER = process.env.TELNYX_FROM_NUMBER;
const MY_PHONE_NUMBER = process.env.MY_PHONE_NUMBER;

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

function printConversation(payload) {
  if (payload?.message_history) {
    console.log("MESSAGE HISTORY:");
    for (const msg of payload.message_history) {
      console.log(`${msg.role}: ${msg.content}`);
    }
  }

  if (payload?.messages) {
    console.log("MESSAGES:");
    for (const msg of payload.messages) {
      console.log(`${msg.role}: ${msg.content}`);
    }
  }

  if (payload?.partial_results) {
    console.log("EXTRACTED PARTIAL RESULTS:");
    console.log(JSON.stringify(payload.partial_results, null, 2));
  }

  if (payload?.result) {
    console.log("FINAL EXTRACTED RESULT:");
    console.log(JSON.stringify(payload.result, null, 2));
  }
}

async function speakIntro(callControlId) {
  await telnyxAction(callControlId, "speak", {
    payload:
      "Salut! Sunt agentul tau automat. Spune-mi te rog pentru ce zi si la ce ora vrei programarea.",
    voice: "female",
    language: "ro-RO",
  });
}

app.get("/call-me", async (req, res) => {
  try {
    if (
      !TELNYX_API_KEY ||
      !TELNYX_CONNECTION_ID ||
      !TELNYX_FROM_NUMBER ||
      !MY_PHONE_NUMBER
    ) {
      return res.status(400).json({
        error:
          "Missing TELNYX_API_KEY, TELNYX_CONNECTION_ID, TELNYX_FROM_NUMBER, or MY_PHONE_NUMBER",
      });
    }

    const response = await axios.post(
      "https://api.telnyx.com/v2/calls",
      {
        connection_id: TELNYX_CONNECTION_ID,
        from: TELNYX_FROM_NUMBER,
        to: MY_PHONE_NUMBER,
      },
      {
        headers: {
          Authorization: `Bearer ${TELNYX_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Outbound call started:");
    console.log(JSON.stringify(response.data, null, 2));

    res.json({
      message: "Calling you now...",
      data: response.data,
    });
  } catch (err) {
    console.error("OUTBOUND CALL ERROR:", err.response?.data || err.message);
    res.status(500).json(err.response?.data || { error: err.message });
  }
});

app.post("/webhook", async (req, res) => {
  console.log("CALL EVENT:", req.body?.data?.event_type);

  res.sendStatus(200);

  const eventType = req.body?.data?.event_type;
  const payload = req.body?.data?.payload;
  const callControlId = payload?.call_control_id;
  const direction = payload?.direction;

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
      console.log("Call initiated. Direction:", direction);

      if (direction === "incoming") {
        console.log("Inbound call. Answering...");
        await telnyxAction(callControlId, "answer");
      }
    }

    if (eventType === "call.answered") {
      console.log("Call answered. Speaking intro...");
      await speakIntro(callControlId);
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
      printConversation(payload);
    }

    if (eventType === "call.ai_gather.ended") {
      console.log("FINAL RESULT:");
      printConversation(payload);

      await telnyxAction(callControlId, "speak", {
        payload: "Perfect, am notat detaliile. Multumesc!",
        voice: "female",
        language: "ro-RO",
      });

      setTimeout(async () => {
        try {
          await telnyxAction(callControlId, "hangup");
        } catch (err) {
          console.error("HANGUP ERROR:", err.response?.data || err.message);
        }
      }, 3000);
    }

    if (eventType === "call.conversation.ended") {
      console.log("CONVERSATION ENDED:");
      printConversation(payload);
    }

    if (eventType === "call.hangup") {
      console.log("Call ended.");
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
