"use client";

export default function Intro({ onStart }: { onStart: () => void }) {
  return (
    <section className="screen bg-radial">
      <div className="intro-card fade-in-600">
        <h1 className="h1">minutodesilencio</h1>
        <p className="muted mt-8 text-balance">
          Un breve ritual para despedir y recordar. Al finalizar, ingresarás a
          un jardín digital.
        </p>
        <button
          className="btn mt-16"
          onClick={onStart}
          aria-label="Comenzar ritual"
        >
          Comenzar
        </button>
      </div>
    </section>
  );
}
