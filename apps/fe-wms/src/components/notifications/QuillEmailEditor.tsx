"use client";

import { useEffect, useRef, useState } from "react";
import type Quill from "quill";

interface QuillEmailEditorProps {
  value: string;
  disabled?: boolean;
  placeholder: string;
  loadingLabel: string;
  onChange: (html: string, text: string) => void;
}

const TOOLBAR_OPTIONS = [
  [{ header: [1, 2, 3, false] }],
  ["bold", "italic", "underline", "strike"],
  [{ color: [] }, { background: [] }],
  [{ script: "sub" }, { script: "super" }],
  [{ list: "ordered" }, { list: "bullet" }],
  [{ indent: "-1" }, { indent: "+1" }],
  [{ align: [] }, { direction: "rtl" }],
  ["blockquote", "code-block"],
  ["link", "image"],
  ["clean"],
];

export default function QuillEmailEditor({
  value,
  disabled = false,
  placeholder,
  loadingLabel,
  onChange,
}: QuillEmailEditorProps) {
  const editorElementRef = useRef<HTMLDivElement | null>(null);
  const quillRef = useRef<Quill | null>(null);
  const lastHtmlRef = useRef(value);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let disposed = false;

    async function initializeEditor() {
      if (!editorElementRef.current || quillRef.current) return;

      const QuillConstructor = (await import("quill")).default;
      if (disposed || !editorElementRef.current) return;

      const quill = new QuillConstructor(editorElementRef.current, {
        theme: "snow",
        placeholder,
        modules: {
          toolbar: TOOLBAR_OPTIONS,
        },
      });

      quill.root.innerHTML = value;
      quill.enable(!disabled);
      quill.on("text-change", () => {
        const html = quill.root.innerHTML;
        lastHtmlRef.current = html;
        onChange(html, quill.getText().trim());
      });

      quillRef.current = quill;
      setIsLoading(false);
    }

    void initializeEditor();

    return () => {
      disposed = true;
    };
  }, [disabled, onChange, placeholder, value]);

  useEffect(() => {
    const quill = quillRef.current;
    if (!quill) return;
    quill.enable(!disabled);
  }, [disabled]);

  useEffect(() => {
    const quill = quillRef.current;
    if (!quill || value === lastHtmlRef.current) return;
    quill.root.innerHTML = value;
    lastHtmlRef.current = value;
  }, [value]);

  return (
    <div className="overflow-hidden rounded-radius-sm border border-border-subtle bg-surface-input text-sm">
      {isLoading && (
        <div className="skeleton-pulse flex h-44 items-center px-3 text-sm text-text-muted">
          {loadingLabel}
        </div>
      )}
      <div className={isLoading ? "hidden" : "block"}>
        <div ref={editorElementRef} className="min-h-52 bg-white" />
      </div>
    </div>
  );
}
