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

    const { interviewId } = await req.json();
    if (!interviewId) {
      return new Response(JSON.stringify({ error: "interviewId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: interview } = await supabase
      .from("interviews")
      .select("id, user_id, position, company, prompt")
      .eq("id", interviewId)
      .maybeSingle();

    if (!interview || interview.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Interview not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: questions } = await supabase
      .from("interview_questions")
      .select("question_text, transcript, answer_text")
      .eq("interview_id", interviewId)
      .order("order_index", { ascending: true });

    if (!questions || questions.length === 0) {
      return new Response(JSON.stringify({ error: "No questions found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const answersText = questions
      .map((q: any, i: number) => {
        const answer = q.transcript || q.answer_text || "[No answer provided]";
        return `Q${i + 1}: ${q.question_text}\nA: ${answer}`;
      })
      .join("\n\n");

    const replicateToken = Deno.env.get("REPLICATE_API_TOKEN");
    if (!replicateToken) {
      return new Response(JSON.stringify({ error: "REPLICATE_API_TOKEN not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const llmPrompt = `You are an expert interview coach. Analyze the following interview responses and provide detailed feedback.

Position: ${interview.position || "General"}
Company: ${interview.company || "General"}
Interview focus: ${interview.prompt}

Interview Q&A:
${answersText}

Provide a comprehensive analysis with the following sections:
1. Overall Assessment - general impression and summary
2. Strengths - what the candidate did well
3. Areas for Improvement - specific areas that need work
4. Question-by-Question Feedback - brief feedback on each answer
5. Recommendations - actionable advice for improvement

Format the response clearly with headers and bullet points.`;

    const createRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${replicateToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "ibm-granite/granite-3.1-8b-instruct",
        input: { prompt: llmPrompt, max_tokens: 4000, temperature: 0.6 },
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
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
      return new Response(JSON.stringify({ error: "LLM analysis failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const output = result.output || "";
    const analysis = Array.isArray(output) ? output.join("") : String(output);

    await supabase
      .from("interviews")
      .update({ status: "analyzed", analysis })
      .eq("id", interviewId);

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
