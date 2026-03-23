import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#161616",
          borderRadius: 36,
        }}
      >
        <svg width="100" height="100" viewBox="0 0 32 32">
          <path
            d="M16 2.33Q23.67 16 16 29.67Q8.33 16 16 2.33Z"
            fill="#e0e0e0"
          />
          <path
            d="M2.33 16Q16 8.33 29.67 16Q16 23.67 2.33 16Z"
            fill="#e0e0e0"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
