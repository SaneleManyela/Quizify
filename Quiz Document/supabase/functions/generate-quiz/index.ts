import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface QuizQuestion {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

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

    const { documentIds, quizTitle } = await req.json();
    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return new Response(JSON.stringify({ error: "At least one document is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: documents, error: docError } = await supabase
      .from("documents")
      .select("id, filename, content")
      .in("id", documentIds)
      .eq("user_id", userId);

    if (docError || !documents || documents.length === 0) {
      return new Response(JSON.stringify({ error: "No documents found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const combinedText = documents.map((d: any) => d.content).join("\n\n---\n\n");
    const truncatedText = combinedText.slice(0, 12000);

    const { data: quizRow, error: quizError } = await supabase
      .from("quizzes")
      .insert({
        user_id: userId,
        title: quizTitle || `Quiz on ${documents.map((d: any) => d.filename).join(", ")}`,
        document_ids: documentIds,
        status: "generating",
        total_questions: 50,
      })
      .select()
      .single();

    if (quizError) {
      return new Response(JSON.stringify({ error: "Failed to create quiz" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const quizId = quizRow.id;

    const replicateToken = Deno.env.get("REPLICATE_API_TOKEN");
    if (!replicateToken) {
      await supabase.from("quizzes").update({ status: "ready", total_questions: 0 }).eq("id", quizId);
      return new Response(JSON.stringify({ error: "REPLICATE_API_TOKEN not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `You are an expert exam creator. Based on the following study material, generate exactly 50 multiple-choice questions that comprehensively cover the content. For each question provide 4 options (0-3), the correct option index, and a brief explanation.

Return ONLY a JSON array of objects with keys: "question", "options" (array of 4 strings), "correct_index" (0-3), "explanation".

Study material:
${truncatedText}`;

    const createRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${replicateToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "ibm-granite/granite-3.1-8b-instruct",
        input: { prompt, max_tokens: 8000, temperature: 0.7 },
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      await supabase.from("quizzes").update({ status: "ready", total_questions: 0 }).eq("id", quizId);
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
      await supabase.from("quizzes").update({ status: "ready", total_questions: 0 }).eq("id", quizId);
      return new Response(JSON.stringify({ error: "LLM generation failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const output = result.output || "";
    const fullText = Array.isArray(output) ? output.join("") : String(output);

    let questions: QuizQuestion[] = [];
    try {
      const jsonMatch = fullText.match(/\[[\s\S]*\]/);
      questions = JSON.parse(jsonMatch ? jsonMatch[0] : fullText);
    } catch {
      return new Response(JSON.stringify({ error: "Failed to parse LLM output", raw: fullText.slice(0, 500) }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      await supabase.from("quizzes").update({ status: "ready", total_questions: 0 }).eq("id", quizId);
      return new Response(JSON.stringify({ error: "No questions generated" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const questionRows = questions.slice(0, 50).map((q) => ({
      quiz_id: quizId,
      question_text: q.question,
      options: q.options,
      correct_index: q.correct_index,
      explanation: q.explanation || "",
    }));

    const { error: insertError } = await supabase.from("quiz_questions").insert(questionRows);

    if (insertError) {
      return new Response(JSON.stringify({ error: "Failed to save questions" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("quizzes").update({ status: "ready", total_questions: questionRows.length }).eq("id", quizId);

    return new Response(JSON.stringify({ quizId, questionCount: questionRows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
