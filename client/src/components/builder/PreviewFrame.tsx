import { useRef, useEffect, useState, ReactNode } from "react";
import { createPortal } from "react-dom";

interface PreviewFrameProps {
  children: ReactNode;
  width: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function PreviewFrame({ children, width, className, style }: PreviewFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      const doc = iframe.contentDocument;
      if (!doc) return;

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
            <script src="https://cdn.tailwindcss.com"></script>
            <script>
              tailwind.config = {
                theme: {
                  extend: {
                    fontFamily: {
                      sans: ['Inter', 'sans-serif'],
                    },
                  }
                }
              }
            </script>
            <style>
              * { box-sizing: border-box; margin: 0; padding: 0; }
              html, body { 
                font-family: 'Inter', sans-serif; 
                background: white;
                min-height: 100%;
              }
              body { overflow-x: hidden; }
              #preview-root { min-height: 100vh; }
            </style>
          </head>
          <body>
            <div id="preview-root"></div>
          </body>
        </html>
      `);
      doc.close();

      const root = doc.getElementById("preview-root");
      if (root) {
        setMountNode(root);
      }
    };

    handleLoad();
  }, []);

  return (
    <iframe
      ref={iframeRef}
      className={className}
      style={{
        border: "none",
        width: `${width}px`,
        maxWidth: "100%",
        minHeight: "600px",
        height: "100%",
        ...style,
      }}
      title="Website Preview"
      data-testid="preview-iframe"
    >
      {mountNode && createPortal(children, mountNode)}
    </iframe>
  );
}
