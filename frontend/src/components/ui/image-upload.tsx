import { useRef } from "react";

interface ImageUploadProps {
  value?: string;
  onChange: (file: File) => void;
  accept?: string;
  label?: string;
  className?: string;
}

export function ImageUpload({
  value,
  onChange,
  accept = "image/*",
  label = "Upload Image",
  className,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        style={{ cursor: "pointer", border: "2px dashed #ccc", padding: 16, borderRadius: 8 }}
      >
        {value ? (
          <img src={value} alt="preview" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 4 }} />
        ) : (
          <span>{label}</span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onChange(file);
        }}
      />
    </div>
  );
}
