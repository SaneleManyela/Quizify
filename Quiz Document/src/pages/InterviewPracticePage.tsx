import { useEffect, useRef, useState } from "react";
import { supabase, callEdgeFunction } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Loader2, Mic, Square, ChevronLeft, ChevronRight, CheckCircle, AlertCircle, Loader } from "lucide-react";
import {
  MenuButtonBold,
  MenuButtonItalic,
  MenuButtonUnderline,
  MenuButtonBulletedList,
  MenuButtonOrderedList,
  MenuButtonBlockquote,
  MenuButtonCode,
  MenuButtonStrikethrough,
  MenuControlsContainer,
  MenuDivider,
  MenuSelectHeading,
  RichTextEditor,
  type RichTextEditorRef,
} from "mui-tiptap";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import type { InterviewQuestionRecord, InterviewRecord } from "@/types";

interface Props {
  interviewId: string;
  onNavigate: (route: string, params?: Record<string, string>) => void;
}

type RecordingState = "idle" | "recording" | "uploading" | "transcribing" | "done";

export default function InterviewPracticePage({ interviewId, onNavigate }: Props) {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<InterviewQuestionRecord[]>([]);
  const [interview, setInterview] = useState<InterviewRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [error, setError] = useState("");
  const [transcript, setTranscript] = useState<string>("");
  const [answerHtml, setAnswerHtml] = useState<string>("");
  const [finishing, setFinishing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const editorRef = useRef<RichTextEditorRef>(null);

  useEffect(() => {
    async function load() {
      const [{ data: qData }, { data: ivData }] = await Promise.all([
        supabase
          .from("interview_questions")
          .select("*")
          .eq("interview_id", interviewId)
          .order("order_index", { ascending: true }),
        supabase.from("interviews").select("*").eq("id", interviewId).maybeSingle(),
      ]);
      setQuestions((qData as InterviewQuestionRecord[]) ?? []);
      setInterview(ivData as InterviewRecord | null);
      setLoading(false);
    }
    load();
  }, [interviewId]);

  const currentQuestion = questions[currentIdx];

  useEffect(() => {
    if (currentQuestion) {
      setTranscript(currentQuestion.transcript || "");
      setAnswerHtml(currentQuestion.answer_text || "");
      setRecordingState(currentQuestion.completed ? "done" : "idle");
      setError("");
    }
  }, [currentIdx, currentQuestion]);

  const startRecording = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/mpeg" });
        await uploadAndTranscribe(audioBlob);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecordingState("recording");
    } catch (err: any) {
      setError("Could not access microphone. Please allow microphone permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setRecordingState("uploading");
    }
  };

  const uploadAndTranscribe = async (audioBlob: Blob) => {
    if (!user) return;
    try {
      const audioPath = `${user.id}/${interviewId}/${currentQuestion.id}.mp3`;
      setRecordingState("uploading");

      const { error: uploadError } = await supabase.storage
        .from("audio")
        .upload(audioPath, audioBlob, { upsert: true });

      if (uploadError) throw uploadError;

      await supabase
        .from("interview_questions")
        .update({ audio_path: audioPath })
        .eq("id", currentQuestion.id);

      setRecordingState("transcribing");

      const result = await callEdgeFunction<{ transcript: string }>("transcribe-audio", {
        questionId: currentQuestion.id,
        audioPath,
      });

      setTranscript(result.transcript);
      setRecordingState("done");

      setQuestions((prev) =>
        prev.map((q) =>
          q.id === currentQuestion.id
            ? { ...q, audio_path: audioPath, transcript: result.transcript, completed: true }
            : q,
        ),
      );
    } catch (err: any) {
      setError(err.message || "Failed to transcribe audio");
      setRecordingState("idle");
    }
  };

  const saveAnswer = async () => {
    if (!currentQuestion) return;
    const html = editorRef.current?.editor?.getHTML() || "";
    await supabase
      .from("interview_questions")
      .update({ answer_text: html })
      .eq("id", currentQuestion.id);
  };

  const handleNext = async () => {
    await saveAnswer();
    if (currentIdx < questions.length - 1) {
      setCurrentIdx((i) => i + 1);
    }
  };

  const handlePrev = () => {
    setCurrentIdx((i) => Math.max(0, i - 1));
  };

  const handleFinish = async () => {
    await saveAnswer();
    setFinishing(true);
    try {
      await callEdgeFunction("analyze-interview", { interviewId });
      onNavigate("interview-analysis", { interviewId });
    } catch (err: any) {
      setError(err.message || "Failed to analyze interview");
      setFinishing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-400 mb-4">No questions found for this interview.</p>
        <button onClick={() => onNavigate("interviews")} className="text-teal-400 hover:text-teal-300 text-sm font-medium">
          Back to Interviews
        </button>
      </div>
    );
  }

  const isLast = currentIdx === questions.length - 1;
  const answeredCount = questions.filter((q) => q.completed || q.answer_text).length;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => onNavigate("interviews")} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm">
          <ChevronLeft className="w-4 h-4" />
          Exit Interview
        </button>
        <span className="text-sm text-slate-400">
          {answeredCount} / {questions.length} answered
        </span>
      </div>

      <div className="w-full bg-slate-800 rounded-full h-2 mb-8">
        <div
          className="bg-amber-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
        />
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 mb-6">
        <div className="flex items-start gap-3 mb-2">
          <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/20 flex items-center justify-center text-amber-400 text-sm font-bold">
            {currentIdx + 1}
          </span>
          <p className="text-lg text-white leading-relaxed pt-0.5">{currentQuestion?.question_text}</p>
        </div>
        {interview && (
          <p className="ml-11 text-xs text-slate-500">
            {interview.position || "General"} {interview.company && `at ${interview.company}`}
          </p>
        )}
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 mb-6">
        <h3 className="text-sm font-medium text-slate-300 mb-3">Your Answer</h3>
        <div className="rounded-xl overflow-hidden border border-slate-700">
          <RichTextEditor
            ref={editorRef}
            content={answerHtml}
            extensions={[StarterKit, Underline]}
            renderControls={() => (
              <MenuControlsContainer>
                <MenuSelectHeading />
                <MenuDivider />
                <MenuButtonBold />
                <MenuButtonItalic />
                <MenuButtonUnderline />
                <MenuButtonStrikethrough />
                <MenuButtonCode />
                <MenuDivider />
                <MenuButtonBulletedList />
                <MenuButtonOrderedList />
                <MenuButtonBlockquote />
              </MenuControlsContainer>
            )}
          />
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 mb-6">
        <h3 className="text-sm font-medium text-slate-300 mb-3">Voice Recording</h3>

        {recordingState === "recording" ? (
          <button
            onClick={stopRecording}
            className="flex items-center gap-3 px-5 py-3 bg-red-500/15 border border-red-500/30 text-red-400 rounded-xl hover:bg-red-500/20 transition-all"
          >
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            Stop Recording
          </button>
        ) : recordingState === "idle" ? (
          <button
            onClick={startRecording}
            className="flex items-center gap-3 px-5 py-3 bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded-xl hover:bg-amber-500/20 transition-all"
          >
            <Mic className="w-5 h-5" />
            Start Recording
          </button>
        ) : recordingState === "uploading" ? (
          <div className="flex items-center gap-3 text-slate-400 text-sm">
            <Loader2 className="w-5 h-5 animate-spin" />
            Uploading audio...
          </div>
        ) : recordingState === "transcribing" ? (
          <div className="flex items-center gap-3 text-slate-400 text-sm">
            <Loader2 className="w-5 h-5 animate-spin" />
            Transcribing with Whisper...
          </div>
        ) : (
          <div className="flex items-center gap-3 text-teal-400 text-sm">
            <CheckCircle className="w-5 h-5" />
            Recording transcribed
            <button
              onClick={startRecording}
              className="ml-3 text-slate-400 hover:text-white text-xs underline"
            >
              Re-record
            </button>
          </div>
        )}

        {transcript && recordingState === "done" && (
          <div className="mt-4 p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
            <p className="text-xs text-slate-500 mb-2">Transcript:</p>
            <p className="text-sm text-slate-300 leading-relaxed">{transcript}</p>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={handlePrev}
          disabled={currentIdx === 0}
          className="flex items-center gap-2 px-5 py-2.5 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft className="w-5 h-5" />
          Previous
        </button>

        {isLast ? (
          <button
            onClick={handleFinish}
            disabled={finishing}
            className="flex items-center gap-2 px-6 py-3 bg-teal-500 hover:bg-teal-400 text-white font-medium rounded-xl transition-all shadow-lg shadow-teal-500/20 disabled:opacity-50"
          >
            {finishing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
            Finish & Analyze
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl transition-all"
          >
            Next
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
