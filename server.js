const express = require("express");
const app = express();

app.use(express.json());

app.post("/webhook", (req, res) => {
  console.log("CALL EVENT:", JSON.stringify(req.body, null, 2));

  res.json({
    data: {
      actions: [
        {
          command: "answer"
        },
        {
          command: "speak",
          payload: {
            text: "Salut! Acesta este primul tau apel automat."
          }
        },
        {
          command: "hangup"
        }
      ]
    }
  });
});

app.get("/", (req, res) => {
  res.send("Telnyx voice agent is running");
});

const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});
