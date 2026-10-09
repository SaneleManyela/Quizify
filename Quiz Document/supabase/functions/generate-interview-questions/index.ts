import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { position, company, prompt, jobSpec, jobSpecDocumentId } = await req.json();

    if (!prompt || !prompt.trim()) {
      return new Response(JSON.stringify({ error: "A prompt describing the interview is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let jobSpecContent = jobSpec || "";
    if (jobSpecDocumentId) {
      const { data: doc } = await supabase
        .from("documents")
        .select("content")
        .eq("id", jobSpecDocumentId)
        .eq("user_id", userId)
        .maybeSingle();
      if (doc?.content) jobSpecContent = doc.content;
    }

    const { data: interviewRow, error: interviewError } = await supabase
      .from("interviews")
      .insert({
        user_id: userId,
        position: position || "",
        company: company || "",
        prompt,
        job_spec: jobSpecContent || null,
        job_spec_document_id: jobSpecDocumentId || null,
        status: "generating",
      })
      .select()
      .single();

    if (interviewError) {
      return new Response(JSON.stringify({ error: "Failed to create interview" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const interviewId = interviewRow.id;

    const replicateToken = Deno.env.get("REPLICATE_API_TOKEN");
    if (!replicateToken) {
      return new Response(JSON.stringify({ error: "REPLICATE_API_TOKEN not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const llmPrompt = `You are an expert interviewer. Generate 10 open-ended interview questions for the following scenario.

Position: ${position || "General"}
Company: ${company || "General"}
Interview focus: ${prompt}
${jobSpecContent ? `Job specification:\n${jobSpecContent.slice(0, 4000)}` : ""}

Generate exactly 10 thoughtful, open-ended interview questions that would be asked in a real interview for this position. Questions should range from behavioral to technical to situational.

Return ONLY a JSON array of strings, each being a question. Example: ["Question 1?", "Question 2?", ...]`;

    const createRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${replicateToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "ibm-granite/granite-3.1-8b-instruct",
        input: { prompt: llmPrompt, max_tokens: 2000, temperature: 0.8 },
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      await supabase.from("interviews").update({ status: "active" }).eq("id", interviewId);
      return new Response(JSON.stringify({ error: `Replicate error: ${errText}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prediction = await createRes.json();
    const predictionUrl = prediction.urls?.get;

    let result = prediction;
    let attempts = 0;
    while (result.status !== "succeeded" && result.status !== "failed" && attempts < 120) {
      await new Promise((r) => setTimeout(r, 2000));
      const pollRes = await fetch(predictionUrl, {
        headers: { Authorization: `Bearer ${replicateToken}` },
      });
      result = await pollRes.json();
      attempts++;
    }

    if (result.status === "failed") {
      await supabase.from("interviews").update({ status: "active" }).eq("id", interviewId);
      return new Response(JSON.stringify({ error: "LLM generation failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const output = result.output || "";
    const fullText = Array.isArray(output) ? output.join("") : String(output);

    let questions: string[] = [];
    try {
      const jsonMatch = fullText.match(/\[[\s\S]*\]/);
      questions = JSON.parse(jsonMatch ? jsonMatch[0] : fullText);
    } catch {
      const lines = fullText.split("\n").filter((l) => l.trim() && l.match(/^\d+[\.\)]\s/));
      questions = lines.map((l) => l.replace(/^\d+[\.\)]\s/, "").trim());
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      await supabase.from("interviews").update({ status: "active" }).eq("id", interviewId);
      return new Response(JSON.stringify({ error: "No questions generated", raw: fullText.slice(0, 500) }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const questionRows = questions.slice(0, 10).map((q: string, i: number) => ({
      interview_id: interviewId,
      question_text: typeof q === "string" ? q : String(q),
      order_index: i,
    }));

    const { error: insertError } = await supabase.from("interview_questions").insert(questionRows);
    if (insertError) {
      return new Response(JSON.stringify({ error: "Failed to save questions" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("interviews").update({ status: "active" }).eq("id", interviewId);

    return new Response(JSON.stringify({ interviewId, questionCount: questionRows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
