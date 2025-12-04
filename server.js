import express from "express";

const app = express();
app.use(express.json({ limit: "2mb" }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-goog-api-key");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});


// CORS for browser/Figma UI calls
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-goog-api-key");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.get("/", (req, res) => res.send("OK"));

// Optional: list available Gemini models
app.get("/models", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing GEMINI_API_KEY" });

    const resp = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
      headers: { "x-goog-api-key": apiKey }
    });
    const data = await resp.json();
    res.status(resp.status).json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post("/infer-schema", async (req, res) => {
  try {
    const design = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing GEMINI_API_KEY" });

    const prompt =
      "Convert the given UI screen summary JSON into a database schema.\n" +
      "Return ONLY valid JSON with keys: tables, relationships, notes.\n" +
      "Example:\n" +
      "{\"tables\":[{\"name\":\"users\",\"columns\":[\"id\",\"email\"]}],\"relationships\":[],\"notes\":[{\"severity\":\"info\",\"message\":\"...\"}]}\n\n" +
      "Design JSON:\n" + JSON.stringify(design);

    // Try a Flash model name. If it 404s, use /models to find valid names.
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const data = await resp.json();
    if (!resp.ok) return res.status(resp.status).json({ error: "Gemini error", raw: data });

    const text = data && data.candidates && data.candidates[0] &&
      data.candidates[0].content && data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;

    if (!text) return res.status(500).json({ error: "No text in Gemini response", raw: data });

    res.setHeader("Content-Type", "application/json");
    res.send(text);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Listening on", port));
