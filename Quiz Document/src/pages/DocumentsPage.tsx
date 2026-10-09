import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { extractTextFromFile, getFileType } from "@/lib/documentExtractor";
import { FileText, Upload, Trash2, Loader2, CheckCircle, File } from "lucide-react";
import type { DocumentRecord } from "@/types";

export default function DocumentsPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const loadDocuments = useCallback(async () => {
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setDocuments((data as DocumentRecord[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleFiles = async (files: FileList | File[]) => {
    setError("");
    setUploading(true);
    const fileArray = Array.from(files);

    for (const file of fileArray) {
      try {
        setUploadStatus(`Extracting text from ${file.name}...`);
        const content = await extractTextFromFile(file);
        const fileType = getFileType(file.name);
        const userId = user!.id;
        const storagePath = `${userId}/${Date.now()}-${file.name}`;

        setUploadStatus(`Uploading ${file.name}...`);
        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(storagePath, file);

        if (uploadError) throw uploadError;

        setUploadStatus(`Saving ${file.name}...`);
        const { error: insertError } = await supabase.from("documents").insert({
          filename: file.name,
          file_type: fileType,
          content,
          storage_path: storagePath,
        });

        if (insertError) throw insertError;
      } catch (err: any) {
        setError(err.message || `Failed to upload ${file.name}`);
      }
    }

    setUploading(false);
    setUploadStatus("");
    await loadDocuments();
  };

  const handleDelete = async (doc: DocumentRecord) => {
    if (doc.storage_path) {
      await supabase.storage.from("documents").remove([doc.storage_path]);
    }
    await supabase.from("documents").delete().eq("id", doc.id);
    await loadDocuments();
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-2">Study Documents</h1>
      <p className="text-slate-400 mb-8">Upload .docx, .txt, or .pdf files. Text is extracted automatically for quiz and interview generation.</p>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!uploading) handleFiles(e.dataTransfer.files); }}
        className={`border-2 border-dashed rounded-2xl p-12 text-center mb-6 transition-all ${
          dragOver ? "border-teal-500 bg-teal-500/5" : "border-slate-700 bg-slate-800/30"
        }`}
      >
        <Upload className="w-10 h-10 text-slate-500 mx-auto mb-4" />
        <p className="text-slate-300 mb-2">Drag and drop files here, or</p>
        <label className="inline-block">
          <input
            type="file"
            multiple
            accept=".docx,.txt,.pdf"
            className="hidden"
            onChange={(e) => e.target.files && !uploading && handleFiles(e.target.files)}
          />
          <span className="px-5 py-2.5 bg-teal-500 hover:bg-teal-400 text-white text-sm font-medium rounded-xl cursor-pointer transition-all">
            Browse Files
          </span>
        </label>
        <p className="text-xs text-slate-500 mt-3">Supported: .docx, .txt, .pdf</p>
      </div>

      {uploading && (
        <div className="flex items-center gap-3 text-teal-400 text-sm mb-4 bg-teal-500/10 border border-teal-500/20 rounded-xl px-4 py-3">
          <Loader2 className="w-4 h-4 animate-spin" />
          {uploadStatus}
        </div>
      )}

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No documents uploaded yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-4 p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl hover:border-slate-600 transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-slate-700/50 flex items-center justify-center flex-shrink-0">
                <File className="w-5 h-5 text-slate-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">{doc.filename}</p>
                <p className="text-xs text-slate-500">
                  .{doc.file_type} - {doc.content.length.toLocaleString()} characters - {new Date(doc.created_at).toLocaleDateString()}
                </p>
              </div>
              <CheckCircle className="w-5 h-5 text-teal-400 flex-shrink-0" />
              <button
                onClick={() => handleDelete(doc)}
                className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
