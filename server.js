import express from "express";

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/", (req, res) => res.send("OK"));

app.post("/infer-schema", async (req, res) => {
  try {
    const design = req.body;

    // You must set OPENAI_API_KEY in Render Environment Variables
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

    // Call OpenAI with Structured Outputs (JSON schema)
    // Docs: Structured outputs guide :contentReference[oaicite:1]{index=1}
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content:
              "You convert app UI screen summaries into a database schema. Return only valid JSON."
          },
          {
            role: "user",
            content:
              "Given this Figma-extracted design JSON, infer tables/columns/relationships. " +
              "Output JSON exactly matching the schema."
          },
          { role: "user", content: JSON.stringify(design) }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "db_schema",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                tables: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      name: { type: "string" },
                      columns: { type: "array", items: { type: "string" } }
                    },
                    required: ["name", "columns"]
                  }
                },
                relationships: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      from: { type: "string" },
                      to: { type: "string" },
                      type: { type: "string" }
                    },
                    required: ["from", "to", "type"]
                  }
                },
                notes: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      severity: { type: "string" },
                      message: { type: "string" }
                    },
                    required: ["severity", "message"]
                  }
                }
              },
              required: ["tables", "relationships", "notes"]
            }
          }
        }
      })
    });

    const data = await response.json();

    // The Responses API returns structured text in output_text (convenient helper)
    const jsonText = data.output_text;
    if (!jsonText) return res.status(500).json({ error: "No output_text", raw: data });

    res.setHeader("Content-Type", "application/json");
    res.send(jsonText);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Listening on", port));
