"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { ArrowUp, ImagePlus, Square, X } from "lucide-react";
import { MARK_OPTIONS, MODES } from "@/lib/config";
import type { ChatContext, ContentPart } from "@/lib/types";

const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

type AttachedImage = { url: string; name: string };

function readImage(file: File) {
  return new Promise<AttachedImage>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ url: String(reader.result), name: file.name });
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function Composer({
  context,
  busy,
  onSend,
  onStop,
  onContextChange,
}: {
  context: ChatContext;
  busy: boolean;
  onSend: (parts: ContentPart[], overrides?: Partial<ChatContext>) => void;
  onStop: () => void;
  onContextChange: (next: Partial<ChatContext>) => void;
}) {
  const [value, setValue] = useState("");
  const [images, setImages] = useState<AttachedImage[]>([]);
  const [dragging, setDragging] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string>();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  useEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const submit = () => {
    if (busy || (!value.trim() && images.length === 0)) return;
    const parts: ContentPart[] = [];
    for (const image of images) {
      parts.push({ type: "image", url: image.url, alt: image.name });
    }
    if (value.trim()) parts.push({ type: "text", text: value.trim() });
    onSend(parts);
    setValue("");
    setImages([]);
    setAttachmentError(undefined);
  };

  const attach = async (files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      setAttachmentError("Only image files can be attached right now.");
      return;
    }

    const valid = imageFiles.filter((file) => file.size <= MAX_IMAGE_BYTES);
    if (valid.length !== imageFiles.length) {
      setAttachmentError("Each image must be smaller than 10 MB.");
    } else {
      setAttachmentError(undefined);
    }

    const remaining = Math.max(0, MAX_IMAGES - images.length);
    if (remaining === 0) {
      setAttachmentError(`You can attach up to ${MAX_IMAGES} images.`);
      return;
    }

    try {
      const next = await Promise.all(valid.slice(0, remaining).map(readImage));
      setImages((current) => [...current, ...next].slice(0, MAX_IMAGES));
      if (valid.length > remaining) {
        setAttachmentError(`You can attach up to ${MAX_IMAGES} images.`);
      }
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : "Could not attach that image.");
    }
  };

  const hasDraggedFiles = (event: DragEvent<HTMLDivElement>) =>
    event.dataTransfer.types.includes("Files");

  const onDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    void attach(Array.from(event.dataTransfer.files));
  };

  return (
    <div
      className="shrink-0 px-3 pb-2 md:px-6"
      style={{
        background: "var(--surface)",
        paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="mx-auto w-full max-w-[48rem]">
        <div
          className="chat-composer relative rounded-[26px] border px-3 pb-2 pt-2 shadow-sm"
          style={{
            borderColor: dragging ? "var(--accent)" : "var(--rule)",
            background: "var(--input)",
          }}
          onDragEnter={onDragEnter}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          {dragging && (
            <div
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[25px] border-2 border-dashed text-[13px]"
              style={{
                borderColor: "var(--accent)",
                background: "color-mix(in srgb, var(--input) 92%, transparent)",
                color: "var(--text)",
                fontWeight: 650,
              }}
            >
              Drop images to attach
            </div>
          )}

          {images.length > 0 && (
            <div className="mb-1 flex flex-wrap gap-2 px-1 pt-1">
              {images.map((image, index) => (
                <div key={`${image.name}-${index}`} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.url} alt={image.name} className="h-14 w-14 rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => setImages((current) => current.filter((_, i) => i !== index))}
                    className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border"
                    style={{ background: "var(--surface)", borderColor: "var(--rule)" }}
                    aria-label={`Remove ${image.name}`}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {attachmentError && (
            <p className="px-2 pb-1 text-[11.5px]" style={{ color: "var(--red)" }} role="alert">
              {attachmentError}
            </p>
          )}

          <textarea
            ref={textarea}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder="Message Padhle"
            className="chat-composer-textarea block min-h-11 w-full resize-none bg-transparent px-2 py-2 text-[16px] leading-[1.5] outline-none placeholder:opacity-60"
            style={{ color: "var(--text)" }}
          />

          <div className="flex min-w-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              aria-label="Add a photo"
              title="Add a photo"
            >
              <ImagePlus size={19} />
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                if (files.length > 0) void attach(files);
                event.target.value = "";
              }}
            />

            <select
              value={context.mode}
              onChange={(event) => onContextChange({ mode: event.target.value as ChatContext["mode"] })}
              className="h-8 max-w-[132px] rounded-lg border-0 bg-transparent px-2 text-[12px] outline-none"
              style={{ color: "var(--text-soft)", fontWeight: 550 }}
              aria-label="Answer mode"
            >
              {MODES.map((mode) => (
                <option key={mode.id} value={mode.id}>{mode.label}</option>
              ))}
            </select>

            <select
              value={context.marks ?? ""}
              onChange={(event) => onContextChange({
                marks: event.target.value ? Number(event.target.value) as ChatContext["marks"] : undefined,
              })}
              className="h-8 max-w-[92px] rounded-lg border-0 bg-transparent px-2 text-[12px] outline-none"
              style={{ color: "var(--text-soft)", fontWeight: 550 }}
              aria-label="Answer marks"
            >
              <option value="">Marks</option>
              {MARK_OPTIONS.map((marks) => (
                <option key={marks} value={marks}>{marks} mark{marks > 1 ? "s" : ""}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={busy ? onStop : submit}
              disabled={!busy && !value.trim() && images.length === 0}
              className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-opacity disabled:opacity-30"
              style={{ background: "var(--text)", color: "var(--surface)" }}
              aria-label={busy ? "Stop generating" : "Send message"}
            >
              {busy ? <Square size={13} fill="currentColor" /> : <ArrowUp size={19} strokeWidth={2.4} />}
            </button>
          </div>
        </div>
        <p className="mt-1.5 text-center text-[10.5px]" style={{ color: "var(--text-faint)" }}>
          Answers use retrieved NCERT and CBSE sources. Check important details.
        </p>
      </div>
    </div>
  );
}
