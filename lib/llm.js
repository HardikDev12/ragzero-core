function defaultOllamaHost() {
  return process.env.OLLAMA_HOST?.trim() || "http://127.0.0.1:11434";
}

export async function callLLM({
    prompt,
    config,
    temperature: temperatureArg
  }) {
    const {
      provider = "ollama",
      baseURL,
      apiKey,
      model = process.env.OLLAMA_MODEL?.trim() || "llama3.2",
      ollamaHost = defaultOllamaHost(),
      temperature: temperatureConfig
    } = config;
    const temperature =
      temperatureArg ?? temperatureConfig ?? 0.2;
  
    // Ollama (local) — https://github.com/ollama/ollama/blob/main/docs/api.md
    if (provider === "ollama") {
      const base = String(ollamaHost).replace(/\/$/, "");
      const res = await fetch(`${base}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          stream: false,
          messages: [{ role: "user", content: prompt }],
          options: { temperature }
        })
      });

      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(`Ollama returned non-JSON (${res.status}): ${raw.slice(0, 500)}`);
      }

      if (data.error) {
        const err = String(data.error);
        let hint = "";
        if (/not found/i.test(err) && /model/i.test(err)) {
          hint = ` (Install with: ollama pull ${model} — or set OLLAMA_MODEL to a model you already have, e.g. ollama list)`;
        }
        throw new Error(`Ollama: ${err}${hint}`);
      }
      const text = data.message?.content;
      if (typeof text !== "string") {
        throw new TypeError(`Invalid Ollama response: ${raw.slice(0, 500)}`);
      }
      return text;
    }
  
    // Universal OpenAI-compatible API
    if (!baseURL) {
      throw new Error("Custom provider requires baseURL (or env LLM_BASE_URL).");
    }
    const res = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey || "sk-local"}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature
      })
    });
  
    const data = await res.json();
  
    if (!data.choices) {
      throw new Error("Invalid LLM response: " + JSON.stringify(data));
    }
  
    return data.choices[0].message.content;
  }