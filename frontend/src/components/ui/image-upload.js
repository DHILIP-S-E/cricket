import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef } from "react";
export function ImageUpload({ value, onChange, accept = "image/*", label = "Upload Image", className, }) {
    const inputRef = useRef(null);
    return (_jsxs("div", { className: className, children: [_jsx("button", { type: "button", onClick: () => inputRef.current?.click(), style: { cursor: "pointer", border: "2px dashed #ccc", padding: 16, borderRadius: 8 }, children: value ? (_jsx("img", { src: value, alt: "preview", style: { width: 80, height: 80, objectFit: "cover", borderRadius: 4 } })) : (_jsx("span", { children: label })) }), _jsx("input", { ref: inputRef, type: "file", accept: accept, style: { display: "none" }, onChange: (e) => {
                    const file = e.target.files?.[0];
                    if (file)
                        onChange(file);
                } })] }));
}
