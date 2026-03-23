import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Мира — AI-ассистент с поиском в интернете";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0a0a0a",
          fontFamily: "sans-serif",
        }}
      >
        {/* Subtle radial glow */}
        <div
          style={{
            position: "absolute",
            width: 600,
            height: 600,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />

        {/* Star/diamond logo */}
        <svg
          width="80"
          height="80"
          viewBox="0 0 32 32"
          style={{ marginBottom: 32 }}
        >
          <path
            d="M16 2.33Q23.67 16 16 29.67Q8.33 16 16 2.33Z"
            fill="rgba(255,255,255,0.85)"
          />
          <path
            d="M2.33 16Q16 8.33 29.67 16Q16 23.67 2.33 16Z"
            fill="rgba(255,255,255,0.85)"
          />
        </svg>

        {/* Title */}
        <div
          style={{
            fontSize: 64,
            fontWeight: 600,
            color: "rgba(255,255,255,0.90)",
            letterSpacing: "-0.02em",
            marginBottom: 12,
          }}
        >
          Мира
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 28,
            color: "rgba(255,255,255,0.35)",
            fontWeight: 400,
            marginBottom: 48,
          }}
        >
          AI-ассистент с поиском в интернете
        </div>

        {/* Domain */}
        <div
          style={{
            fontSize: 20,
            color: "rgba(255,255,255,0.15)",
            fontWeight: 400,
            letterSpacing: "0.08em",
          }}
        >
          vmira.ai
        </div>
      </div>
    ),
    { ...size },
  );
}
