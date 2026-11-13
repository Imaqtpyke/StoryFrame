export default function BackgroundEffect() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
    >
      {/* Subtle, static radial depth above the obsidian canvas */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 75% 50% at 50% 0%, rgba(255, 255, 255, 0.035) 0%, rgba(12, 12, 11, 0) 70%)',
        }}
      />
    </div>
  );
}
