import express from "express";

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/", (req, res) => res.send("OK"));

app.post("/infer-schema", async (req, res) => {
  try {
    const design = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing GEMINI_API_KEY" });

    const prompt =
      "You convert app UI screen summaries into a database schema.\n" +
      "Return ONLY valid JSON with keys: tables, relationships, notes.\n" +
      "Format:\n" +
      '{"tables":[{"name":"users","columns":["id","email"]}],' +
      '"relationships":[{"from":"orders.user_id","to":"users.id","type":"many-to-one"}],' +
      '"notes":[{"severity":"info","message":"..."}]}\n\n' +
      "Design JSON:\n" + JSON.stringify(design);

    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent
";

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

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return res.status(500).json({ error: "No text in Gemini response", raw: data });

    res.setHeader("Content-Type", "application/json");
    res.send(text);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});


const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Listening on", port));
