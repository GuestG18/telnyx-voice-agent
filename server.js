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
      console.log("Starting AI gather...");

      await telnyxAction(callControlId, "gather_using_ai", {
        parameters: {
          type: "object",
          properties: {
            appointment_day: {
              type: "string",
              description:
                "Ziua programarii, in limba romana. Exemplu: luni, marti, maine, 25 aprilie.",
            },
            appointment_time: {
              type: "string",
              description:
                "Ora programarii. Exemplu: 10:00, ora 15, 15:30.",
            },
            reason: {
              type: "string",
              description:
                "Motivul programarii, in limba romana. Exemplu: schimb ulei, consultatie, intalnire.",
            },
          },
          required: ["appointment_day", "appointment_time", "reason"],
        },

        assistant: {
          instructions:
            "Esti un asistent telefonic roman. Vorbesti DOAR in limba romana. Nu vorbi niciodata in engleza. Scopul tau este sa programezi o intalnire. Intreaba clientul pentru ziua, ora si motivul programarii. Daca lipseste o informatie, cere clarificare in romana.",
          greeting:
            "Salut! Pentru ce zi, la ce ora si pentru ce motiv doresti programarea?",
          voice: "female",
          language: "ro-RO",
          transcription: {
            language: "ro",
          },
        },

        send_partial_results: true,
        gather_ended_speech:
          "Perfect, am notat detaliile programarii. Multumesc!",
      });
    }

    if (eventType === "call.ai_gather.partial_results") {
      console.log("PARTIAL RESULT:");
      console.log(JSON.stringify(payload, null, 2));
    }

    if (eventType === "call.ai_gather.ended") {
      console.log("FINAL RESULT:");
      console.log(JSON.stringify(payload, null, 2));

      await telnyxAction(callControlId, "speak", {
        payload: "Programarea ta a fost inregistrata. O zi buna!",
        voice: "female",
        language: "ro-RO",
      });
    }

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
