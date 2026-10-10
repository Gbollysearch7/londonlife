/** Original illustrated dusk skyline over a winding river: terraces, towers, a bridge and lit windows. */
export default function Skyline() {
  const terraces = Array.from({ length: 5 }, (_, i) => i);
  return (
    <svg viewBox="0 0 800 600" preserveAspectRatio="xMidYMax slice" role="img" aria-label="Illustrated London skyline at dusk">
      <defs>
        <linearGradient id="river" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c98c6a" />
          <stop offset="1" stopColor="#3a4a5c" />
        </linearGradient>
        <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffe2a8" />
          <stop offset="1" stopColor="#ffe2a8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="560" cy="300" r="140" fill="url(#sun)" />
      <circle cx="560" cy="300" r="34" fill="#f8d290" />
      {/* distant towers */}
      <g fill="#6b5a66" opacity="0.75">
        <rect x="90" y="230" width="34" height="170" />
        <polygon points="300,180 330,400 270,400" />
        <rect x="420" y="250" width="28" height="150" />
        <rect x="455" y="210" width="40" height="190" />
        <path d="M620 400 V265 q25 -40 50 0 V400 Z" />
        <rect x="700" y="240" width="30" height="160" />
      </g>
      {/* dome */}
      <g fill="#5a4a57">
        <rect x="170" y="330" width="90" height="70" />
        <path d="M180 330 q35 -70 70 0 Z" />
        <rect x="211" y="250" width="8" height="40" />
      </g>
      {/* river */}
      <path d="M0 470 C 200 430, 320 520, 520 470 S 760 430, 800 455 V600 H0 Z" fill="url(#river)" />
      <g stroke="#f6d3a0" strokeOpacity="0.35" strokeWidth="2">
        <line x1="120" y1="505" x2="190" y2="505" />
        <line x1="420" y1="520" x2="470" y2="520" />
        <line x1="600" y1="490" x2="680" y2="490" />
      </g>
      {/* bridge */}
      <g fill="#3b3440">
        <rect x="330" y="440" width="320" height="10" />
        <rect x="380" y="380" width="16" height="80" />
        <rect x="580" y="380" width="16" height="80" />
        <path d="M388 384 Q 488 450 588 384" fill="none" stroke="#3b3440" strokeWidth="3" />
      </g>
      {/* near terraces */}
      <g>
        {terraces.map((i) => {
          const x = i * 58 - 10;
          const h = 70 + ((i * 37) % 40);
          const roof = i % 3 === 0 ? `M${x} ${600 - h - 150} l29 -22 l29 22 Z` : "";
          return (
            <g key={i}>
              <rect x={x} y={600 - h - 150} width="58" height={h + 150} fill={i % 2 ? "#7c4337" : "#8b4b3c"} />
              {roof && <path d={roof} fill="#4e3a3a" />}
              <rect x={x + 8} y={600 - h - 135} width="14" height="20" fill={i % 4 === 1 ? "#ffd58a" : "#c48a6a"} />
              <rect x={x + 34} y={600 - h - 135} width="14" height="20" fill={i % 3 === 2 ? "#ffd58a" : "#c48a6a"} />
              <rect x={x + 8} y={600 - h - 100} width="14" height="20" fill={i % 5 === 0 ? "#ffd58a" : "#c48a6a"} />
              <rect x={x + 34} y={600 - h - 100} width="14" height="20" fill="#c48a6a" />
              <rect x={x + 20} y={600 - 52} width="16" height="40" fill={["#234C42", "#BC3D3B", "#2F4A6B", "#17232B"][i % 4]} />
            </g>
          );
        })}
      </g>
      {/* bus */}
      <g transform="translate(150 522)">
        <rect width="120" height="56" rx="8" fill="#BC3D3B" />
        <rect x="8" y="8" width="104" height="14" rx="3" fill="#f6e0b5" opacity="0.9" />
        <rect x="8" y="30" width="104" height="14" rx="3" fill="#f6e0b5" opacity="0.9" />
        <circle cx="26" cy="58" r="8" fill="#17232B" />
        <circle cx="94" cy="58" r="8" fill="#17232B" />
      </g>
      <rect y="586" width="800" height="14" fill="#2b2b30" />
    </svg>
  );
}
