import { useCallback, useRef, useState } from "react";
import "@/ui/Dropzone.css";

export type DropzoneProps = {
  onFile: (file: File) => void;
};

const ACCEPTED_EXTENSIONS = [".glb", ".gltf"];

function isAccepted(file: File): boolean {
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

/**
 * Accepts a .glb/.gltf via drag & drop or file picker. The file is only
 * ever read in-memory via the File API in the browser — there is no
 * upload endpoint in this app, full stop. That's not just a comment: open
 * this page's Network tab and drop a file — nothing goes out.
 */
export function Dropzone({ onFile }: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [rejectedName, setRejectedName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      if (!isAccepted(file)) {
        setRejectedName(file.name);
        return;
      }
      setRejectedName(null);
      onFile(file);
    },
    [onFile],
  );

  return (
    <div
      className="dropzone"
      data-dragging={isDragging}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
    >
      <p className="dropzone__label">Drop a .glb or .gltf file here</p>
      <button type="button" className="dropzone__browse" onClick={() => inputRef.current?.click()}>
        or choose a file
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".glb,.gltf"
        className="dropzone__input"
        aria-label="Choose a glTF or GLB file"
        onChange={(event) => handleFiles(event.target.files)}
      />
      {rejectedName && (
        <p className="dropzone__error" role="alert">
          "{rejectedName}" isn't a .glb or .gltf file.
        </p>
      )}
      <p className="dropzone__privacy">
        Your model never leaves your browser — it's parsed locally, no upload, no server.
      </p>
    </div>
  );
}
