export interface DocumentRecord {
  id: string;
  user_id: string;
  filename: string;
  file_type: string;
  content: string;
  storage_path: string | null;
  created_at: string;
}

export interface QuizRecord {
  id: string;
  user_id: string;
  title: string;
  document_ids: string[];
  status: string;
  score: number | null;
  total_questions: number;
  created_at: string;
}

export interface QuizQuestionRecord {
  id: string;
  quiz_id: string;
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  user_answer: number | null;
}

export interface InterviewRecord {
  id: string;
  user_id: string;
  position: string;
  company: string;
  prompt: string;
  job_spec: string | null;
  job_spec_document_id: string | null;
  status: string;
  analysis: string | null;
  created_at: string;
}

export interface InterviewQuestionRecord {
  id: string;
  interview_id: string;
  question_text: string;
  order_index: number;
  audio_path: string | null;
  transcript: string | null;
  answer_text: string | null;
  completed: boolean;
}
