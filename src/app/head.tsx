// app/head.tsx
export default function Head() {
  return (
    <>
      {/* Si subís ambience a /public/ambience.mp3 */}
      <link rel="preload" as="audio" href="/ambience.mp3" />
    </>
  );
}
